import SwiftUI

/// What the item menu needs to know about its item.
struct ItemMenuState {
    var read = false
    var starred = false
    var hiddenFromReview = false
    var url = ""
    var flashcardCount = 0
}

/// The menu's items, shared by the right-click menu on rows and the
/// dropdown in the item view: one vocabulary of actions everywhere.
/// Presentation only; callers own the mutations.
struct ItemMenuItems: View {
    let item: ItemMenuState
    var onToggleRead: () -> Void = {}
    var onToggleStar: () -> Void = {}
    var onToggleHidden: () -> Void = {}
    var onDelete: () -> Void = {}
    var onOpenLink: () -> Void = {}
    var onCopyLink: () -> Void = {}
    var onEditLink: (() -> Void)?
    var onReviewItem: (() -> Void)?
    var onChatWithClaude: () -> Void = {}

    var body: some View {
        Button(action: onOpenLink) { MenuLabel("Open link", .externalLink) }
            .disabled(item.url.isEmpty)
        Button(action: onCopyLink) { MenuLabel("Copy link", .copy) }
            .disabled(item.url.isEmpty)
        if let onEditLink {
            Button(action: onEditLink) { MenuLabel(item.url.isEmpty ? "Add link" : "Edit link", .pencil) }
        }
        Divider()
        Button(action: onToggleRead) {
            MenuLabel(item.read ? "Mark as unread" : "Mark as read", item.read ? .circleMinus : .circleCheck)
        }
        Button(action: onToggleStar) {
            MenuLabel(item.starred ? "Unstar" : "Star", item.starred ? .starOff : .star)
        }
        if let onReviewItem {
            Button(action: onReviewItem) { MenuLabel("Review this item", .cards) }
                .disabled(item.flashcardCount == 0)
        }
        Button(action: onToggleHidden) {
            MenuLabel(
                item.hiddenFromReview ? "Show in review" : "Hide from review",
                item.hiddenFromReview ? .cardsFilled : .cards)
        }
        Divider()
        Button(action: onChatWithClaude) { MenuLabel("Chat with Claude", .claude) }
        Divider()
        Button(role: .destructive, action: onDelete) { MenuLabel("Delete", .trash, destructive: true) }
    }
}

// MARK: - Demo

private struct ItemMenuDemo: View {
    @State private var read = false
    @State private var starred = true
    @State private var hidden = false
    @State private var deleted = false

    var body: some View {
        if deleted {
            Text("Deleted. Reopen the demo to bring it back.")
                .textStyle(.small)
                .foregroundStyle(Theme.mutedForeground)
                .padding(.horizontal, 8)
        } else {
            ListRow(title: "Right-click this row", muted: read) {
                Favicon(url: "https://example.com")
            } trailing: {
                if starred { Icon(.starFilled, size: 12).foregroundStyle(Theme.starred) }
            }
            .frame(width: 288)
            .contextMenu {
                ItemMenuItems(
                    item: ItemMenuState(
                        read: read, starred: starred, hiddenFromReview: hidden, url: "https://example.com",
                        flashcardCount: 3),
                    onToggleRead: { read.toggle() },
                    onToggleStar: { starred.toggle() },
                    onToggleHidden: { hidden.toggle() },
                    onDelete: { deleted = true }
                )
            }
        }
    }
}

extension Demo {
    static let itemMenu = Demo(
        "Item menu", section: .app,
        description:
            "The right-click menu for an item row: read state, star, delete. Presentation only; callers own the mutations. The starred marker uses the starred gold."
    ) {
        ItemMenuDemo()
    }
}
