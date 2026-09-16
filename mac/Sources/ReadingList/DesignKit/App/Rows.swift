import SwiftUI

/// One row of a list: leading icon or favicon, title, optional meta on the
/// right. A long title fades out at its right edge rather than ending in an
/// ellipsis. `selected` is the keyboard cursor or open item; `muted` fades
/// the whole row (read or done rows, favicon included).
struct ListRow<Leading: View, Trailing: View>: View {
    let title: String
    var meta: String?
    var selected = false
    var muted = false
    /// 26 for lists; the sidebar sits denser at 24.
    var height: CGFloat = Theme.rowHeight
    var action: (() -> Void)?
    @ViewBuilder var leading: () -> Leading
    @ViewBuilder var trailing: () -> Trailing
    @State private var hovering = false

    var body: some View {
        HStack(spacing: 8) {
            leading()
                .frame(width: 14, height: 14)
            Text(title)
                .textStyle(.body)
                .fadeRight()
            if let meta {
                Text(meta)
                    .textStyle(.small)
                    .monospacedDigit()
                    .foregroundStyle(Theme.mutedForeground)
                    .fixedSize()
            }
            trailing()
        }
        .environment(\.iconSize, 14)
        .foregroundStyle(Theme.foreground)
        .padding(.horizontal, 8)
        .frame(height: height)
        .background(selected ? Theme.fg(0.07) : hovering ? Theme.fg(0.05) : .clear, in: Theme.controlShape)
        .opacity(muted ? 0.5 : 1)
        .contentShape(Theme.controlShape)
        .onHover { hovering = $0 }
        .onTapGesture { action?() }
    }
}

extension ListRow where Leading == EmptyView, Trailing == EmptyView {
    init(
        title: String, meta: String? = nil, selected: Bool = false, muted: Bool = false,
        height: CGFloat = Theme.rowHeight, action: (() -> Void)? = nil
    ) {
        self.init(
            title: title, meta: meta, selected: selected, muted: muted, height: height, action: action,
            leading: { EmptyView() }, trailing: { EmptyView() })
    }
}

extension ListRow where Trailing == EmptyView {
    init(
        title: String, meta: String? = nil, selected: Bool = false, muted: Bool = false,
        height: CGFloat = Theme.rowHeight, action: (() -> Void)? = nil, @ViewBuilder leading: @escaping () -> Leading
    ) {
        self.init(
            title: title, meta: meta, selected: selected, muted: muted, height: height, action: action,
            leading: leading, trailing: { EmptyView() })
    }
}

/// The roomier sibling of ListRow for the cozy list density: a thumbnail on
/// the left, title with a quiet meta line beneath, and the trailing slot
/// pinned to the row's top-right. Same hover and selected registers.
struct PreviewRow<Leading: View, Trailing: View>: View {
    let title: String
    var meta: String?
    var selected = false
    var muted = false
    @ViewBuilder var leading: () -> Leading
    @ViewBuilder var trailing: () -> Trailing
    @State private var hovering = false

    var body: some View {
        HStack(alignment: .center, spacing: 8) {
            leading()
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .textStyle(.body)
                    .fadeRight()
                if let meta {
                    Text(meta)
                        .textStyle(.micro)
                        .foregroundStyle(Theme.mutedForeground)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            trailing()
                .frame(maxHeight: .infinity, alignment: .top)
                .padding(.top, 4)
        }
        .foregroundStyle(Theme.foreground)
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(selected ? Theme.fg(0.07) : hovering ? Theme.fg(0.05) : .clear, in: Theme.controlShape)
        .opacity(muted ? 0.5 : 1)
        .contentShape(Theme.controlShape)
        .onHover { hovering = $0 }
    }
}

extension PreviewRow where Trailing == EmptyView {
    init(
        title: String, meta: String? = nil, selected: Bool = false, muted: Bool = false,
        @ViewBuilder leading: @escaping () -> Leading
    ) {
        self.init(
            title: title, meta: meta, selected: selected, muted: muted, leading: leading, trailing: { EmptyView() })
    }
}

/// A row in the sidebar: icon, label, optional trailing count. 24px tall
/// (denser than list rows). One active at a time.
struct SidebarItem<Trailing: View>: View {
    let icon: TablerIcon?
    let label: String
    var count: Int?
    var active = false
    var action: () -> Void = {}
    /// The row's accessibility identifier. Set here rather than on the
    /// whole view, so it names the row and not the trailing control too.
    var identifier: String?
    /// What sits at the end of the row, told whether the row is hovered so
    /// an affordance can show itself only then (the paste icon on New item).
    /// Laid over the row, so it can be a control of its own.
    @ViewBuilder let trailing: (_ hovering: Bool) -> Trailing
    @State private var hovering = false

    init(
        icon: TablerIcon? = nil, label: String, count: Int? = nil, active: Bool = false, identifier: String? = nil,
        action: @escaping () -> Void = {}, @ViewBuilder trailing: @escaping (_ hovering: Bool) -> Trailing
    ) {
        self.icon = icon
        self.label = label
        self.count = count
        self.active = active
        self.identifier = identifier
        self.action = action
        self.trailing = trailing
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let icon { Icon(icon, size: 14) }
                Text(label)
                    .textStyle(.body, .medium)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if let count {
                    Text(String(count))
                        .textStyle(.small)
                        .monospacedDigit()
                        .foregroundStyle(Theme.mutedForeground)
                }
            }
            .foregroundStyle(active || hovering ? Theme.foreground : Theme.mutedForeground)
            .padding(.horizontal, 8)
            .frame(height: Theme.sidebarRowHeight)
            .background(active ? Theme.fg(0.07) : hovering ? Theme.fg(0.05) : .clear, in: Theme.controlShape)
            .contentShape(Theme.controlShape)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier ?? "")
        // Laid over the row's end rather than inside the button, so a
        // control there is its own element: its own click, its own
        // accessibility identifier.
        .overlay(alignment: .trailing) {
            trailing(hovering)
                .foregroundStyle(active || hovering ? Theme.foreground : Theme.mutedForeground)
                .padding(.trailing, 8)
        }
        .onHover { hovering = $0 }
    }
}

extension SidebarItem where Trailing == EmptyView {
    init(
        icon: TablerIcon? = nil, label: String, count: Int? = nil, active: Bool = false, identifier: String? = nil,
        action: @escaping () -> Void = {}
    ) {
        self.init(icon: icon, label: label, count: count, active: active, identifier: identifier, action: action) { _ in
            EmptyView()
        }
    }
}

// MARK: - Demos

private let previewRows: [(title: String, url: String, meta: String, starred: Bool)] = [
    (
        "FoundationDB: A Distributed Unbundled Transactional KeyValue Store", "https://foundationdb.org",
        "Added 2 days ago", true
    ),
    ("Multicast and the Markets with Brian Nigito", "https://youtube.com", "Added 1 week ago", false),
    ("Sequential consistency", "https://en.wikipedia.org/wiki/Sequential_consistency", "Added 3 weeks ago", false),
]

extension Demo {
    static let listRow = Demo(
        "List row", section: .app,
        description:
            "The reading list, recents and flashcard lists share this row. 26px, favicon, title, meta on the right."
    ) {
        VStack(spacing: 2) {
            ListRow(title: "Linux Container Primitives: cgroups, namespaces, and more", meta: "13m ago") {
                Icon(.brandYoutube).foregroundStyle(Theme.destructive)
            } trailing: {
                Icon(.pinFilled, size: 12).foregroundStyle(Theme.mutedForeground)
            }
            ListRow(title: "How AWS's Firecracker virtual machines work", meta: "22m ago", selected: true) {
                Icon(.brandYoutube).foregroundStyle(Theme.destructive)
            }
            ListRow(title: "[1908.01262] A systematic review of fuzzing", meta: "2d ago") {
                Icon(.fileText)
            } trailing: {
                Badge("Due", variant: .accent)
            }
            ListRow(title: "What Really Happened at the Minab School Strike?", meta: "6d ago", muted: true) {
                Icon(.brandYoutube).foregroundStyle(Theme.destructive)
            }
        }
        .frame(width: 448)
    }

    static let previewRow = Demo(
        "Preview row", section: .app,
        description:
            "ListRow's roomier sibling for the cozy list density: title with a quiet meta line beneath, same hover and selected registers."
    ) {
        VStack(spacing: 2) {
            ForEach(previewRows.indices, id: \.self) { index in
                let row = previewRows[index]
                PreviewRow(title: row.title, meta: row.meta, selected: index == 0) {
                    ItemThumbnail(url: row.url, title: row.title)
                } trailing: {
                    if row.starred {
                        Icon(.starFilled, size: 12).foregroundStyle(Theme.starred)
                    }
                }
            }
        }
        .frame(width: 384)
    }

    static let sidebarItem = Demo(
        "Sidebar item", section: .app,
        description:
            "Navigation rows for the frost sidebar: 24px tall (denser than list rows), icon, label, trailing count. One active at a time."
    ) {
        VStack(spacing: 2) {
            SidebarItem(icon: .circlePlus, label: "New item") { hovering in
                if hovering {
                    Button {
                    } label: {
                        Icon(.clipboard, size: 12)
                    }
                    .buttonStyle(.kit(.ghost, .iconSm))
                    .padding(.trailing, -4)
                    .tooltip("Add from clipboard")
                }
            }
            SidebarItem(icon: .home, label: "Home", active: true)
            SidebarItem(icon: .cards, label: "Flashcards", count: 155)
            SidebarItem(icon: .list, label: "Reading list", count: 198)
        }
        .padding(8)
        .frame(width: 224)
        .frost()
    }
}
