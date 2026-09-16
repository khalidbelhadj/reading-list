import SwiftUI

/// The native checkbox in the app's accent. For choosing several of a set,
/// or for a task list; a single yes/no setting is a Switch.
struct Checkbox: View {
    @Binding var isOn: Bool
    var disabled = false

    var body: some View {
        Toggle("", isOn: $isOn)
            .toggleStyle(.checkbox)
            .labelsHidden()
            .tint(Theme.primary)
            .disabled(disabled)
    }
}

/// The native switch in the app's accent. On/off for a setting that takes
/// effect immediately.
struct KitSwitch: View {
    @Binding var isOn: Bool
    var disabled = false

    var body: some View {
        Toggle("", isOn: $isOn)
            .toggleStyle(.switch)
            .labelsHidden()
            .tint(Theme.primary)
            .disabled(disabled)
    }
}

// MARK: - Demos

private struct CheckboxDemo: View {
    @State private var articles = true
    @State private var videos = false
    @State private var papers = true
    @State private var archived = false

    private func row(_ label: String, _ box: some View) -> some View {
        HStack(spacing: 10) {
            box
            Text(label).textStyle(.body)
        }
        .frame(height: Theme.rowHeight)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            row("Articles", Checkbox(isOn: $articles))
            row("Videos", Checkbox(isOn: $videos))
            row("Papers", Checkbox(isOn: $papers))
            row("Archived", Checkbox(isOn: $archived, disabled: true))
        }
    }
}

private struct SwitchDemo: View {
    @State private var newWindow = true
    @State private var showRead = false
    @State private var suggestions = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Field("Reviews in a new window", orientation: .horizontal) { KitSwitch(isOn: $newWindow) }
            Field("Show read items", orientation: .horizontal) { KitSwitch(isOn: $showRead) }
            Field("Suggestions", hint: "Needs the embedding index", orientation: .horizontal) {
                KitSwitch(isOn: $suggestions, disabled: true)
            }
        }
        .frame(width: 384)
    }
}

extension Demo {
    static let checkbox = Demo(
        "Checkbox",
        description:
            "The native checkbox, tinted with the accent. For choosing several of a set, or for a task list. A single yes/no setting is a Switch."
    ) {
        CheckboxDemo()
    }

    static let kitSwitch = Demo(
        "Switch",
        description:
            "The native switch, tinted with the accent. A setting that takes effect immediately. Label on the left, control on the right, one per row."
    ) {
        SwitchDemo()
    }
}
