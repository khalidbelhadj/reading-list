import SwiftUI

/// Small status label: Due, New, a tag. Neutral by default; accent only for
/// the one state that matters right now (a due card); outline for tags;
/// glass when it floats over content.
struct Badge<Content: View>: View {
    enum Variant { case neutral, accent, outline, glass }

    var variant: Variant = .neutral
    @ViewBuilder let content: () -> Content

    init(variant: Variant = .neutral, @ViewBuilder content: @escaping () -> Content) {
        self.variant = variant
        self.content = content
    }

    var body: some View {
        HStack(spacing: 4) { content() }
            .textStyle(.micro, .medium)
            .foregroundStyle(foreground)
            .padding(.horizontal, 6)
            .frame(height: 20)
            .background(background, in: Theme.shape(Theme.radiusControl - 4))
            .glassEffect(.regular, in: Theme.shape(Theme.radiusControl - 4), when: variant == .glass)
            .overlay(
                variant == .outline
                    ? Theme.shape(Theme.radiusControl - 4).strokeBorder(Theme.border, lineWidth: 1)
                    : nil
            )
            .environment(\.iconSize, 12)
            .fixedSize()
    }

    private var foreground: Color {
        switch variant {
        case .neutral: Theme.foreground.opacity(0.8)
        case .accent: Theme.primary
        case .outline: Theme.mutedForeground
        case .glass: Theme.foreground
        }
    }

    private var background: Color {
        switch variant {
        case .neutral: Theme.fg(0.07)
        case .accent: Theme.primary.opacity(0.2)
        case .outline, .glass: .clear
        }
    }
}

extension Badge where Content == Text {
    init(_ text: String, variant: Variant = .neutral) {
        self.init(variant: variant) { Text(text) }
    }
}

// MARK: - Demo

extension Demo {
    static let badge = Demo(
        "Badge",
        description: "Neutral for state, accent for the one state that matters now, outline for tags."
    ) {
        HStack(spacing: 8) {
            Badge("New")
            Badge("Due", variant: .accent)
            Badge(variant: .accent) {
                Icon(.clock)
                Text("110 due")
            }
            Badge("distributed systems", variant: .outline)
            Badge("rust", variant: .outline)
            Badge("Glass", variant: .glass)
                .padding(8)
                .background { DemoBackdrop().clipShape(Theme.controlShape) }
        }
    }
}
