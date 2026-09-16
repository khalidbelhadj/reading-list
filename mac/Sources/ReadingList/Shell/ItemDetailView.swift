import SwiftUI

private let addedFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.dateFormat = "d MMMM yyyy"
    return formatter
}()

/// The selected item: its title, the date it was added, its link, and its
/// notes. Edits land in the store on every keystroke (the sidebar and lists
/// follow live) and persist with a debounced save.
struct ItemDetailView: View {
    let item: Item
    @Environment(ItemStore.self) private var store
    @State private var title: String
    @State private var editingLink = false
    @State private var linkDraft = ""
    @State private var metaHovered = false

    init(item: Item) {
        self.item = item
        _title = State(initialValue: item.title)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .top, spacing: 10) {
                    Favicon(url: item.url, storedFaviconURL: item.faviconUrl, size: 18)
                        .padding(.top, 3)
                    EditableText(text: $title, placeholder: "Untitled", onCommit: { _ in store.flush(item.id) })
                        .textStyle(.heading, .semibold)
                        .tracking(-0.2)
                        .accessibilityIdentifier("item.title")
                        .onChange(of: title) { _, next in
                            if next != item.title { store.patch(item.id, ItemPatch(title: next)) }
                        }
                }
                HStack(spacing: 12) {
                    Text("Added \(addedFormatter.string(from: item.createdAt))")
                    if let domain = item.domain {
                        TextLink(domain, variant: .quiet) { ItemActions.openLink(item) }
                            .tooltip(item.url)
                        Button(action: startLinkEdit) { Icon(.pencil, size: 12) }
                            .buttonStyle(.kit(.ghost, .iconSm))
                            .tooltip("Edit link")
                            .padding(.leading, -8)
                            .opacity(metaHovered || editingLink ? 1 : 0)
                            .accessibilityIdentifier("item.edit-link")
                            .popover(isPresented: $editingLink, arrowEdge: .bottom) { linkPopover }
                    } else {
                        TextLink("Add link", variant: .quiet, action: startLinkEdit)
                            .accessibilityIdentifier("item.edit-link")
                            .popover(isPresented: $editingLink, arrowEdge: .bottom) { linkPopover }
                    }
                }
                .textStyle(.small)
                .foregroundStyle(Theme.mutedForeground)
                .frame(minHeight: 20)
                .onHover { metaHovered = $0 }

                NotesEditor(itemId: item.id, notes: item.notes ?? "")
                    .padding(.top, 24)
            }
            .frame(maxWidth: 576, alignment: .leading)
            .padding(.horizontal, 32)
            .padding(.top, 48)
            .padding(.bottom, 64)
            .frame(maxWidth: .infinity)
        }
    }

    /// The link editor: the url preselected so a paste replaces it, Return
    /// or Save commits, Escape or Cancel leaves it.
    private var linkPopover: some View {
        PopoverContent(title: item.url.isEmpty ? "Add link" : "Edit link") {
            Button("Cancel") { editingLink = false }.buttonStyle(.kit(.ghost))
            Button("Save", action: commitLink).buttonStyle(.kit(.primary))
        } content: {
            Input(
                text: $linkDraft, placeholder: "https://", leading: .icon(.link), autofocus: true, selectAll: true,
                onSubmit: commitLink
            )
            .accessibilityIdentifier("item.link-field")
        }
    }

    private func startLinkEdit() {
        linkDraft = item.url
        editingLink = true
    }

    private func commitLink() {
        let trimmed = linkDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed != item.url else {
            editingLink = false
            return
        }
        if trimmed.isEmpty {
            editingLink = false
            store.patch(item.id, ItemPatch(url: ""))
            store.flush(item.id)
            return
        }
        guard let url = URL(string: trimmed), let scheme = url.scheme?.lowercased(),
            scheme == "http" || scheme == "https"
        else {
            Notifier.shared.notify(
                NotifyOptions(
                    title: "Invalid link", description: "Links must start with http:// or https://.", meta: "now",
                    tone: .error
                ))
            return
        }
        editingLink = false
        // A placeholder title follows the new link: the server fetches the page's.
        store.patch(item.id, ItemPatch(url: trimmed, refreshTitle: item.hasPlaceholderTitle ? true : nil))
        store.flush(item.id)
    }
}

/// The notes: the hosted markdown editor, live, like the web's. Every
/// change goes to the store, which debounces the save; images upload
/// through the API.
private struct NotesEditor: View {
    let itemId: String
    let notes: String
    @Environment(ItemStore.self) private var store

    var body: some View {
        MarkdownEditor(
            text: Binding(
                get: { notes },
                set: { next in if next != notes { store.patch(itemId, ItemPatch(notes: next)) } }
            ),
            placeholder: "Notes",
            onUploadImage: { data, contentType in try await store.uploadImage(data, contentType: contentType) },
            identifier: "item.notes"
        )
        // The page pads its own content; line it up with the title.
        .padding(.horizontal, -16)
    }
}
