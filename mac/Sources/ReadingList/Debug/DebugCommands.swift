#if DEBUG
    import AppKit
    import Foundation

    /// The commands the debug socket understands. Coordinates are window points
    /// with the origin at the window's top-left corner: exactly the pixels of a
    /// 1x screenshot of that window.
    @MainActor
    enum DebugCommands {
        static func run(_ request: [String: Any]) async throws -> Any {
            let command = request["cmd"] as? String ?? ""
            let args = request["args"] as? [String: Any] ?? [:]
            switch command {
            case "ping":
                return [
                    "app": Bundle.main.bundleIdentifier ?? "",
                    "pid": Int(ProcessInfo.processInfo.processIdentifier),
                    "active": NSApp.isActive,
                ]
            case "windows":
                return NSApp.windows.filter { $0.isVisible }.map(describe)
            case "tree":
                return AccessibilityTree.dump(window: try window(args))
            case "click":
                let target = try window(args)
                let point = try point(args)
                InputSynthesis.click(
                    window: target,
                    at: point,
                    button: args["button"] as? String ?? "left",
                    count: args["count"] as? Int ?? 1,
                    modifiers: modifiers(args)
                )
                return ["x": point.x, "y": point.y]
            case "hover":
                let target = try window(args)
                let point = try point(args)
                InputSynthesis.hover(window: target, at: point)
                return ["x": point.x, "y": point.y]
            case "scroll":
                let target = try window(args)
                let point = try point(args)
                let deltaY = args["dy"] as? Double ?? 0
                let deltaX = args["dx"] as? Double ?? 0
                try InputSynthesis.scroll(window: target, at: point, dx: deltaX, dy: deltaY)
                return ["x": point.x, "y": point.y, "dx": deltaX, "dy": deltaY]
            case "type":
                let text = try string(args, "text")
                InputSynthesis.type(window: try keyboardWindow(args), text: text)
                return ["typed": text]
            case "key":
                let spec = try string(args, "key")
                try InputSynthesis.key(window: try keyboardWindow(args), spec: spec)
                return ["pressed": spec]
            case "oauth-url":
                guard let session = AppServices.session else { throw DebugError("no session") }
                // The url the app last opened, so a harness can finish that same
                // sign-in in a browser; a fresh one only when none was opened.
                return ["url": try (session.lastOAuthURL ?? session.oauthSignInURL()).absoluteString]
            case "settings":
                guard let settings = AppServices.settings else { throw DebugError("no shell") }
                settings.update { current in
                    if let value = args["theme"] as? String { current.theme = value }
                    if let value = args["density"] as? String { current.density = value }
                    if let value = args["groupBy"] as? String { current.groupBy = value }
                    if let value = args["sortBy"] as? String { current.sortBy = value }
                    if let value = args["showRead"] as? Bool { current.showRead = value }
                    if let value = args["sounds"] as? Bool { current.sounds = value }
                }
                let current = settings.settings
                return [
                    "loaded": settings.hasLoaded, "error": settings.lastError ?? "", "theme": current.theme,
                    "density": current.density, "groupBy": current.groupBy, "sortBy": current.sortBy,
                    "showRead": current.showRead, "sounds": current.sounds,
                ]
            case "dev":
                guard let raw = args["state"] as? String, let preview = DevState.Preview(rawValue: raw) else {
                    throw DebugError(
                        "state must be one of \(DevState.Preview.allCases.map(\.rawValue).joined(separator: ", "))")
                }
                DevState.shared.show(preview)
                return ["preview": DevState.shared.preview.rawValue]
            case "close":
                let window = try keyboardWindow(args)
                window.performClose(nil)
                return ["closed": true]
            case "blur":
                // Give up the first responder: the way to end an in-place edit
                // without clicking somewhere in particular.
                let window = try keyboardWindow(args)
                return ["resigned": window.makeFirstResponder(nil as NSResponder?)]
            case "activate":
                let target = try window(args)
                NSApp.activate()
                target.makeKeyAndOrderFront(nil)
                return describe(target)
            case "resize":
                let target = try window(args)
                guard let width = args["width"] as? Double, let height = args["height"] as? Double
                else { throw DebugError("resize needs width and height") }
                var frame = target.frame
                // Keep the top-left corner where it is.
                frame.origin.y += frame.height - height
                frame.size = NSSize(width: width, height: height)
                target.setFrame(frame, display: true)
                return describe(target)
            case "move":
                let target = try window(args)
                let point = try point(args)
                let primaryHeight = NSScreen.screens.first?.frame.height ?? 0
                var frame = target.frame
                frame.origin = NSPoint(x: point.x, y: primaryHeight - point.y - frame.height)
                target.setFrame(frame, display: true)
                return describe(target)
            case "signin":
                guard let session = AppServices.session else { throw DebugError("no backend configured") }
                let email = try string(args, "email")
                let password = try string(args, "password")
                try await session.signIn(email: email, password: password)
                return ["signedIn": true]
            case "signout":
                guard let session = AppServices.session else { throw DebugError("no backend configured") }
                await session.signOut()
                return ["signedOut": true]
            case "whoami":
                guard let session = AppServices.session else { return ["configured": false] }
                switch session.state {
                case .unknown: return ["state": "unknown"]
                case .signedOut: return ["state": "signedOut"]
                case .signedIn(let account):
                    return [
                        "state": "signedIn", "userId": account.userId, "email": account.email ?? "",
                        "local": session.config.isLocal,
                    ]
                }
            case "items":
                let store = try store()
                let limit = args["limit"] as? Int ?? 20
                return [
                    "count": store.items.count,
                    "loaded": store.hasLoaded,
                    "syncedAt": store.lastSyncedAt.map { Timestamps.format($0) } ?? "",
                    "refreshError": store.lastRefreshError ?? "",
                    "items": store.items.prefix(limit).map(describe),
                ]
            case "item":
                let store = try store()
                guard let item = store.item(try string(args, "id")) else { throw DebugError("no item with that id") }
                var detail = describe(item)
                detail["notes"] = item.notes ?? ""
                return detail
            case "refresh":
                try store().refresh()
                return ["refreshing": true]
            case "create":
                let store = try store()
                let id = (args["url"] as? String).map { store.create(url: $0) } ?? store.createBlank()
                return ["id": id]
            case "patch":
                let store = try store()
                let id = try string(args, "id")
                store.patch(
                    id,
                    ItemPatch(
                        title: args["title"] as? String, url: args["url"] as? String, notes: args["notes"] as? String,
                        starred: args["starred"] as? Bool, read: args["read"] as? Bool,
                        hiddenFromReview: args["hiddenFromReview"] as? Bool
                    ))
                store.flush(id)
                return ["patched": id]
            case "delete":
                try store().delete(try string(args, "id"))
                return ["deleted": true]
            case "open":
                guard let navigator = AppServices.navigator else { throw DebugError("no shell") }
                if let id = args["id"] as? String { navigator.open(id) } else { navigator.showItems() }
                return ["view": String(describing: navigator.current)]
            case "review":
                guard let navigator = AppServices.navigator else { throw DebugError("no shell") }
                navigator.showReview(itemId: args["id"] as? String)
                return ["view": String(describing: navigator.current)]
            case "cards":
                guard let deck = AppServices.cards else { throw DebugError("no shell") }
                let items = AppServices.store?.items ?? []
                let limit = args["limit"] as? Int ?? 20
                return [
                    "count": deck.cards.count,
                    "due": deck.dueCount(items: items),
                    "new": ReviewQueues.standing(deck.cards, items: items, mode: .new).count,
                    "loaded": deck.hasLoaded,
                    "syncedAt": deck.lastSyncedAt.map { Timestamps.format($0) } ?? "",
                    "refreshError": deck.lastRefreshError ?? "",
                    "cards": deck.cards.prefix(limit).map { card in
                        [
                            "id": card.id, "front": card.front, "back": card.back, "state": card.state.rawValue,
                            "due": Timestamps.format(card.due), "interval": card.interval, "reps": card.reps,
                            "itemId": card.itemId ?? "", "itemTitle": card.itemTitle ?? "",
                        ] as [String: Any]
                    },
                ]
            case "board":
                let name = args["name"] as? String
                guard BoardState.shared.open(name) else {
                    throw DebugError(
                        "no demo named \"\(name ?? "")\"; known: \(Demo.all.map(\.id).joined(separator: ", "))")
                }
                return ["selection": BoardState.shared.selection]
            case "appearance":
                let mode = try string(args, "mode")
                switch mode {
                case "dark": NSApp.appearance = NSAppearance(named: .darkAqua)
                case "light": NSApp.appearance = NSAppearance(named: .aqua)
                case "system": NSApp.appearance = nil
                default: throw DebugError("appearance must be light, dark or system")
                }
                return ["mode": mode]
            case "quit":
                Task { @MainActor in
                    try? await Task.sleep(for: .milliseconds(100))
                    NSApp.terminate(nil)
                }
                return ["quitting": true]
            default:
                throw DebugError("unknown command \"\(command)\"")
            }
        }

        private static func store() throws -> ItemStore {
            guard let store = AppServices.store else { throw DebugError("not signed in (no store)") }
            return store
        }

        private static func describe(_ item: Item) -> [String: Any] {
            [
                "id": item.id, "title": item.title, "url": item.url, "starred": item.starred,
                "read": item.read, "flashcards": item.flashcardCount,
                "createdAt": Timestamps.format(item.createdAt), "updatedAt": Timestamps.format(item.updatedAt),
            ]
        }

        static func describe(_ window: NSWindow) -> [String: Any] {
            [
                "id": window.windowNumber,
                "title": window.title,
                "key": window.isKeyWindow,
                "visible": window.isVisible,
                "width": Double(window.frame.width),
                "height": Double(window.frame.height),
                "scale": Double(window.backingScaleFactor),
                // Top-left corner in Core Graphics screen coordinates (origin at the
                // top-left of the primary display), for `screencapture -R`.
                "x": Double(window.frame.minX),
                "y": Double((NSScreen.screens.first?.frame.height ?? 0) - window.frame.maxY),
                "appearance": window.effectiveAppearance.name.rawValue,
                "firstResponder": window.firstResponder.map { NSStringFromClass(type(of: $0)) } ?? "",
                "active": NSApp.isActive,
            ]
        }

        /// `window` picks a window by number; otherwise the key window, else the
        /// first visible one.
        private static func window(_ args: [String: Any]) throws -> NSWindow {
            if let id = args["window"] as? Int {
                guard let window = NSApp.window(withWindowNumber: id) else {
                    throw DebugError("no window with id \(id)")
                }
                return window
            }
            if let window = NSApp.keyWindow ?? NSApp.mainWindow { return window }
            if let window = NSApp.windows.first(where: { $0.isVisible }) { return window }
            throw DebugError("no visible window")
        }

        /// Keys go to the frontmost window (a popover that just opened, say),
        /// which a real click would have made key; synthetic clicks do not.
        private static func keyboardWindow(_ args: [String: Any]) throws -> NSWindow {
            if args["window"] != nil { return try window(args) }
            guard let front = NSApp.orderedWindows.first(where: { $0.isVisible }) else { return try window(args) }
            if !front.isKeyWindow { front.makeKey() }
            return front
        }

        private static func point(_ args: [String: Any]) throws -> CGPoint {
            guard let x = args["x"] as? Double, let y = args["y"] as? Double else {
                throw DebugError("needs x and y (window points, top-left origin)")
            }
            return CGPoint(x: x, y: y)
        }

        private static func string(_ args: [String: Any], _ key: String) throws -> String {
            guard let value = args[key] as? String else { throw DebugError("needs \(key)") }
            return value
        }

        private static func modifiers(_ args: [String: Any]) -> NSEvent.ModifierFlags {
            var flags: NSEvent.ModifierFlags = []
            for name in args["modifiers"] as? [String] ?? [] {
                switch name {
                case "cmd", "command": flags.insert(.command)
                case "shift": flags.insert(.shift)
                case "alt", "option": flags.insert(.option)
                case "ctrl", "control": flags.insert(.control)
                default: break
                }
            }
            return flags
        }
    }
#endif
