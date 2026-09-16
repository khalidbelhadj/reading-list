import AppKit
import SwiftUI

/// What sits inside an Input on either side: an icon, a key cap, a short
/// label. Decorative, so the field itself stays the target.
enum InputSlot {
    case icon(TablerIcon)
    case kbd(String)
    case text(String)

    @MainActor @ViewBuilder
    var view: some View {
        switch self {
        case .icon(let icon): Icon(icon, size: 14)
        case .kbd(let keys): Kbd(keys)
        case .text(let text): Text(text).textStyle(.small)
        }
    }
}

/// Text field. A quiet fill at rest and while focused (the caret is the
/// focus indicator, no ring). `leading` and `trailing` put an icon, a key
/// cap or a short label inside the field on either side. `glass` is for a
/// field that floats over content (a toolbar search, the palette).
struct Input: View {
    @Binding var text: String
    var placeholder = ""
    var leading: InputSlot?
    var trailing: InputSlot?
    var invalid = false
    var disabled = false
    var glass = false
    /// Take focus on appear (the palette's search field).
    var autofocus = false
    /// With `autofocus`, select the whole value so typing replaces it.
    var selectAll = false
    var onSubmit: () -> Void = {}
    @State private var hovering = false
    @FocusState private var focused: Bool

    var body: some View {
        HStack(spacing: 8) {
            if let leading {
                leading.view.foregroundStyle(Theme.mutedForeground)
            }
            TextField(text: $text, prompt: Text(placeholder).foregroundStyle(Theme.mutedForeground)) {
                Text(placeholder)
            }
            .textFieldStyle(.plain)
            .font(Typography.sans(13))
            .foregroundStyle(Theme.foreground)
            .focusEffectDisabled()
            .focused($focused)
            .onSubmit(onSubmit)
            if let trailing {
                trailing.view.foregroundStyle(Theme.mutedForeground)
            }
        }
        .padding(.horizontal, 10)
        .frame(height: 28)
        .background(glass ? Color.clear : Theme.fg(hovering ? 0.07 : 0.05), in: Theme.controlShape)
        .glassEffect(.regular, in: Theme.controlShape, when: glass)
        .overlay(invalid ? Theme.controlShape.strokeBorder(Theme.destructive.opacity(0.4), lineWidth: 2) : nil)
        .opacity(disabled ? 0.5 : 1)
        .disabled(disabled)
        .onHover { hovering = $0 }
        .onAppear {
            guard autofocus else { return }
            // The field is not in the window yet on appear; take focus a beat later.
            Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(60))
                focused = true
                if selectAll {
                    try? await Task.sleep(for: .milliseconds(30))
                    NSApp.sendAction(#selector(NSText.selectAll(_:)), to: nil, from: nil)
                }
            }
        }
    }
}

/// Multi-line text. Same surface as Input; grows with `rows`, never with a
/// drag handle.
struct Textarea: View {
    @Binding var text: String
    var placeholder = ""
    var rows = 3
    var disabled = false
    @State private var hovering = false

    var body: some View {
        TextEditor(text: $text)
            .font(Typography.sans(13))
            .foregroundStyle(Theme.foreground)
            .scrollContentBackground(.hidden)
            .scrollDisabled(true)
            .padding(.horizontal, 6)
            .padding(.vertical, 8)
            .frame(height: CGFloat(rows) * TextStyle.body.lineHeight + 16)
            .overlay(alignment: .topLeading) {
                if text.isEmpty {
                    Text(placeholder)
                        .textStyle(.body)
                        .foregroundStyle(Theme.mutedForeground)
                        .padding(.horizontal, 11)
                        .padding(.vertical, 8)
                        .allowsHitTesting(false)
                }
            }
            .background(Theme.fg(hovering ? 0.07 : 0.05), in: Theme.controlShape)
            .opacity(disabled ? 0.5 : 1)
            .disabled(disabled)
            .onHover { hovering = $0 }
    }
}

// MARK: - Demos

private struct InputDemo: View {
    @State private var title = "Two Ways To Do Dynamic Dispatch"
    @State private var search = ""
    @State private var url = ""
    @State private var factor = "1.25"
    @State private var invalid = "not a url"
    @State private var readOnly = "Read only"

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Input(text: $title, placeholder: "Untitled")
            Input(text: $search, placeholder: "Search", leading: .icon(.search), trailing: .kbd("⌘K"))
            Input(text: $url, placeholder: "https://", leading: .icon(.link))
            Input(text: $factor, trailing: .text("×"))
                .frame(width: 96)
            Field("Invalid") { Input(text: $invalid, invalid: true) }
            Field("Disabled") { Input(text: $readOnly, disabled: true) }
            Input(text: $search, placeholder: "Search", leading: .icon(.search), trailing: .kbd("⌘K"), glass: true)
                .padding(12)
                .background { DemoBackdrop().clipShape(Theme.surfaceShape) }
        }
        .frame(width: 384)
    }
}

private struct TextareaDemo: View {
    @State private var back = "The size and alignment of the concrete type, and a drop pointer."
    @State private var readOnly = "Read only"

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Field("Back") { Textarea(text: $back, placeholder: "The answer", rows: 3) }
            Field("Disabled") { Textarea(text: $readOnly, rows: 2, disabled: true) }
        }
        .frame(width: 384)
    }
}

extension Demo {
    static let input = Demo(
        "Input",
        description:
            "A quiet fill at rest, ring on focus. Leading and trailing slots hold an icon, a key cap or a unit inside the field. Glass when the field floats over content."
    ) {
        InputDemo()
    }

    static let textarea = Demo(
        "Textarea",
        description: "For short free text (a card's back, a note). Long-form notes use the editor."
    ) {
        TextareaDemo()
    }
}
