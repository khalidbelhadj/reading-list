import SwiftUI

/// One row the palette can show, drawn by the caller for the selected and
/// unselected states.
struct PaletteEntry: Identifiable {
    let id: String
    let content: (Bool) -> AnyView

    init<Content: View>(id: String, @ViewBuilder content: @escaping (Bool) -> Content) {
        self.id = id
        self.content = { AnyView(content($0)) }
    }
}

/// What a caller hands the palette: the entries for a query, and what
/// picking one does.
struct PaletteConfig {
    var placeholder = "Search"
    /// Shown above the list while the query is empty ("Recent", "All fruit").
    var header: String?
    var emptyText = "No matches."
    var entries: (String) -> [PaletteEntry]
    var onPick: (PaletteEntry) -> Void
}

/// The palette's state, shared so ⌘K anywhere opens it over the window.
@MainActor
@Observable
final class PaletteState {
    static let shared = PaletteState()

    var isPresented = false
    var query = ""
    var selected = 0
    var config: PaletteConfig?

    func present(_ config: PaletteConfig) {
        self.config = config
        query = ""
        selected = 0
        isPresented = true
    }

    func dismiss() {
        isPresented = false
    }
}

/// A ⌘K-style palette: a frost sheet near the top of the window with a
/// search input and a keyboard-navigable list. Arrows move, Enter picks,
/// Escape closes; the caller owns the query and the entries.
struct CommandPalette: View {
    @Bindable private var state = PaletteState.shared

    private var entries: [PaletteEntry] {
        state.config?.entries(state.query) ?? []
    }

    var body: some View {
        let entries = entries
        let selected = min(state.selected, max(0, entries.count - 1))
        VStack(spacing: 8) {
            Input(
                text: $state.query, placeholder: state.config?.placeholder ?? "Search",
                leading: .icon(.search), autofocus: true,
                onSubmit: { pick(entries, selected) }
            )
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 2) {
                        if let header = state.config?.header, state.query.trimmingCharacters(in: .whitespaces).isEmpty,
                            !entries.isEmpty
                        {
                            Text(header)
                                .textStyle(.micro, .medium)
                                .foregroundStyle(Theme.mutedForeground)
                                .padding(.horizontal, 8)
                                .padding(.top, 4)
                        }
                        ForEach(Array(entries.enumerated()), id: \.element.id) { index, entry in
                            entry.content(index == selected)
                                .id(entry.id)
                                .contentShape(Rectangle())
                                .onHover { if $0 { state.selected = index } }
                                .onTapGesture { pick(entries, index) }
                        }
                        if entries.isEmpty, let empty = state.config?.emptyText {
                            Text(empty)
                                .textStyle(.small)
                                .foregroundStyle(Theme.mutedForeground)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 12)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(height: listHeight(entries.count, header: state.config?.header != nil && state.query.isEmpty))
                .onChange(of: selected) { _, index in
                    if let entry = entries.indices.contains(index) ? entries[index] : nil {
                        proxy.scrollTo(entry.id)
                    }
                }
            }
        }
        .padding(8)
        .frame(width: 608)
        .frost()
        .onChange(of: state.query) { _, _ in state.selected = 0 }
        .onKeyPress(.downArrow) {
            move(1, count: entries.count)
            return .handled
        }
        .onKeyPress(.upArrow) {
            move(-1, count: entries.count)
            return .handled
        }
        .onKeyPress(.escape) {
            state.dismiss()
            return .handled
        }
    }

    /// Rows are 26pt with a 2pt gap; the header adds a line. Capped at 384.
    private func listHeight(_ count: Int, header: Bool) -> CGFloat {
        let rows = count == 0 ? 42 : CGFloat(count) * (Theme.rowHeight + 2) - 2
        return min(384, rows + (header && count > 0 ? 22 : 0))
    }

    private func move(_ delta: Int, count: Int) {
        guard count > 0 else { return }
        state.selected = (min(state.selected, count - 1) + delta + count) % count
    }

    private func pick(_ entries: [PaletteEntry], _ index: Int) {
        guard entries.indices.contains(index) else { return }
        state.config?.onPick(entries[index])
        state.dismiss()
    }
}

/// Mounts the palette over a window's content. Clicking outside closes it.
struct CommandPaletteHost: View {
    private var state = PaletteState.shared

    var body: some View {
        if state.isPresented {
            ZStack(alignment: .top) {
                Color.clear
                    .contentShape(Rectangle())
                    .onTapGesture { state.dismiss() }
                CommandPalette()
                    .padding(.top, 96)
                    .transition(.opacity.combined(with: .scale(scale: 0.98)))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

// MARK: - Demo

private let fruit = ["Apple", "Blackberry", "Cherry", "Damson", "Elderberry", "Fig", "Gooseberry"]

private struct PaletteDemo: View {
    @State private var picked: String?

    var body: some View {
        HStack(spacing: 12) {
            Button("Open palette") {
                PaletteState.shared.present(
                    PaletteConfig(
                        placeholder: "Search fruit",
                        header: "All fruit",
                        entries: { query in
                            let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
                            return fruit.filter { needle.isEmpty || $0.lowercased().contains(needle) }.map { name in
                                PaletteEntry(id: name) { selected in
                                    Text(name)
                                        .textStyle(.body)
                                        .padding(.horizontal, 8)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .frame(height: Theme.rowHeight)
                                        .background(selected ? Theme.fg(0.07) : .clear, in: Theme.controlShape)
                                }
                            }
                        },
                        onPick: { picked = $0.id }
                    ))
            }
            .buttonStyle(.kit(.secondary))
            .accessibilityIdentifier("palette.open")
            if let picked {
                Text("Picked \(picked)")
                    .textStyle(.small)
                    .foregroundStyle(Theme.mutedForeground)
            }
        }
    }
}

extension Demo {
    static let commandPalette = Demo(
        "Command palette",
        description:
            "A ⌘K sheet: search input over a keyboard-navigable list. Arrows move, Enter picks, Escape closes; the caller owns the query and entries."
    ) {
        PaletteDemo()
    }
}
