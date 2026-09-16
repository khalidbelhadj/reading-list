import SwiftUI

/// A frost card beside a hovered element. One card that glides to the
/// current anchor rather than one per row appearing and disappearing;
/// non-interactive so it never steals the hover from the row under it.
struct HoverCard<Content: View>: View {
    var width: CGFloat = 280
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) { content() }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .frame(maxWidth: width, alignment: .leading)
            .fixedSize(horizontal: true, vertical: true)
            .foregroundStyle(Theme.foreground)
            .frost(radius: Theme.radiusControl)
            .allowsHitTesting(false)
    }
}

// MARK: - Demo

private let hoverRows = [
    "A row with a short label",
    "Another row, whose card shows longer text than the row can hold",
    "A third row",
    "The fourth and last row",
]

private struct HoverCardDemo: View {
    @State private var hovered: Int?
    private let rowWidth: CGFloat = 256
    private let gap: CGFloat = 2

    var body: some View {
        VStack(alignment: .leading, spacing: gap) {
            ForEach(hoverRows.indices, id: \.self) { index in
                Text(hoverRows[index])
                    .textStyle(.body)
                    .fadeRight()
                    .padding(.horizontal, 8)
                    .frame(width: rowWidth, height: Theme.rowHeight, alignment: .leading)
                    .background(hovered == index ? Theme.fg(0.05) : .clear, in: Theme.controlShape)
                    .onHover { inside in
                        if inside { hovered = index } else if hovered == index { hovered = nil }
                    }
            }
        }
        .overlay(alignment: .topLeading) {
            if let hovered {
                HoverCard {
                    Text(hoverRows[hovered]).textStyle(.body)
                    Text("Row \(hovered + 1) of 4")
                        .textStyle(.small)
                        .foregroundStyle(Theme.mutedForeground)
                        .padding(.top, 4)
                }
                .offset(x: rowWidth + 8, y: CGFloat(hovered) * (Theme.rowHeight + gap))
                .transition(.opacity.combined(with: .scale(scale: 0.98)))
            }
        }
        .animation(.timingCurve(0.22, 1, 0.36, 1, duration: 0.18), value: hovered)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

extension Demo {
    static let hoverCard = Demo(
        "Hover card",
        description:
            "Hover the rows. One frost card beside the hovered element that glides to the next one instead of blinking."
    ) {
        HoverCardDemo()
    }
}
