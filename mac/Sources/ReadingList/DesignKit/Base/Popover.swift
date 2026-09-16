import SwiftUI

/// The content of a quick confirm or compact form, anchored to its trigger
/// through the system popover (glass, with its arrow). Anything that needs
/// the user's full attention is a Dialog.
struct PopoverContent<Actions: View, Content: View>: View {
    let title: String
    var description: String?
    @ViewBuilder let actions: () -> Actions
    @ViewBuilder let content: () -> Content

    init(
        title: String, description: String? = nil, @ViewBuilder actions: @escaping () -> Actions,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.description = description
        self.actions = actions
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).textStyle(.title, .medium)
            if let description {
                Text(description)
                    .textStyle(.body)
                    .foregroundStyle(Theme.mutedForeground)
            }
            content()
            HStack(spacing: 8) {
                Spacer(minLength: 0)
                actions()
            }
            .padding(.top, 4)
        }
        .padding(16)
        .frame(width: 288, alignment: .leading)
        .font(Typography.sans(13))
        .foregroundStyle(Theme.foreground)
    }
}

extension PopoverContent where Content == EmptyView {
    init(title: String, description: String? = nil, @ViewBuilder actions: @escaping () -> Actions) {
        self.init(title: title, description: description, actions: actions, content: { EmptyView() })
    }
}

// MARK: - Demo

private struct PopoverDemo: View {
    @State private var open = false

    var body: some View {
        Button(action: { open = true }) {
            Text("Review 110")
            Kbd("R")
        }
        .buttonStyle(.kit(.secondary))
        .accessibilityIdentifier("popover.trigger")
        .popover(isPresented: $open, arrowEdge: .bottom) {
            PopoverContent(
                title: "Review 110 cards?", description: "Runs in a new window. You can end the session at any time."
            ) {
                Button("Not now") { open = false }.buttonStyle(.kit(.ghost))
                Button("Start") { open = false }.buttonStyle(.kit(.primary))
            }
        }
    }
}

extension Demo {
    static let popover = Demo(
        "Popover",
        description: "A quick confirm or a compact form anchored to its trigger. For anything bigger, use Dialog."
    ) {
        PopoverDemo()
    }
}
