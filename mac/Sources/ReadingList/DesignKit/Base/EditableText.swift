import SwiftUI

/// Text that edits in place. It renders as whatever text it sits in (a
/// title, a row label, a URL): same font, size and wrapping, and nothing
/// happens on hover or focus beyond the text cursor and the caret. Enter
/// commits (single line), Escape reverts, blur commits.
struct EditableText: View {
    @Binding var text: String
    var placeholder = ""
    var multiline = false
    var onCommit: (String) -> Void = { _ in }
    @State private var valueBeforeEdit = ""
    @FocusState private var focused: Bool

    var body: some View {
        TextField(
            text: $text, prompt: Text(placeholder).foregroundStyle(Theme.mutedForeground),
            axis: multiline ? .vertical : .horizontal
        ) {
            Text(placeholder)
        }
        .textFieldStyle(.plain)
        .focusEffectDisabled()
        .focused($focused)
        .onChange(of: focused) { _, isFocused in
            if isFocused { valueBeforeEdit = text } else { onCommit(text) }
        }
        .onExitCommand {
            text = valueBeforeEdit
            focused = false
        }
        .onSubmit { if !multiline { focused = false } }
    }
}

// MARK: - Demo

private struct EditableTextDemo: View {
    @State private var title = "Two Ways To Do Dynamic Dispatch"
    @State private var url = "https://www.youtube.com/watch?v=x1npPrzyKfs"
    @State private var note = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            EditableText(text: $title, placeholder: "Untitled")
                .textStyle(.heading, .semibold)
                .tracking(-0.2)
            EditableText(text: $url, placeholder: "https://")
                .textStyle(.small)
                .foregroundStyle(Theme.mutedForeground)
            EditableText(text: $note, placeholder: "Add a short note", multiline: true)
                .textStyle(.body)
            Text("Click any line to edit it. Enter commits, Escape reverts; the note accepts new lines.")
                .textStyle(.small)
                .foregroundStyle(Theme.mutedForeground)
                .padding(.top, 8)
        }
        .frame(width: 448, alignment: .leading)
    }
}

extension Demo {
    static let editableText = Demo(
        "Editable text",
        description:
            "Text that edits in place: it keeps the type style it sits in and shows no chrome at all, only the text cursor. Titles, URLs, row labels."
    ) {
        EditableTextDemo()
    }
}
