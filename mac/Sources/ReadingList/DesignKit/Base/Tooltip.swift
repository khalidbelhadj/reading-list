import SwiftUI

extension View {
    /// Hover hint on a single element: the system tooltip. Never the only
    /// place a label lives.
    func tooltip(_ text: String) -> some View {
        help(text)
    }
}

// MARK: - Demo

extension Demo {
    static let tooltip = Demo(
        "Tooltip",
        description: "Hover the buttons. The system tooltip, small text; never the only place a label lives."
    ) {
        HStack(spacing: 8) {
            Button(action: {}) { Icon(.pin) }
                .buttonStyle(.kit(.ghost, .iconMd))
                .tooltip("Pin to the top")
                .accessibilityLabel("Pin")
            Button(action: {}) { Icon(.trash) }
                .buttonStyle(.kit(.ghost, .iconMd))
                .tooltip("Delete ⌘⌫")
                .accessibilityLabel("Delete")
            Button("Review") {}
                .buttonStyle(.kit(.secondary))
                .tooltip("Opens in a new window")
        }
    }
}
