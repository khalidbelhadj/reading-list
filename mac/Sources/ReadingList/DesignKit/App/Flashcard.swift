import AppKit
import SwiftUI

/// One side of the card: rendered markdown that becomes a plain editing
/// field on click (when editable). There is no edit mode; the card is
/// simply always a card. A click anywhere outside the field commits the
/// edit (clicking empty space would not move focus by itself); Esc reverts.
private struct CardSide: View {
    @Binding var text: String
    let placeholder: String
    let editable: Bool
    let style: TextStyle
    let weight: Typography.Weight
    let color: Color
    /// The end of an edit: the save point.
    var onCommit: (() -> Void)?
    @State private var editing = false
    @State private var original = ""
    @State private var selection: TextSelection?
    @State private var frame: CGRect = .zero
    @State private var monitor: Any?
    @FocusState private var focused: Bool

    var body: some View {
        if editable, editing {
            TextField(
                "", text: $text, selection: $selection,
                prompt: Text(placeholder).foregroundStyle(Theme.mutedForeground.opacity(0.6)), axis: .vertical
            )
            .textFieldStyle(.plain)
            .focusEffectDisabled()
            .textStyle(style, weight)
            .foregroundStyle(color)
            .focused($focused)
            .onGeometryChange(for: CGRect.self) {
                $0.frame(in: .global)
            } action: {
                frame = $0
            }
            .onAppear {
                focused = true
                // The caret goes to the end; focusing would otherwise select
                // everything, and the first keystroke would replace the side.
                selection = TextSelection(insertionPoint: text.endIndex)
                watch()
            }
            .onDisappear(perform: unwatch)
            .onChange(of: focused) { _, isFocused in if !isFocused { finish() } }
        } else if text.trimmingCharacters(in: .whitespaces).isEmpty {
            Text(placeholder)
                .textStyle(style, weight)
                .foregroundStyle(Theme.mutedForeground.opacity(0.6))
                .contentShape(Rectangle())
                .onTapGesture { if editable { begin() } }
        } else {
            MarkdownInline(text: text)
                .textStyle(style, weight)
                .foregroundStyle(color)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
                .onTapGesture { if editable { begin() } }
        }
    }

    private func begin() {
        original = text
        editing = true
    }

    private func finish() {
        guard editing else { return }
        editing = false
        unwatch()
        onCommit?()
    }

    /// While editing: a click outside the field ends the edit, Esc reverts
    /// it. Ending the edit removes the field, which also gives up focus.
    private func watch() {
        guard monitor == nil else { return }
        monitor = NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown, .keyDown]) { event in
            let swallow = MainActor.assumeIsolated { () -> Bool in
                if event.type == .keyDown {
                    guard event.keyCode == 53 else { return false }
                    text = original
                    finish()
                    return true
                }
                // The field's frame is in SwiftUI's flipped window space.
                guard let window = event.window, let view = window.contentView else { return false }
                let point = view.convert(event.locationInWindow, from: nil)
                let flipped = CGPoint(x: point.x, y: view.bounds.height - point.y)
                if !frame.contains(flipped) { finish() }
                return false
            }
            return swallow ? nil : event
        }
    }

    private func unwatch() {
        if let monitor { NSEvent.removeMonitor(monitor) }
        monitor = nil
    }
}

/// The flashcard ("Sheet"): one quiet surface, the answer unfolding beneath
/// the front behind a hairline. Sides render markdown and edit in place on
/// click. Reveal is click-to-toggle on the hint, or controlled by review.
struct Flashcard: View {
    enum Scale { case review, list }

    @Binding var front: String
    @Binding var back: String
    var scale: Scale = .list
    var editable = true
    var revealed: Binding<Bool>?
    /// Fired when an in-place edit of either side ends (the save point).
    var onCommit: (() -> Void)?
    @State private var internalRevealed = false

    private var isRevealed: Bool { revealed?.wrappedValue ?? internalRevealed }

    var body: some View {
        VStack(alignment: .leading, spacing: scale == .review ? 12 : 8) {
            CardSide(
                text: $front, placeholder: "Front", editable: editable, style: scale == .review ? .title : .body,
                weight: .medium, color: Theme.foreground, onCommit: onCommit)
            if isRevealed {
                Rectangle().fill(Theme.fg(0.1)).frame(height: 1)
                CardSide(
                    text: $back, placeholder: "Back", editable: editable, style: scale == .review ? .body : .small,
                    weight: .regular, color: Theme.mutedForeground, onCommit: onCommit)
            } else {
                Text("Show answer")
                    .textStyle(.small)
                    .foregroundStyle(Theme.mutedForeground.opacity(0.6))
                    .contentShape(Rectangle())
                    .onTapGesture {
                        internalRevealed = true
                        revealed?.wrappedValue = true
                    }
            }
        }
        .padding(scale == .review ? 24 : 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.fg(0.03), in: Theme.surfaceShape)
    }
}

// MARK: - Demos

private let cardFront = "What does the MESI protocol's **E (Exclusive)** state guarantee?"
private let cardBack =
    "The line is present only in this cache and matches memory, so it can be written without a bus transaction."

private struct FlashcardDemo: View {
    @State private var front1 = cardFront
    @State private var back1 = cardBack
    @State private var front2 = cardFront
    @State private var back2 = cardBack

    var body: some View {
        VStack(spacing: 12) {
            Flashcard(front: $front1, back: $back1, scale: .review)
            Flashcard(front: $front2, back: $back2)
        }
        .frame(width: 384)
    }
}

private let cardNoteSample = """
    Some notes above the card.

    <card id="demo1234">
    <front>
    What does the MESI protocol's **E (Exclusive)** state guarantee?
    </front>
    <back>
    The line is present only in this cache and matches memory, so it can be written without a bus transaction.
    </back>
    </card>

    And notes continue after it. Insert a new card with Cmd+Shift+C; Tab hops between front and back.
    """

private struct FlashcardNodeDemo: View {
    var body: some View {
        MarkdownView(text: cardNoteSample) { front, back in
            AnyView(Flashcard(front: .constant(front), back: .constant(back), editable: false))
        }
        .frame(width: 480)
    }
}

extension Demo {
    static let flashcard = Demo(
        "Flashcard", section: .app,
        description:
            "The Sheet card. Sides render markdown and edit in place: click into the text, blur commits; there is no edit mode. Reveal by clicking Show answer, or controlled by the review session."
    ) {
        FlashcardDemo()
    }

    static let flashcardNode = Demo(
        "Flashcard node", section: .app,
        description: "The <card> block inside the notes, styled as the Sheet card, with the notes continuing around it."
    ) {
        FlashcardNodeDemo()
    }
}
