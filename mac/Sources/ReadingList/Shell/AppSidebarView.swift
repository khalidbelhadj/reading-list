import SwiftUI

private let recentLimit = 20

/// The app's sidebar: one action (New item), the places, then the starred
/// items and the twenty most recent, each with a preview card on hover.
/// One thing is active at a time; the navigator owns that and this only
/// renders and requests changes.
struct AppSidebarView: View {
    @Environment(ItemStore.self) private var store
    @Environment(FlashcardStore.self) private var deck
    @Environment(Navigator.self) private var navigator
    @Environment(SessionController.self) private var session

    private var dueCount: Int { deck.dueCount(items: store.items) }
    private var starred: [Item] { store.items.filter { $0.starred && !$0.read } }
    private var recent: [Item] { Array(store.items.filter { !$0.starred && !$0.read }.prefix(recentLimit)) }

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 2) {
                NewItemRow()
                SidebarItem(icon: .list, label: "Reading list", active: navigator.current == .items) {
                    navigator.showItems()
                }
                .accessibilityIdentifier("sidebar.reading-list")
                SidebarItem(
                    icon: .cards, label: "Review", count: dueCount > 0 ? dueCount : nil,
                    active: navigator.current == .review(itemId: nil), identifier: "sidebar.review"
                ) {
                    navigator.showReview()
                }
            }
            .padding(.horizontal, 8)
            .padding(.top, 4)

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if !starred.isEmpty {
                        SidebarGroup(label: "Starred", icon: .starFilled, iconColor: Theme.starred) {
                            ForEach(starred) { item in
                                ItemRowView(item: item, showStar: false, height: Theme.sidebarRowHeight)
                                    .hoverPreview(item.id)
                            }
                        }
                    }
                    SidebarGroup(label: "Recent") {
                        if store.hasLoaded {
                            ForEach(recent) { item in
                                ItemRowView(item: item, height: Theme.sidebarRowHeight)
                                    .hoverPreview(item.id)
                            }
                            TextLink(variant: .quiet, action: { navigator.showItems() }) {
                                Text("See all items")
                                Icon(.chevronRight, size: 12)
                            }
                            .textStyle(.micro, .medium)
                            .padding(.horizontal, 8)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .frame(height: Theme.sidebarRowHeight)
                        } else {
                            ForEach(0..<6, id: \.self) { _ in
                                Skeleton().frame(height: Theme.sidebarRowHeight)
                            }
                        }
                    }
                }
                .padding(.horizontal, 8)
                .padding(.top, 20)
                .padding(.bottom, 16)
            }

            HStack {
                Spacer()
                SettingsMenu()
            }
            .padding(.horizontal, 8)
            .padding(.bottom, 8)
        }
    }
}

/// A labelled group of rows: the shared shape of the sidebar's sections.
private struct SidebarGroup<Content: View>: View {
    let label: String
    var icon: TablerIcon?
    var iconColor: Color = Theme.mutedForeground
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                if let icon { Icon(icon, size: 10).foregroundStyle(iconColor) }
                Text(label)
            }
            .textStyle(.micro, .medium)
            .foregroundStyle(Theme.mutedForeground)
            .padding(.horizontal, 8)
            VStack(spacing: 2) { content() }
        }
    }
}

/// New item, with its paste affordance at the end of the row: shown on
/// hover when the clipboard holds a link.
private struct NewItemRow: View {
    @Environment(ItemStore.self) private var store
    @Environment(Navigator.self) private var navigator
    @State private var pasteReady = false

    var body: some View {
        SidebarItem(icon: .circlePlus, label: "New item", identifier: "sidebar.new-item") {
            navigator.open(store.createBlank())
        } trailing: { hovering in
            if pasteReady, hovering {
                Button {
                    if let url = ItemActions.pasteboardURL() {
                        navigator.open(store.create(url: url))
                    }
                } label: {
                    Icon(.clipboard, size: 12)
                }
                .buttonStyle(.kit(.ghost, .iconSm))
                .padding(.trailing, -4)
                .tooltip("Add from clipboard")
                .accessibilityIdentifier("sidebar.paste")
            }
        }
        .onHover { inside in
            if inside { pasteReady = ItemActions.pasteboardURL() != nil }
        }
    }
}

/// The gear in the sidebar's corner.
private struct SettingsMenu: View {
    @Environment(SessionController.self) private var session
    @Environment(SettingsStore.self) private var settings

    private var theme: Binding<String> {
        Binding(get: { settings.settings.theme }, set: { next in settings.update { $0.theme = next } })
    }
    private var sounds: Binding<Bool> {
        Binding(get: { settings.settings.sounds }, set: { next in settings.update { $0.sounds = next } })
    }

    var body: some View {
        Menu {
            if case .signedIn(let account) = session.state, let email = account.email {
                Text(email)
            }
            Picker("Theme", selection: theme) {
                Text("System").tag("system")
                Text("Light").tag("light")
                Text("Dark").tag("dark")
            }
            .pickerStyle(.menu)
            Toggle("Sounds", isOn: sounds)
            Button {
                _ = BoardState.shared.open(nil)
            } label: {
                MenuLabel("Design board", .palette)
            }
            Divider()
            Button {
                Task { await session.signOut() }
            } label: {
                MenuLabel("Sign out", .logout)
            }
        } label: {
            Icon(.settings)
        }
        .menuStyle(.button)
        .buttonStyle(.kit(.ghost, .iconMd))
        .menuIndicator(.hidden)
        .fixedSize()
        .accessibilityIdentifier("sidebar.settings")
    }
}
