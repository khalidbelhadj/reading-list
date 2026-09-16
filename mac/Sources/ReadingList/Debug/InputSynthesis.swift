#if DEBUG
    import AppKit

    /// Synthesised input, posted to the app's own event queue so it takes the
    /// same path as a person's mouse and keyboard (hit testing, the responder
    /// chain, menu key equivalents, and the modal tracking loops table views run
    /// inside mouseDown) without needing Accessibility permission. Events are
    /// handled after the current socket callback returns, so the client waits a
    /// beat before reading the result.
    @MainActor
    enum InputSynthesis {
        /// Window-local point with a top-left origin (a 1x screenshot's pixels)
        /// to AppKit window coordinates (bottom-left origin).
        static func windowPoint(_ local: CGPoint, in window: NSWindow) -> NSPoint {
            NSPoint(x: local.x, y: window.frame.height - local.y)
        }

        static func click(
            window: NSWindow,
            at local: CGPoint,
            button: String,
            count: Int,
            modifiers: NSEvent.ModifierFlags
        ) {
            let point = windowPoint(local, in: window)
            let right = button == "right"
            let down: NSEvent.EventType = right ? .rightMouseDown : .leftMouseDown
            let up: NSEvent.EventType = right ? .rightMouseUp : .leftMouseUp
            send(mouseEvent(.mouseMoved, at: point, in: window, modifiers: modifiers, clickCount: 0))
            for clickIndex in 1...max(1, count) {
                send(mouseEvent(down, at: point, in: window, modifiers: modifiers, clickCount: clickIndex))
                send(mouseEvent(up, at: point, in: window, modifiers: modifiers, clickCount: clickIndex))
            }
        }

        /// Moves the real cursor there (tracking areas, and so hover states, follow
        /// the window server's cursor, not synthetic events) and sends a mouse-moved.
        static func hover(window: NSWindow, at local: CGPoint) {
            let point = windowPoint(local, in: window)
            let screenPoint = window.convertPoint(toScreen: point)
            // Core Graphics counts from the top-left of the primary display.
            let primaryHeight = NSScreen.screens.first?.frame.height ?? 0
            CGWarpMouseCursorPosition(CGPoint(x: screenPoint.x, y: primaryHeight - screenPoint.y))
            send(mouseEvent(.mouseMoved, at: point, in: window, modifiers: [], clickCount: 0))
        }

        /// Scrolls the scroll view under the point by (dx, dy) points, positive
        /// dy scrolling the content up (i.e. towards the end).
        static func scroll(window: NSWindow, at local: CGPoint, dx: Double, dy: Double) throws {
            guard let contentView = window.contentView else { throw DebugError("window has no content view") }
            let point = windowPoint(local, in: window)
            let viewPoint = contentView.convert(point, from: nil)
            guard let hit = contentView.hitTest(viewPoint) else {
                throw DebugError("nothing under (\(local.x), \(local.y))")
            }
            guard let scrollView = (hit as? NSScrollView) ?? hit.enclosingScrollView else {
                throw DebugError("no scroll view under (\(local.x), \(local.y))")
            }
            let clipView = scrollView.contentView
            let flipped = scrollView.documentView?.isFlipped ?? true
            var origin = clipView.bounds.origin
            origin.x += dx
            origin.y += flipped ? dy : -dy
            let constrained = clipView.constrainBoundsRect(NSRect(origin: origin, size: clipView.bounds.size))
            clipView.scroll(to: constrained.origin)
            scrollView.reflectScrolledClipView(clipView)
        }

        static func type(window: NSWindow, text: String) {
            for character in text {
                let typed = String(character)
                let lower = typed.lowercased()
                let code = keyCodes[lower] ?? 0
                var flags: NSEvent.ModifierFlags = []
                if character.isUppercase { flags.insert(.shift) }
                send(
                    keyEvent(
                        .keyDown, characters: typed, ignoringModifiers: lower, code: code, flags: flags, window: window)
                )
                send(
                    keyEvent(
                        .keyUp, characters: typed, ignoringModifiers: lower, code: code, flags: flags, window: window))
            }
        }

        /// `spec` is a key name with optional modifiers: "return", "escape",
        /// "cmd+k", "cmd+shift+[", "down".
        static func key(window: NSWindow, spec: String) throws {
            let parts = spec.lowercased().split(separator: "+", omittingEmptySubsequences: false).map(String.init)
            guard let name = parts.last, !name.isEmpty else { throw DebugError("empty key") }
            var flags: NSEvent.ModifierFlags = []
            for modifier in parts.dropLast() {
                switch modifier {
                case "cmd", "command", "meta": flags.insert(.command)
                case "shift": flags.insert(.shift)
                case "alt", "option", "opt": flags.insert(.option)
                case "ctrl", "control": flags.insert(.control)
                default: throw DebugError("unknown modifier \"\(modifier)\"")
                }
            }
            let characters: String
            let code: UInt16
            if let special = specialKeys[name] {
                (characters, code) = special
            } else if name.count == 1, let keyCode = keyCodes[name] {
                (characters, code) = (name, keyCode)
            } else {
                throw DebugError("unknown key \"\(name)\"")
            }
            let typed = flags.contains(.shift) && name.count == 1 ? name.uppercased() : characters
            send(
                keyEvent(
                    .keyDown, characters: typed, ignoringModifiers: characters, code: code, flags: flags, window: window
                ))
            send(
                keyEvent(
                    .keyUp, characters: typed, ignoringModifiers: characters, code: code, flags: flags, window: window))
        }

        private static func mouseEvent(
            _ type: NSEvent.EventType,
            at point: NSPoint,
            in window: NSWindow,
            modifiers: NSEvent.ModifierFlags,
            clickCount: Int
        ) -> NSEvent? {
            let pressed = type == .leftMouseDown || type == .rightMouseDown
            return NSEvent.mouseEvent(
                with: type,
                location: point,
                modifierFlags: modifiers,
                timestamp: ProcessInfo.processInfo.systemUptime,
                windowNumber: window.windowNumber,
                context: nil,
                eventNumber: 0,
                clickCount: clickCount,
                pressure: pressed ? 1 : 0
            )
        }

        private static func keyEvent(
            _ type: NSEvent.EventType,
            characters: String,
            ignoringModifiers: String,
            code: UInt16,
            flags: NSEvent.ModifierFlags,
            window: NSWindow
        ) -> NSEvent? {
            NSEvent.keyEvent(
                with: type,
                location: .zero,
                modifierFlags: flags,
                timestamp: ProcessInfo.processInfo.systemUptime,
                windowNumber: window.windowNumber,
                context: nil,
                characters: characters,
                charactersIgnoringModifiers: ignoringModifiers,
                isARepeat: false,
                keyCode: code
            )
        }

        private static func send(_ event: NSEvent?) {
            guard let event else { return }
            NSApp.postEvent(event, atStart: false)
        }

        private static let specialKeys: [String: (String, UInt16)] = [
            "return": ("\r", 36), "enter": ("\r", 36),
            "tab": ("\t", 48),
            "space": (" ", 49),
            "delete": ("\u{7F}", 51), "backspace": ("\u{7F}", 51),
            "escape": ("\u{1B}", 53), "esc": ("\u{1B}", 53),
            "left": ("\u{F702}", 123), "right": ("\u{F703}", 124),
            "down": ("\u{F701}", 125), "up": ("\u{F700}", 126),
            "forwarddelete": ("\u{F728}", 117),
            "home": ("\u{F729}", 115), "end": ("\u{F72B}", 119),
            "pageup": ("\u{F72C}", 116), "pagedown": ("\u{F72D}", 121),
        ]

        // ANSI (US) virtual key codes.
        private static let keyCodes: [String: UInt16] = [
            "a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7, "c": 8, "v": 9,
            "b": 11, "q": 12, "w": 13, "e": 14, "r": 15, "y": 16, "t": 17,
            "1": 18, "2": 19, "3": 20, "4": 21, "6": 22, "5": 23, "=": 24, "9": 25, "7": 26,
            "-": 27, "8": 28, "0": 29, "]": 30, "o": 31, "u": 32, "[": 33, "i": 34, "p": 35,
            "l": 37, "j": 38, "'": 39, "k": 40, ";": 41, "\\": 42, ",": 43, "/": 44, "n": 45,
            "m": 46, ".": 47, "`": 50, " ": 49,
        ]
    }
#endif
