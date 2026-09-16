#if DEBUG
    import AppKit

    /// The window's accessibility tree, walked in-process (no permission needed).
    /// SwiftUI publishes every view that carries a label, identifier or value
    /// here, with its on-screen frame, which is what lets the client find and
    /// click things by name.
    ///
    /// Two kinds of object turn up. Views and SwiftUI's accessibility nodes
    /// implement the modern getters (`accessibilityRole()` and friends), though
    /// SwiftUI's nodes do so without declaring the protocol, so they are read by
    /// key-value access after checking the getter exists. AppKit's row proxies
    /// (`NSOutlineRow` behind a sidebar list) only speak the legacy attribute
    /// API, so those fall back to `accessibilityAttributeValue(_:)`.
    @MainActor
    enum AccessibilityTree {
        private static let maxDepth = 60
        private static let maxValueLength = 200

        static func dump(window: NSWindow) -> [String: Any] {
            var count = 0
            var root = node(for: window, in: window, depth: 0, count: &count)
            root["count"] = count
            return root
        }

        /// Screen rect (bottom-left origin) to window points (top-left origin).
        static func localRect(_ rect: NSRect, in window: NSWindow) -> CGRect {
            let frame = window.frame
            return CGRect(
                x: rect.minX - frame.minX,
                y: frame.maxY - rect.maxY,
                width: rect.width,
                height: rect.height
            )
        }

        private struct Attributes {
            var role = ""
            var subrole: String?
            var label: String?
            var title: String?
            var value: Any?
            var placeholder: String?
            var identifier: String?
            var frame: NSRect?
            var enabled = true
            var focused = false
            var selected = false
            var hidden = false
            var children: [Any] = []
        }

        private static func node(
            for element: Any,
            in window: NSWindow,
            depth: Int,
            count: inout Int
        ) -> [String: Any] {
            var dict: [String: Any] = [:]
            guard let object = element as? NSObject else {
                dict["role"] = "?"
                dict["class"] = String(describing: type(of: element))
                return dict
            }
            count += 1
            let attributes =
                object.responds(to: NSSelectorFromString("accessibilityRole"))
                ? modern(object)
                : legacy(object)
            dict["role"] = attributes.role
            if attributes.role.isEmpty {
                dict["class"] = NSStringFromClass(type(of: object))
            }
            if let subrole = attributes.subrole { dict["subrole"] = subrole }
            if let label = attributes.label, !label.isEmpty { dict["label"] = label }
            if let title = attributes.title, !title.isEmpty { dict["title"] = title }
            if let value = attributes.value { dict["value"] = stringify(value) }
            if let placeholder = attributes.placeholder, !placeholder.isEmpty {
                dict["placeholder"] = placeholder
            }
            if let identifier = attributes.identifier, !identifier.isEmpty {
                dict["id"] = identifier
            }
            if let frame = attributes.frame {
                let local = localRect(frame, in: window)
                dict["frame"] = [
                    Double(local.minX.rounded()), Double(local.minY.rounded()),
                    Double(local.width.rounded()), Double(local.height.rounded()),
                ]
            }
            if !attributes.enabled { dict["disabled"] = true }
            if attributes.focused { dict["focused"] = true }
            if attributes.selected { dict["selected"] = true }
            if attributes.hidden { dict["hidden"] = true }
            if depth < maxDepth, !attributes.children.isEmpty {
                var childNodes: [[String: Any]] = []
                childNodes.reserveCapacity(attributes.children.count)
                for child in attributes.children {
                    childNodes.append(node(for: child, in: window, depth: depth + 1, count: &count))
                }
                dict["children"] = childNodes
            }
            return dict
        }

        // MARK: Modern getters (views, SwiftUI nodes)

        private static func modern(_ object: NSObject) -> Attributes {
            var attributes = Attributes()
            attributes.role = string(object, "accessibilityRole") ?? ""
            attributes.subrole = string(object, "accessibilitySubrole")
            attributes.label = string(object, "accessibilityLabel")
            attributes.title = string(object, "accessibilityTitle")
            attributes.value = attribute(object, "accessibilityValue")
            attributes.placeholder = string(object, "accessibilityPlaceholderValue")
            attributes.identifier = string(object, "accessibilityIdentifier")
            attributes.frame = (attribute(object, "accessibilityFrame") as? NSValue)?.rectValue
            attributes.enabled = flag(object, "accessibilityEnabled", fallback: true)
            attributes.focused = flag(object, "accessibilityFocused", fallback: false)
            attributes.selected = flag(object, "accessibilitySelected", fallback: false)
            attributes.hidden = flag(object, "accessibilityHidden", fallback: false)
            attributes.children = attribute(object, "accessibilityChildren") as? [Any] ?? []
            return attributes
        }

        /// The getter named `key`, or nil when the object has no such method
        /// (key-value access would raise an Objective-C exception otherwise).
        private static func attribute(_ object: NSObject, _ key: String, getter: String? = nil) -> Any? {
            guard object.responds(to: NSSelectorFromString(getter ?? key)) else { return nil }
            return object.value(forKey: key)
        }

        private static func string(_ object: NSObject, _ key: String) -> String? {
            attribute(object, key) as? String
        }

        /// Boolean attributes use `is`-prefixed getters (`isAccessibilityEnabled`).
        private static func flag(_ object: NSObject, _ key: String, fallback: Bool) -> Bool {
            let getter = "is" + key.prefix(1).uppercased() + key.dropFirst()
            return (attribute(object, key, getter: getter) as? Bool) ?? fallback
        }

        // MARK: Legacy attribute API (AppKit row proxies)

        // Called through selectors: the legacy API is deprecated, and Swift has no
        // way to silence that at one call site.
        private static let attributeNamesSelector = NSSelectorFromString("accessibilityAttributeNames")
        private static let attributeValueSelector = NSSelectorFromString("accessibilityAttributeValue:")

        private static func legacy(_ object: NSObject) -> Attributes {
            guard object.responds(to: attributeNamesSelector), object.responds(to: attributeValueSelector)
            else { return Attributes() }
            let names = object.perform(attributeNamesSelector)?.takeUnretainedValue() as? [String] ?? []
            let supported = Set(names)
            func get(_ name: NSAccessibility.Attribute) -> Any? {
                guard supported.contains(name.rawValue) else { return nil }
                return object.perform(attributeValueSelector, with: name.rawValue as NSString)?
                    .takeUnretainedValue()
            }
            var attributes = Attributes()
            attributes.role = get(.role) as? String ?? ""
            attributes.subrole = get(.subrole) as? String
            attributes.label = get(.description) as? String
            attributes.title = get(.title) as? String
            attributes.value = get(.value)
            attributes.placeholder = get(.placeholderValue) as? String
            attributes.identifier = get(.identifier) as? String
            if let position = (get(.position) as? NSValue)?.pointValue,
                let size = (get(.size) as? NSValue)?.sizeValue
            {
                attributes.frame = NSRect(origin: position, size: size)
            }
            attributes.enabled = get(.enabled) as? Bool ?? true
            attributes.focused = get(.focused) as? Bool ?? false
            attributes.selected = get(.selected) as? Bool ?? false
            attributes.hidden = get(.hidden) as? Bool ?? false
            attributes.children = get(.children) as? [Any] ?? []
            return attributes
        }

        private static func stringify(_ value: Any) -> String {
            let text: String
            switch value {
            case let string as String: text = string
            case let attributed as NSAttributedString: text = attributed.string
            case let number as NSNumber: text = number.stringValue
            default: text = String(describing: value)
            }
            return text.count > maxValueLength ? String(text.prefix(maxValueLength)) + "…" : text
        }
    }
#endif
