import SwiftUI

/// A number with a handle. The leading label (or unit) is a scrub area:
/// press and drag it sideways to change the value, like a numeric field in
/// a design tool. Chevrons on the right step it; typing still works.
struct NumberInput: View {
    @Binding var value: Double
    var label: InputSlot?
    var range: ClosedRange<Double> = 0...1_000_000
    var step: Double = 1
    var largeStep: Double?
    /// Appended when displayed: "%".
    var suffix = ""
    var disabled = false
    /// For a field that floats over content, in a glass bar.
    var glass = false
    @State private var text = ""
    @State private var hovering = false
    @State private var dragStart: (x: CGFloat, value: Double)?

    var body: some View {
        HStack(spacing: 0) {
            if let label {
                label.view
                    .textStyle(.small)
                    .foregroundStyle(Theme.mutedForeground)
                    .padding(.leading, 10)
                    .padding(.trailing, 6)
                    .frame(maxHeight: .infinity)
                    .contentShape(Rectangle())
                    .pointerStyle(.columnResize)
                    .gesture(
                        DragGesture(minimumDistance: 1)
                            .onChanged { drag in
                                let start = dragStart ?? (drag.startLocation.x, value)
                                dragStart = start
                                let steps = Double(Int((drag.location.x - start.x) / 4))
                                set(
                                    start.value + steps
                                        * (NSEvent.modifierFlags.contains(.shift) ? (largeStep ?? step) : step))
                            }
                            .onEnded { _ in dragStart = nil }
                    )
            }
            TextField("", text: $text)
                .textFieldStyle(.plain)
                .font(Typography.sans(13))
                .monospacedDigit()
                .foregroundStyle(Theme.foreground)
                .focusEffectDisabled()
                .padding(.leading, label == nil ? 10 : 2)
                .onSubmit(commit)
            VStack(spacing: 0) {
                Stepper(icon: .chevronUp) { bump(1) }
                Stepper(icon: .chevronDown) { bump(-1) }
            }
            .padding(.trailing, 6)
        }
        .frame(height: 28)
        .background(glass ? Color.clear : Theme.fg(hovering ? 0.07 : 0.05), in: Theme.controlShape)
        .glassEffect(.regular, in: Theme.controlShape, when: glass)
        .opacity(disabled ? 0.5 : 1)
        .disabled(disabled)
        .onHover { hovering = $0 }
        .onAppear { text = format(value) }
        .onChange(of: value) { _, next in text = format(next) }
    }

    private func format(_ number: Double) -> String {
        let whole = step == step.rounded() && number == number.rounded()
        return (whole ? String(Int(number)) : String(number)) + suffix
    }

    private func commit() {
        let raw = text.replacingOccurrences(of: suffix, with: "").trimmingCharacters(in: .whitespaces)
        if let parsed = Double(raw) { set(parsed) } else { text = format(value) }
    }

    private func bump(_ direction: Double) {
        let amount = NSEvent.modifierFlags.contains(.shift) ? (largeStep ?? step) : step
        set(value + direction * amount)
    }

    private func set(_ next: Double) {
        value = min(max(next, range.lowerBound), range.upperBound)
    }
}

private struct Stepper: View {
    let icon: TablerIcon
    let action: () -> Void
    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            Icon(icon, size: 12)
                .foregroundStyle(hovering ? Theme.foreground : Theme.mutedForeground)
                .frame(width: 16, height: 12)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
    }
}

// MARK: - Demo

private struct NumberInputDemo: View {
    @State private var zoom = 125.0
    @State private var size = 13.0
    @State private var cards = 20.0
    @State private var tabs = 3.0

    var body: some View {
        HStack(alignment: .bottom, spacing: 16) {
            Field("Zoom") {
                NumberInput(value: $zoom, label: .icon(.zoomIn), range: 50...400, step: 5, largeStep: 25, suffix: "%")
                    .frame(width: 128)
            }
            Field("Text size") {
                NumberInput(value: $size, label: .icon(.letterCase), range: 10...24).frame(width: 112)
            }
            Field("Cards per session") {
                NumberInput(value: $cards, label: .text("Cards"), range: 5...200, step: 5).frame(width: 144)
            }
            Field("Disabled") {
                NumberInput(value: $tabs, label: .text("Tabs"), disabled: true).frame(width: 112)
            }
            NumberInput(
                value: $zoom, label: .icon(.zoomIn), range: 50...400, step: 5, largeStep: 25, suffix: "%", glass: true
            )
            .frame(width: 128)
            .padding(12)
            .background { DemoBackdrop().clipShape(Theme.surfaceShape) }
        }
    }
}

extension Demo {
    static let numberInput = Demo(
        "Number input",
        description:
            "A number with a handle: press the label and drag sideways to change it, click the chevrons to step, or type. Hold Shift while dragging or stepping for the large step."
    ) {
        NumberInputDemo()
    }
}
