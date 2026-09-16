import SwiftUI

/// A menu item's label with a Tabler icon. AppKit menus take an image, so
/// the icon goes in as a 14pt template image.
struct MenuLabel: View {
    let title: String
    let icon: TablerIcon
    /// Painted in the destructive colour (Delete); pair with `role: .destructive`.
    var destructive = false

    init(_ title: String, _ icon: TablerIcon, destructive: Bool = false) {
        self.title = title
        self.icon = icon
        self.destructive = destructive
    }

    var body: some View {
        Label {
            // AppKit menus take an attributed title's colour where a
            // foreground style would be dropped.
            Text(destructive ? coloured(title, Theme.destructive) : AttributedString(title))
        } icon: {
            Image(nsImage: destructive ? IconStore.menuImage(icon, tint: Theme.destructive) : IconStore.menuImage(icon))
        }
    }

    private func coloured(_ text: String, _ color: Color) -> AttributedString {
        var attributed = AttributedString(text)
        attributed.foregroundColor = color
        return attributed
    }
}

// Menus are the system's: a dropdown from a trigger, or a context menu on
// right-click, both on Liquid Glass. Items take a leading icon and show
// their shortcut on the right; destructive last.

// MARK: - Demo

private struct MenuItems: View {
    var body: some View {
        Section("Item") {
            Button {
            } label: {
                MenuLabel("Open link", .externalLink)
            }
            .keyboardShortcut("o", modifiers: .command)
            Button {
            } label: {
                MenuLabel("Pin", .pin)
            }
            .keyboardShortcut("p", modifiers: [])
            Button {
            } label: {
                MenuLabel("Copy link", .copy)
            }
        }
        Divider()
        Button(role: .destructive) {
        } label: {
            MenuLabel("Delete", .trash, destructive: true)
        }
        .keyboardShortcut(.delete, modifiers: .command)
    }
}

extension Demo {
    static let menu = Demo(
        "Menu",
        description:
            "Dropdown from a trigger, or a context menu on right-click. The system's glass menu; icon left, shortcut right, destructive last."
    ) {
        HStack(alignment: .top, spacing: 24) {
            Menu {
                MenuItems()
            } label: {
                Icon(.dots)
            }
            .menuStyle(.button)
            .buttonStyle(.kit(.secondary, .iconMd))
            .menuIndicator(.hidden)
            .fixedSize()
            .accessibilityIdentifier("menu.trigger")

            Surface(padding: .sm) {
                Text("Right-click here")
                    .textStyle(.body)
                    .foregroundStyle(Theme.mutedForeground)
                    .frame(width: 232, height: 56)
            }
            .contextMenu { MenuItems() }
        }
    }
}
