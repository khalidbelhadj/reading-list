import SwiftUI

struct SegmentedOption<Value: Hashable>: Identifiable {
    let value: Value
    let label: String
    var disabled = false
    var id: Value { value }
}

/// One-of-few choice shown in full: a quiet track with the chosen segment
/// raised. Two to five options; more than that is a Select.
struct SegmentedControl<Value: Hashable>: View {
    @Binding var selection: Value
    let options: [SegmentedOption<Value>]
    /// For a control that lives in a toolbar or floats over content.
    var glass = false

    var body: some View {
        HStack(spacing: 2) {
            ForEach(options) { option in
                Segment(label: option.label, selected: option.value == selection, disabled: option.disabled) {
                    selection = option.value
                }
            }
        }
        .padding(2)
        .frame(height: 28)
        .background(glass ? Color.clear : Theme.fg(0.05), in: Theme.controlShape)
        .glassEffect(.regular, in: Theme.controlShape, when: glass)
        .fixedSize()
    }
}

private struct Segment: View {
    let label: String
    let selected: Bool
    let disabled: Bool
    let action: () -> Void
    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(Typography.sans(13, .medium))
                .foregroundStyle(selected || hovering ? Theme.foreground : Theme.mutedForeground)
                .padding(.horizontal, 10)
                .frame(maxHeight: .infinity)
                .background(selected ? Theme.background : .clear, in: Theme.shape(Theme.radiusControl - 2))
                .shadow(color: .black.opacity(selected ? 0.08 : 0), radius: 1, y: 1)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .opacity(disabled ? 0.5 : 1)
        .disabled(disabled)
        .onHover { hovering = $0 }
    }
}

// MARK: - Demo

private struct SegmentedDemo: View {
    @State private var density = "compact"
    @State private var theme = "system"
    @State private var mode = "due"

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            SegmentedControl(
                selection: $density,
                options: [
                    SegmentedOption(value: "compact", label: "Compact"),
                    SegmentedOption(value: "cozy", label: "Cozy"),
                ])
            SegmentedControl(
                selection: $theme,
                options: [
                    SegmentedOption(value: "system", label: "System"),
                    SegmentedOption(value: "light", label: "Light"),
                    SegmentedOption(value: "dark", label: "Dark"),
                ])
            SegmentedControl(
                selection: $mode,
                options: [
                    SegmentedOption(value: "due", label: "Due"),
                    SegmentedOption(value: "new", label: "New"),
                    SegmentedOption(value: "cram", label: "Cram", disabled: true),
                ])
            SegmentedControl(
                selection: $theme,
                options: [
                    SegmentedOption(value: "system", label: "System"),
                    SegmentedOption(value: "light", label: "Light"),
                    SegmentedOption(value: "dark", label: "Dark"),
                ], glass: true
            )
            .padding(12)
            .background { DemoBackdrop().clipShape(Theme.surfaceShape) }
        }
    }
}

extension Demo {
    static let segmentedControl = Demo(
        "Segmented control",
        description:
            "A one-of-few choice shown in full. Two to five options; beyond that, use Select. Glass when it sits in a toolbar."
    ) {
        SegmentedDemo()
    }
}
