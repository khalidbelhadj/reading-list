import SwiftUI

/// An inline text link. Default is underlined in the running text; `quiet`
/// is for secondary links in meta rows (muted, foreground on hover);
/// `accent` for the one link that is the point of the sentence.
struct TextLink<Content: View>: View {
    enum Variant { case standard, quiet, accent }

    var variant: Variant = .standard
    let action: () -> Void
    @ViewBuilder let content: () -> Content
    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 2) { content() }
                .foregroundStyle(color)
                .underline(underlined, color: underlineColor)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
        .animation(Theme.stateMotion, value: hovering)
    }

    private var color: Color {
        switch variant {
        case .standard: Theme.foreground
        case .quiet: hovering ? Theme.foreground : Theme.mutedForeground
        case .accent: Theme.link
        }
    }

    private var underlined: Bool {
        switch variant {
        case .standard: true
        case .quiet: false
        case .accent: hovering
        }
    }

    private var underlineColor: Color {
        variant == .standard ? Theme.foreground.opacity(hovering ? 1 : 0.3) : Theme.link
    }
}

extension TextLink where Content == Text {
    init(_ title: String, variant: Variant = .standard, action: @escaping () -> Void) {
        self.init(variant: variant, action: action) { Text(title) }
    }
}

// MARK: - Demo

extension Demo {
    static let link = Demo(
        "Link",
        description:
            "Inline text links. Underlined in running text, quiet in meta rows, accent when the link is the point."
    ) {
        VStack(alignment: .leading, spacing: 16) {
            Text(
                "Besides method pointers, a vtable stores the size and alignment of the concrete type, as \(Text("the Rust reference").underline(true, color: Theme.foreground.opacity(0.3))) explains."
            )
            .textStyle(.body)
            .frame(width: 448, alignment: .leading)
            HStack(spacing: 16) {
                TextLink(variant: .quiet, action: {}) {
                    Text("All 198")
                    Icon(.chevronRight, size: 12)
                }
                TextLink("Open item", variant: .quiet) {}
                TextLink("Start review", variant: .accent) {}
            }
            .textStyle(.small)
        }
    }
}
