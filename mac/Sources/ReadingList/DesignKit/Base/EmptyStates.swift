import SwiftUI

/// The block behind every empty, error and not-found moment: a title, a quiet
/// line of context, and optionally the one action that resolves it.
struct EmptyState<Action: View>: View {
    enum Tone { case standard, error }
    enum Alignment { case start, center }

    let title: String
    var description: String?
    var tone: Tone = .standard
    var alignment: Alignment = .center
    @ViewBuilder var action: () -> Action

    var body: some View {
        VStack(alignment: alignment == .center ? .center : .leading, spacing: 4) {
            Text(title)
                .textStyle(.body, .medium)
                .foregroundStyle(tone == .error ? Theme.destructive : Theme.foreground)
            if let description {
                Text(description)
                    .textStyle(.body)
                    .foregroundStyle(tone == .error ? Theme.destructive.opacity(0.7) : Theme.mutedForeground)
                    .frame(maxWidth: 320)
            }
            action().padding(.top, 12)
        }
        .multilineTextAlignment(alignment == .center ? .center : .leading)
    }
}

extension EmptyState where Action == EmptyView {
    init(title: String, description: String? = nil, tone: Tone = .standard, alignment: Alignment = .center) {
        self.init(title: title, description: description, tone: tone, alignment: alignment, action: { EmptyView() })
    }
}

/// Title + faint description + actions, behind every empty, error and
/// not-found surface. Standalone pages use the lg size; embedded empty
/// states use sm.
struct NonIdealState<Actions: View>: View {
    enum Size { case sm, lg }

    var title: String?
    var description: String?
    var tone: EmptyState<EmptyView>.Tone = .standard
    var alignment: EmptyState<EmptyView>.Alignment = .start
    var size: Size = .lg
    @ViewBuilder var actions: () -> Actions

    var body: some View {
        let isError = tone == .error
        VStack(alignment: alignment == .center ? .center : .leading, spacing: 16) {
            VStack(alignment: alignment == .center ? .center : .leading, spacing: 4) {
                if let title {
                    Text(title)
                        .textStyle(size == .lg ? .title : .body)
                        .foregroundStyle(isError ? Theme.destructive : Theme.foreground)
                }
                if let description {
                    Text(description)
                        .textStyle(.body)
                        .foregroundStyle(isError ? Theme.destructive.opacity(0.7) : Theme.mutedForeground)
                }
            }
            HStack(spacing: 8) { actions() }
        }
        .frame(maxWidth: 448, alignment: alignment == .center ? .center : .leading)
        .multilineTextAlignment(alignment == .center ? .center : .leading)
    }
}

// MARK: - Demos

extension Demo {
    static let emptyState = Demo(
        "Empty state",
        description:
            "Empty, error and not-found share one block. Say what is missing, then the one thing to do about it."
    ) {
        HStack(alignment: .top, spacing: 16) {
            Surface {
                EmptyState(title: "No flashcards yet", description: "Cards you add to items will collect here.")
                    .frame(maxWidth: .infinity, minHeight: 120)
            }
            Surface {
                EmptyState(title: "Couldn't load a card", description: "Try again in a moment.", tone: .error) {
                    Button("Retry") {}.buttonStyle(.kit(.secondary))
                }
                .frame(maxWidth: .infinity, minHeight: 120)
            }
            Surface {
                EmptyState(title: "Item not found", description: "It may have been deleted on another device.") {
                    Button("Back home") {}.buttonStyle(.kit(.secondary))
                }
                .frame(maxWidth: .infinity, minHeight: 120)
            }
        }
    }

    static let nonIdealState = Demo(
        "Non-ideal state",
        description:
            "Title + faint description + actions, behind every empty, error, and not-found surface. Standalone pages use the lg size; embedded empty states use sm."
    ) {
        VStack(alignment: .leading, spacing: 32) {
            NonIdealState(
                title: "Page not found", description: "The page you are looking for does not exist or has moved."
            ) {
                Button("Back to your list") {}.buttonStyle(.kit(.primary))
            }
            NonIdealState(title: "Something went wrong", description: "Could not load items.", tone: .error, size: .sm)
            {
                Button("Retry") {}.buttonStyle(.kit(.secondary, .sm))
            }
        }
    }
}
