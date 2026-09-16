import SwiftUI

/// A key cap inside buttons, tooltips and menus. `onPrimary` is for sitting
/// inside the accent button, where the neutral fill would vanish.
struct Kbd: View {
    enum Variant { case neutral, onPrimary }

    let keys: String
    var variant: Variant = .neutral

    init(_ keys: String, variant: Variant = .neutral) {
        self.keys = keys
        self.variant = variant
    }

    var body: some View {
        Text(keys)
            .textStyle(.micro, .medium)
            .foregroundStyle(variant == .neutral ? Theme.mutedForeground : Theme.primaryForeground.opacity(0.9))
            .padding(.horizontal, 4)
            .frame(minWidth: 18)
            .frame(height: 18)
            .background(
                variant == .neutral ? Theme.fg(0.07) : Theme.primaryForeground.opacity(0.15),
                in: Theme.shape(Theme.radiusControl - 5)
            )
            .fixedSize()
    }
}

// MARK: - Demo

extension Demo {
    static let kbd = Demo(
        "Kbd",
        description: "Shortcut hints. Alone, beside a label, or inside a button."
    ) {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 8) {
                Kbd("⌘")
                Kbd("K")
                Kbd("Space")
                Kbd("Esc")
            }
            HStack(spacing: 8) {
                Button(action: {}) {
                    Text("Flip")
                    Kbd("Space")
                }.buttonStyle(.kit(.secondary))
                Button(action: {}) {
                    Text("Reveal")
                    Kbd("Space", variant: .onPrimary)
                }.buttonStyle(.kit(.primary))
            }
        }
    }
}
