import SwiftUI

/// A placeholder block the shape of what is loading. Size it with `frame`.
struct Skeleton: View {
    @State private var dim = false

    var body: some View {
        Theme.controlShape
            .fill(Theme.fg(0.06))
            .opacity(dim ? 0.5 : 1)
            .onAppear {
                withAnimation(.easeInOut(duration: 1).repeatForever(autoreverses: true)) {
                    dim = true
                }
            }
    }
}

/// Inline progress, for a button that is waiting on the server.
struct Spinner: View {
    @State private var spinning = false

    var body: some View {
        Icon(.loader2)
            .rotationEffect(.degrees(spinning ? 360 : 0))
            .onAppear {
                withAnimation(.linear(duration: 1).repeatForever(autoreverses: false)) {
                    spinning = true
                }
            }
            .accessibilityLabel("Loading")
    }
}

/// Four corner dots, pulsing clockwise in a staggered loop. For longer-lived
/// waits with their own presence (an agent working); inline button progress
/// stays with Spinner.
struct SquareSpinner: View {
    // Grid order TL, TR, BL, BR; the delay step makes the pulse travel clockwise.
    private let steps: [Double] = [0, 1, 3, 2]

    var body: some View {
        LazyVGrid(columns: [GridItem(.fixed(6), spacing: 2), GridItem(.fixed(6), spacing: 2)], spacing: 2) {
            ForEach(0..<4, id: \.self) { index in
                PulsingDot(delay: (steps[index]) * 0.15)
            }
        }
        .frame(width: 14, height: 14)
        .accessibilityLabel("Loading")
    }
}

private struct PulsingDot: View {
    let delay: Double
    @State private var lit = false

    var body: some View {
        Theme.shape(2)
            .fill(Theme.primary)
            .frame(width: 6, height: 6)
            .opacity(lit ? 1 : 0.25)
            .scaleEffect(lit ? 1 : 0.85)
            .onAppear {
                withAnimation(.easeInOut(duration: 0.6).repeatForever(autoreverses: true).delay(delay)) {
                    lit = true
                }
            }
    }
}

// MARK: - Demos

extension Demo {
    static let skeleton = Demo(
        "Skeleton",
        description: "Stands in for content while it loads; mirror the shape of what arrives."
    ) {
        VStack(alignment: .leading, spacing: 8) {
            Skeleton().frame(width: 288, height: 28)
            Skeleton().frame(width: 192, height: 16)
            Skeleton().frame(width: 384, height: Theme.rowHeight)
            Skeleton().frame(width: 384, height: Theme.rowHeight)
        }
    }

    static let spinner = Demo(
        "Spinner",
        description: "Inline progress. Inside a button it replaces the icon and the button stays disabled."
    ) {
        HStack(spacing: 12) {
            Spinner()
            Button(action: {}) {
                Spinner()
                Text("Starting")
            }.buttonStyle(.kit(.primary)).disabled(true)
            Button(action: {}) {
                Spinner()
                Text("Saving")
            }.buttonStyle(.kit(.secondary)).disabled(true)
        }
    }

    static let squareSpinner = Demo(
        "Square spinner",
        description:
            "Four dots pulsing clockwise. For longer-lived waits with their own presence, like an agent working; inline button progress stays with Spinner."
    ) {
        SquareSpinner()
    }
}
