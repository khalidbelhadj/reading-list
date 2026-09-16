import SwiftUI

/// Label, control, and a line of hint or error underneath. Vertical is the
/// form default; horizontal puts the label left and the control right, for
/// settings rows with a Switch or a Select.
struct Field<Content: View>: View {
    enum Orientation { case vertical, horizontal }

    let label: String
    var hint: String?
    var error: String?
    var orientation: Orientation = .vertical
    @ViewBuilder let content: () -> Content

    init(
        _ label: String, hint: String? = nil, error: String? = nil, orientation: Orientation = .vertical,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.label = label
        self.hint = hint
        self.error = error
        self.orientation = orientation
        self.content = content
    }

    private var note: String? { error ?? hint }

    var body: some View {
        switch orientation {
        case .vertical:
            VStack(alignment: .leading, spacing: 6) {
                Text(label)
                    .textStyle(.small, .medium)
                    .foregroundStyle(Theme.mutedForeground)
                content()
                if let note {
                    Text(note)
                        .textStyle(.small)
                        .foregroundStyle(error != nil ? Theme.destructive : Theme.mutedForeground)
                }
            }
        case .horizontal:
            HStack(alignment: .center, spacing: 24) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(label)
                        .textStyle(.body)
                        .foregroundStyle(Theme.foreground)
                    if let note {
                        Text(note)
                            .textStyle(.small)
                            .foregroundStyle(error != nil ? Theme.destructive : Theme.mutedForeground)
                    }
                }
                Spacer(minLength: 0)
                content()
            }
            .frame(minHeight: Theme.rowHeight)
        }
    }
}

// MARK: - Demo

private struct FieldDemo: View {
    @State private var title = "Two Ways To Do Dynamic Dispatch"
    @State private var url = ""
    @State private var bad = "not a url"
    @State private var newWindow = true
    @State private var suggestions = false

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Field("Title") { Input(text: $title) }
            Field("URL", hint: "Paste a link and the title fills itself in.") {
                Input(text: $url, placeholder: "https://")
            }
            Field("URL", error: "That does not look like a link.") { Input(text: $bad, invalid: true) }
            VStack(alignment: .leading, spacing: 8) {
                Field("Reviews in a new window", orientation: .horizontal) { KitSwitch(isOn: $newWindow) }
                Field("Suggestions", hint: "Needs the embedding index", orientation: .horizontal) {
                    KitSwitch(isOn: $suggestions, disabled: true)
                }
            }
            .padding(.top, 8)
        }
        .frame(width: 384)
    }
}

extension Demo {
    static let field = Demo(
        "Field",
        description:
            "Label, control, hint or error. Vertical for forms; horizontal for settings rows where the control sits on the right."
    ) {
        FieldDemo()
    }
}
