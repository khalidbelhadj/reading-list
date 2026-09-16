import AppKit
import SwiftUI

private struct IconSizeKey: EnvironmentKey {
    static let defaultValue: CGFloat = 14
}

extension EnvironmentValues {
    /// The size an `Icon` takes when not given one: buttons and badges set it
    /// for their contents (the web's `[&_svg]:size-3.5`).
    var iconSize: CGFloat {
        get { self[IconSizeKey.self] }
        set { self[IconSizeKey.self] = newValue }
    }
}

/// A Tabler icon (the web app's set, see scripts/mac-icons.ts), drawn as a
/// template image so it takes the current foreground colour. Sizes follow
/// the web: 14 in rows and medium buttons, 12 in small ones, 16 in large.
struct Icon: View {
    let icon: TablerIcon
    var size: CGFloat?
    @Environment(\.iconSize) private var environmentSize

    init(_ icon: TablerIcon, size: CGFloat? = nil) {
        self.icon = icon
        self.size = size
    }

    var body: some View {
        let side = size ?? environmentSize
        Image(nsImage: IconStore.image(icon))
            .renderingMode(icon.keepsColor ? .original : .template)
            .resizable()
            .scaledToFit()
            .frame(width: side, height: side)
    }
}

extension TablerIcon {
    /// Brand marks keep their own colour instead of taking the foreground.
    var keepsColor: Bool { self == .claude || self == .google }
}

@MainActor
enum IconStore {
    private static var cache: [TablerIcon: NSImage] = [:]

    static func image(_ icon: TablerIcon) -> NSImage {
        if let cached = cache[icon] { return cached }
        let image =
            Resources.url(icon.rawValue, extension: "svg", subdirectory: "Icons")
            .flatMap { NSImage(contentsOf: $0) }
            ?? NSImage(size: NSSize(width: 24, height: 24))
        image.isTemplate = !icon.keepsColor
        cache[icon] = image
        return image
    }

    private static var menuCache: [TablerIcon: NSImage] = [:]

    /// A menu image painted in one colour (a destructive item), no longer a
    /// template so the menu leaves it alone.
    static func menuImage(_ icon: TablerIcon, tint: Color) -> NSImage {
        let base = menuImage(icon)
        let size = base.size
        let painted = NSImage(size: size, flipped: false) { rect in
            base.draw(in: rect)
            NSColor(tint).set()
            rect.fill(using: .sourceAtop)
            return true
        }
        painted.isTemplate = false
        return painted
    }

    /// The icon at 14pt for AppKit menus, which size an item's image by the
    /// image's own size.
    static func menuImage(_ icon: TablerIcon) -> NSImage {
        if let cached = menuCache[icon] { return cached }
        let sized = (image(icon).copy() as? NSImage) ?? image(icon)
        sized.size = NSSize(width: 14, height: 14)
        sized.isTemplate = !icon.keepsColor
        menuCache[icon] = sized
        return sized
    }
}
