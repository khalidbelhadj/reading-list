import SwiftUI

/// All items: a search bar, the view options, then every item grouped by the
/// date it was added, starred ones in their own section above. Typing
/// filters against titles, urls and notes in memory.
struct AllItemsView: View {
    @Environment(ItemStore.self) private var store
    @Environment(SettingsStore.self) private var settings
    @State private var query = ""

    // View options live in the user's settings, the same blob the web reads.
    private var showRead: Bool { settings.settings.showRead }
    private var showReadBinding: Binding<Bool> {
        Binding(get: { settings.settings.showRead }, set: { next in settings.update { $0.showRead = next } })
    }
    private var groupBy: Binding<ListGroupBy> {
        Binding(
            get: { ListGroupBy(setting: settings.settings.groupBy) },
            set: { next in settings.update { $0.groupBy = next.setting } })
    }
    private var sortBy: Binding<ListSortBy> {
        Binding(
            get: { ListSortBy(setting: settings.settings.sortBy) },
            set: { next in settings.update { $0.sortBy = next.setting } })
    }
    private var density: Binding<ListDensity> {
        Binding(
            get: { ListDensity(setting: settings.settings.density) },
            set: { next in settings.update { $0.density = next.setting } })
    }

    private var searching: Bool { !query.trimmingCharacters(in: .whitespaces).isEmpty }

    private var results: [Item] {
        let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
        return store.items.filter { item in
            item.title.lowercased().contains(needle) || item.url.lowercased().contains(needle)
                || (item.notes ?? "").lowercased().contains(needle)
        }
    }

    private var starred: [Item] {
        store.items.filter { $0.starred && (showRead || !$0.read) }
    }

    private var browse: [Item] {
        let sort = sortBy.wrappedValue
        let key: ItemSort.Key = sort == .updatedDesc || sort == .updatedAsc ? .updatedAt : .createdAt
        let descending = sort == .createdDesc || sort == .updatedDesc
        return store.items
            .filter { !$0.starred && (showRead || !$0.read) }
            .sorted { ItemSort.compare($0, $1, key: key, descending: descending) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Input(
                    text: $query, placeholder: "Search", leading: .icon(.search),
                    trailing: searching ? .text(String(results.count)) : nil
                )
                .accessibilityIdentifier("list.search")
                if searching {
                    if results.isEmpty {
                        Text("No matching items.")
                            .textStyle(.small)
                            .foregroundStyle(Theme.mutedForeground)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                    } else {
                        rows(results)
                    }
                } else {
                    ListViewOptions(showRead: showReadBinding, groupBy: groupBy, sortBy: sortBy, density: density)
                        .padding(.vertical, -12)
                    if store.hasLoaded {
                        if !starred.isEmpty {
                            section("Starred", icon: .starFilled, iconColor: Theme.starred) {
                                rows(starred, showStar: false)
                            }
                        }
                        if groupBy.wrappedValue == .day {
                            ForEach(DateGroup.group(browse, now: Date()), id: \.group) { bucket in
                                section(bucket.group.label) { rows(bucket.items) }
                            }
                        } else {
                            rows(browse)
                        }
                        if store.items.isEmpty {
                            EmptyState(
                                title: "Nothing saved yet",
                                description: "Paste a link, or press New item in the sidebar."
                            )
                            .frame(maxWidth: .infinity)
                            .padding(.top, 32)
                        }
                    } else {
                        VStack(spacing: 2) {
                            ForEach(0..<8, id: \.self) { _ in Skeleton().frame(height: Theme.rowHeight) }
                        }
                    }
                }
            }
            .frame(maxWidth: 576)
            .padding(.horizontal, 32)
            .padding(.top, 48)
            .padding(.bottom, 64)
            .frame(maxWidth: .infinity)
        }
    }

    private func section(
        _ label: String, icon: TablerIcon? = nil, iconColor: Color = Theme.mutedForeground,
        @ViewBuilder content: () -> some View
    ) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                if let icon { Icon(icon, size: 10).foregroundStyle(iconColor) }
                Text(label)
            }
            .textStyle(.micro, .medium)
            .foregroundStyle(Theme.mutedForeground)
            .padding(.horizontal, 8)
            content()
        }
    }

    private func rows(_ items: [Item], showStar: Bool = true) -> some View {
        let preview = density.wrappedValue == .preview
        let now = Date()
        return VStack(spacing: 2) {
            ForEach(items) { item in
                ItemRowView(
                    item: item, showStar: showStar, preview: preview,
                    meta: preview ? "Added \(timeAgo(item.createdAt, now: now))" : nil
                )
            }
        }
    }
}
