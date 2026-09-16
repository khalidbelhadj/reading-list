import SwiftUI

/// The app shell: the sidebar (a native split view column, so it is the
/// system's glass over the desktop) and the pane, which shows the reading
/// list or one item. The shell owns the store and the navigator.
struct ShellView: View {
    let account: Account
    @State private var store: ItemStore
    @State private var deck: FlashcardStore
    @State private var settings: SettingsStore
    @State private var navigator = Navigator()
    @State private var sync: SyncWatcher
    @State private var previews: ItemPreviews
    @State private var hover = HoverPreviewState()
    @State private var columns: NavigationSplitViewVisibility = .all

    init(account: Account) {
        self.account = account
        let store = ItemStore(api: account.api, snapshot: account.snapshot)
        let deck = FlashcardStore(api: account.api, snapshot: account.cardSnapshot)
        _store = State(initialValue: store)
        _deck = State(initialValue: deck)
        _settings = State(initialValue: SettingsStore(api: account.api, userId: account.userId))
        _sync = State(initialValue: SyncWatcher(account: account, store: store, cards: deck))
        _previews = State(initialValue: ItemPreviews(api: account.api))
    }

    var body: some View {
        NavigationSplitView(columnVisibility: $columns) {
            AppSidebarView()
                .navigationSplitViewColumnWidth(min: 180, ideal: 224, max: 420)
                // Our own flat toggle beside the traffic lights, in place of
                // the system's glass one.
                .toolbar(removing: .sidebarToggle)
                .toolbar {
                    ToolbarItem(placement: .automatic) { sidebarToggle }
                        .sharedBackgroundVisibility(.hidden)
                }
        } detail: {
            PaneView()
                .toolbar { toolbar }
        }
        // The sidebar's hover card, over both columns so it can sit beside
        // the row it belongs to.
        .overlay(alignment: .topLeading) { HoverPreviewCard() }
        .environment(store)
        .environment(deck)
        .environment(settings)
        .environment(navigator)
        .environment(previews)
        .environment(hover)
        .navigationTitle("")
        .onAppear {
            store.start()
            deck.start()
            settings.start()
            sync.start()
            // Notes are the source of truth for cards: a saved edit to them
            // can add, change or remove cards.
            store.onSaved = { patch in if patch.notes != nil { deck.refresh() } }
            AppServices.store = store
            AppServices.cards = deck
            AppServices.settings = settings
            AppServices.navigator = navigator
        }
        .onChange(of: navigator.current, initial: true) { _, current in
            #if DEBUG
                DevState.shared.viewLabel =
                    switch current {
                    case .items: "Reading list"
                    case .item(let id): "Item \(id.prefix(8))"
                    case .review(let itemId): itemId.map { "Review · \($0.prefix(8))" } ?? "Review"
                    }
            #endif
        }
        .onChange(of: store.items.map(\.id)) { _, ids in
            // The open item can vanish under us (deleted here or elsewhere).
            if let open = navigator.openItemId, store.hasLoaded, !ids.contains(open) {
                navigator.dropItem(open)
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            store.refresh()
            deck.refresh()
            Task { await settings.refresh() }
        }
    }

    private var sidebarToggle: some View {
        Button {
            // The split view's own toggle: the system animation, and the
            // visibility binding follows.
            NSApp.sendAction(#selector(NSSplitViewController.toggleSidebar(_:)), to: nil, from: nil)
        } label: {
            Icon(.layoutSidebar)
        }
        .buttonStyle(.kit(.ghost, .iconMd))
        // The toolbar leaves more room after the traffic lights than the
        // web's bar does; tuck the toggle in beside them.
        .offset(x: -8)
        .tooltip(columns == .detailOnly ? "Show sidebar" : "Hide sidebar")
        .accessibilityIdentifier("shell.sidebar-toggle")
    }

    // The header's buttons are the kit's flat ghost buttons, not the
    // toolbar's glass: the shared background is hidden per group. History
    // sits at the leading edge; at the trailing one, search first, then the
    // open item's badges and star, its menu last.
    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItemGroup(placement: .navigation) {
            HStack(spacing: 2) {
                Button(action: navigator.back) { Icon(.chevronLeft) }
                    .buttonStyle(.kit(.ghost, .iconMd))
                    .disabled(!navigator.canGoBack)
                    .keyboardShortcut("[", modifiers: .command)
                    .tooltip("Back")
                Button(action: navigator.forward) { Icon(.chevronRight) }
                    .buttonStyle(.kit(.ghost, .iconMd))
                    .disabled(!navigator.canGoForward)
                    .keyboardShortcut("]", modifiers: .command)
                    .tooltip("Forward")
            }
        }
        .sharedBackgroundVisibility(.hidden)
        ToolbarSpacer(.flexible)
        ToolbarItemGroup(placement: .primaryAction) {
            HStack(spacing: 6) {
                Button {
                    presentPalette()
                } label: {
                    Icon(.search)
                }
                .buttonStyle(.kit(.ghost, .iconMd))
                .keyboardShortcut("k", modifiers: .command)
                .tooltip("Open item ⌘K")
                if let id = navigator.openItemId, let item = store.item(id) {
                    ItemToolbarActions(item: item)
                }
            }
        }
        .sharedBackgroundVisibility(.hidden)
    }

    /// ⌘K: every item by title or url, most recent first.
    private func presentPalette() {
        PaletteState.shared.present(
            PaletteConfig(
                placeholder: "Open item",
                header: "Recent",
                entries: { query in
                    let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
                    let matches = store.items.filter { item in
                        needle.isEmpty || item.title.lowercased().contains(needle)
                            || item.url.lowercased().contains(needle)
                    }
                    return matches.prefix(needle.isEmpty ? 12 : 40).map { item in
                        PaletteEntry(id: item.id) { selected in
                            ListRow(title: item.displayTitle, selected: selected) {
                                Favicon(url: item.url, storedFaviconURL: item.faviconUrl)
                            }
                        }
                    }
                },
                onPick: { entry in navigator.open(entry.id) }
            ))
    }
}

/// What the pane shows: the list, or one item.
private struct PaneView: View {
    @Environment(ItemStore.self) private var store
    @Environment(Navigator.self) private var navigator

    var body: some View {
        Group {
            switch navigator.current {
            case .items:
                AllItemsView()
            case .item(let id):
                if let item = store.item(id) {
                    ItemDetailView(item: item)
                        .id(id)
                } else {
                    AllItemsView()
                }
            case .review(let itemId):
                ReviewPaneView(itemId: itemId)
                    .id(itemId ?? "")
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background)
    }
}

/// The open item's corner cluster: state badges, the star, and the menu.
private struct ItemToolbarActions: View {
    let item: Item
    @Environment(ItemStore.self) private var store
    @Environment(Navigator.self) private var navigator

    var body: some View {
        if item.hiddenFromReview { Badge("Hidden") }
        if item.read { Badge("Read") }
        Button {
            store.toggleStar(item.id)
        } label: {
            Icon(item.starred ? .starFilled : .star)
                .foregroundStyle(item.starred ? Theme.starred : Theme.mutedForeground)
        }
        .buttonStyle(.kit(.ghost, .iconMd))
        .tooltip(item.starred ? "Unstar" : "Star")
        Menu {
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
        } label: {
            Icon(.dots)
        }
        .menuStyle(.button)
        .buttonStyle(.kit(.ghost, .iconMd))
        .menuIndicator(.hidden)
        .fixedSize()
    }
}

extension Item {
    var menuState: ItemMenuState {
        ItemMenuState(
            read: read, starred: starred, hiddenFromReview: hiddenFromReview, url: url, flashcardCount: flashcardCount)
    }
}

/// Actions that leave the app: open in the browser, copy the link.
enum ItemActions {
    @MainActor
    static func openLink(_ item: Item) {
        guard let url = URL(string: item.url) else { return }
        NSWorkspace.shared.open(url)
    }

    @MainActor
    static func copyLink(_ item: Item) {
        guard !item.url.isEmpty else { return }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(item.url, forType: .string)
        Notifier.shared.notify(NotifyOptions(title: "Link copied", description: item.domain, icon: .link, meta: "now"))
    }

    /// An http(s) url on the pasteboard, or nil.
    @MainActor
    static func pasteboardURL() -> String? {
        guard let text = NSPasteboard.general.string(forType: .string)?.trimmingCharacters(in: .whitespacesAndNewlines),
            let url = URL(string: text), let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https",
            url.host != nil
        else { return nil }
        return text
    }
}
