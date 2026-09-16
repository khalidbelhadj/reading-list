import SwiftUI

/// The one item row for every list in the shell (sidebar Recent, All items,
/// the palette): favicon, title, a gold star when starred, and the shared
/// right-click menu wired to the store. `preview` wears the roomier two-line
/// row with the thumbnail; the default is the compact one-liner.
struct ItemRowView: View {
    let item: Item
    var showStar = true
    var preview = false
    var meta: String?
    var height: CGFloat = Theme.rowHeight
    @Environment(ItemStore.self) private var store
    @Environment(Navigator.self) private var navigator

    private var selected: Bool { navigator.openItemId == item.id }

    var body: some View {
        Group {
            if preview {
                PreviewRow(title: item.displayTitle, meta: meta, selected: selected, muted: item.read) {
                    ItemThumbnail(url: item.url, title: item.title)
                } trailing: {
                    star
                }
            } else {
                ListRow(
                    title: item.displayTitle, selected: selected, muted: item.read, height: height,
                    action: { navigator.open(item.id) }
                ) {
                    Favicon(url: item.url, storedFaviconURL: item.faviconUrl)
                } trailing: {
                    star
                }
            }
        }
        .contentShape(Theme.controlShape)
        .onTapGesture { navigator.open(item.id) }
        .contextMenu {
            ItemMenuItems(
                item: item.menuState,
                onToggleRead: { store.toggleRead(item.id) },
                onToggleStar: { store.toggleStar(item.id) },
                onToggleHidden: { store.toggleHiddenFromReview(item.id) },
                onDelete: {
                    store.delete(item.id)
                    navigator.dropItem(item.id)
                },
                onOpenLink: { ItemActions.openLink(item) },
                onCopyLink: { ItemActions.copyLink(item) },
                onReviewItem: { navigator.showReview(itemId: item.id) }
            )
        }
        .accessibilityIdentifier("item.\(item.id)")
    }

    @ViewBuilder
    private var star: some View {
        if showStar, item.starred {
            Icon(.starFilled, size: 12).foregroundStyle(Theme.starred)
        }
    }
}
