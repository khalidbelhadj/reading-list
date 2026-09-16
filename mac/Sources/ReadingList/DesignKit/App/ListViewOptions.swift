import SwiftUI

enum ListGroupBy: String, CaseIterable { case day, none }
enum ListSortBy: String, CaseIterable { case createdDesc, createdAsc, updatedDesc, updatedAsc }
enum ListDensity: String, CaseIterable { case compact, preview }

private struct OptionMenu<Value: Hashable>: View {
    let tooltip: String
    let icon: TablerIcon
    let options: [(value: Value, label: String, icon: TablerIcon)]
    @Binding var value: Value

    var body: some View {
        Menu {
            Picker("", selection: $value) {
                ForEach(options.indices, id: \.self) { index in
                    MenuLabel(options[index].label, options[index].icon).tag(options[index].value)
                }
            }
            .pickerStyle(.inline)
            .labelsHidden()
        } label: {
            Icon(icon)
        }
        .menuStyle(.button)
        .buttonStyle(.kit(.ghost, .iconSm))
        .menuIndicator(.hidden)
        .fixedSize()
        .tooltip(tooltip)
        .accessibilityLabel(tooltip)
    }
}

/// The row of view options under a list's search bar: show-read toggle,
/// group, sort, and density, each an icon button. Values and writes come
/// from the caller.
struct ListViewOptions: View {
    @Binding var showRead: Bool
    @Binding var groupBy: ListGroupBy
    @Binding var sortBy: ListSortBy
    @Binding var density: ListDensity

    var body: some View {
        HStack(spacing: 2) {
            Button(action: { showRead.toggle() }) { Icon(showRead ? .eye : .eyeOff) }
                .buttonStyle(.kit(.ghost, .iconSm))
                .background(showRead ? Theme.fg(0.05) : .clear, in: Theme.controlShape)
                .foregroundStyle(showRead ? Theme.foreground : Theme.mutedForeground)
                .tooltip(showRead ? "Hide read items" : "Show read items")
                .accessibilityLabel(showRead ? "Hide read items" : "Show read items")
            OptionMenu(
                tooltip: "Group", icon: .layoutList,
                options: [
                    (.day, "By date", .calendar), (.none, "No groups", .circleOff),
                ], value: $groupBy)
            OptionMenu(
                tooltip: "Sort", icon: .arrowsSort,
                options: [
                    (.createdDesc, "Newest first", .sortDescending), (.createdAsc, "Oldest first", .sortAscending),
                    (.updatedDesc, "Recently updated", .sortDescending),
                    (.updatedAsc, "Least recently updated", .sortAscending),
                ], value: $sortBy)
            OptionMenu(
                tooltip: "Density", icon: .listDetails,
                options: [
                    (.compact, "Compact", .layoutList), (.preview, "Preview", .listDetails),
                ], value: $density)
        }
    }
}

// MARK: - Demo

private struct ListViewOptionsDemo: View {
    @State private var showRead = true
    @State private var groupBy = ListGroupBy.day
    @State private var sortBy = ListSortBy.createdDesc
    @State private var density = ListDensity.compact

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ListViewOptions(showRead: $showRead, groupBy: $groupBy, sortBy: $sortBy, density: $density)
            Text(
                "\(showRead ? "showing read" : "hiding read"), \(groupBy.rawValue), \(sortBy.rawValue), \(density.rawValue)"
            )
            .textStyle(.micro)
            .foregroundStyle(Theme.mutedForeground)
        }
    }
}

extension Demo {
    static let listViewOptions = Demo(
        "List view options", section: .app,
        description:
            "The icon-button row under a list's search bar: show-read toggle, group, sort, and density menus. Values and writes come from the caller."
    ) {
        ListViewOptionsDemo()
    }
}
