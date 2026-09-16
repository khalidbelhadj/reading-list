import SwiftUI

struct SelectItem<Value: Hashable>: Identifiable {
    let value: Value
    let label: String
    var id: Value { value }
}

/// One-of-many in a popup. The trigger looks like an Input; the popup is the
/// system's glass menu, dropped beneath it.
struct Select<Value: Hashable>: View {
    @Binding var selection: Value?
    let items: [SelectItem<Value>]
    var placeholder = "Choose"
    var disabled = false
    @State private var hovering = false

    private var current: SelectItem<Value>? { items.first { $0.value == selection } }

    var body: some View {
        Menu {
            Picker("", selection: $selection) {
                ForEach(items) { item in
                    Text(item.label).tag(Optional(item.value))
                }
            }
            .pickerStyle(.inline)
            .labelsHidden()
        } label: {
            HStack(spacing: 8) {
                Text(current?.label ?? placeholder)
                    .textStyle(.body)
                    .foregroundStyle(current == nil ? Theme.mutedForeground : Theme.foreground)
                    .lineLimit(1)
                Spacer(minLength: 0)
                Icon(.selector, size: 14)
                    .foregroundStyle(Theme.mutedForeground)
            }
            .padding(.horizontal, 10)
            .frame(height: 28)
            .frame(maxWidth: .infinity)
            .background(Theme.fg(hovering ? 0.07 : 0.05), in: Theme.controlShape)
            .contentShape(Theme.controlShape)
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .opacity(disabled ? 0.5 : 1)
        .disabled(disabled)
        .onHover { hovering = $0 }
    }
}

// MARK: - Demo

private struct SelectDemo: View {
    @State private var sort: String? = "created-desc"
    @State private var group: String? = nil
    @State private var fixed: String? = "a"

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Field("Sort by") {
                Select(
                    selection: $sort,
                    items: [
                        SelectItem(value: "created-desc", label: "Newest first"),
                        SelectItem(value: "created-asc", label: "Oldest first"),
                        SelectItem(value: "updated-desc", label: "Recently updated"),
                    ])
            }
            Field("Group") {
                Select(
                    selection: $group,
                    items: [
                        SelectItem(value: "none", label: "None"),
                        SelectItem(value: "week", label: "By week"),
                        SelectItem(value: "day", label: "By day"),
                    ], placeholder: "No grouping")
            }
            Field("Disabled") {
                Select(selection: $fixed, items: [SelectItem(value: "a", label: "Fixed")], disabled: true)
            }
        }
        .frame(width: 384)
    }
}

extension Demo {
    static let select = Demo(
        "Select",
        description:
            "One of many, in a popup. Trigger matches Input; the list drops beneath it as the system's glass menu."
    ) {
        SelectDemo()
    }
}
