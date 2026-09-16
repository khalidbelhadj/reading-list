import SwiftUI

/// A labelled row of examples ("Variants", "Sizes"): the web demos' `Row`.
struct DemoRow<Content: View>: View {
    let label: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            Text(label)
                .textStyle(.small)
                .foregroundStyle(Theme.mutedForeground)
                .frame(width: 96, alignment: .leading)
            HStack(spacing: 8) { content() }
        }
    }
}

/// The busy backdrop the frost demos sit on (the wallpaper stand-in).
struct DemoBackdrop: View {
    var body: some View {
        ZStack {
            Color(nsColor: oklch(0.93, 0.02, 80).nsColor)
            RadialGradient(
                colors: [Color(nsColor: oklch(0.78, 0.12, 60).nsColor), .clear],
                center: UnitPoint(x: 0.2, y: 0.1), startRadius: 0, endRadius: 420
            )
            RadialGradient(
                colors: [Color(nsColor: oklch(0.7, 0.1, 128).nsColor), .clear],
                center: UnitPoint(x: 0.85, y: 0.8), startRadius: 0, endRadius: 360
            )
        }
    }
}

/// The web's `fade-r`: a long single line fades out at its right edge
/// instead of ending in an ellipsis.
struct FadeRight: ViewModifier {
    func body(content: Content) -> some View {
        content
            .lineLimit(1)
            .truncationMode(.tail)
            .frame(maxWidth: .infinity, alignment: .leading)
            .mask(
                HStack(spacing: 0) {
                    Rectangle()
                    LinearGradient(colors: [.black, .clear], startPoint: .leading, endPoint: .trailing)
                        .frame(width: 24)
                }
            )
    }
}

extension View {
    func fadeRight() -> some View { modifier(FadeRight()) }
}
