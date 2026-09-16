import SwiftUI

/// The native slider in the app's accent: one value on a range (zoom, font
/// size). Labels and values live outside, in a Field.
struct KitSlider: View {
    @Binding var value: Double
    var range: ClosedRange<Double> = 0...100
    var step: Double = 1
    var disabled = false

    var body: some View {
        Slider(value: $value, in: range, step: step)
            .tint(Theme.primary)
            .disabled(disabled)
    }
}

// MARK: - Demo

private struct SliderDemo: View {
    @State private var zoom = 125.0
    @State private var size = 3.0
    @State private var fixed = 40.0

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Field("Zoom \(Int(zoom))%") { KitSlider(value: $zoom, range: 50...200, step: 5) }
            Field("Text size \(Int(size)) of 5") { KitSlider(value: $size, range: 1...5, step: 1) }
            Field("Disabled") { KitSlider(value: $fixed, disabled: true) }
        }
        .frame(width: 384)
    }
}

extension Demo {
    static let slider = Demo(
        "Slider",
        description: "The native slider, tinted with the accent. One value on a range."
    ) {
        SliderDemo()
    }
}
