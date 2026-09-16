import SwiftUI

/// The two kinds of surface the system has: opaque (cards, popovers,
/// dialogs) and frost (sidebars, floating panels over content or wallpaper).
/// There is no third kind; if something needs one, the answer is a
/// different layout.
struct Surface<Content: View>: View {
    enum Kind { case opaque, frost }
    enum Padding: CGFloat { case none = 0, sm = 12, md = 20, lg = 28 }

    var kind: Kind = .opaque
    var padding: Padding = .md
    @ViewBuilder let content: () -> Content

    init(kind: Kind = .opaque, padding: Padding = .md, @ViewBuilder content: @escaping () -> Content) {
        self.kind = kind
        self.padding = padding
        self.content = content
    }

    var body: some View {
        let inner = content()
            .padding(padding.rawValue)
            .foregroundStyle(Theme.foreground)
        switch kind {
        case .opaque:
            inner
                .background(Theme.card, in: Theme.surfaceShape)
                .surfaceEdge()
        case .frost:
            inner.frost()
        }
    }
}

// MARK: - Demo

private struct SurfaceContent: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Two Ways To Do Dynamic Dispatch")
                .textStyle(.title, .medium)
            Text("Besides method pointers, what else does a Rust trait object’s vtable typically store?")
                .textStyle(.body)
                .foregroundStyle(Theme.mutedForeground)
            HStack(spacing: 8) {
                Spacer()
                Button("Next") {}.buttonStyle(.kit(.ghost))
                Button("Flip") {}.buttonStyle(.kit(.primary))
            }
        }
    }
}

extension Demo {
    static let surface = Demo(
        "Surface",
        description:
            "Opaque for content that must be read (cards, popovers, dialogs); frost for chrome that sits over content or wallpaper (sidebar, floating panels)."
    ) {
        HStack(alignment: .top, spacing: 16) {
            Surface { SurfaceContent() }
            Surface(kind: .frost) { SurfaceContent() }
                .padding(16)
                .background { DemoBackdrop().clipShape(Theme.surfaceShape) }
        }
    }
}
