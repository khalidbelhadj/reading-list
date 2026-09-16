import SwiftUI

// Dialogs are the system alert: destructive confirmations, and short forms
// with a text field inside the alert. No corner close button; the actions
// are the only way out. Anything bigger than a field is its own view.

// MARK: - Demo

private struct DialogDemo: View {
    @State private var confirmDelete = false
    @State private var rename = false
    @State private var tag = "distributed systems"

    var body: some View {
        HStack(spacing: 8) {
            Button("Delete item") { confirmDelete = true }
                .buttonStyle(.kit(.secondary))
                .alert("Delete this item?", isPresented: $confirmDelete) {
                    Button("Cancel", role: .cancel) {}
                    Button("Delete", role: .destructive) {}
                } message: {
                    Text("Its notes and 4 flashcards go with it. This cannot be undone.")
                }
            Button("Rename tag") { rename = true }
                .buttonStyle(.kit(.secondary))
                .alert("Rename tag", isPresented: $rename) {
                    TextField("Name", text: $tag)
                    Button("Cancel", role: .cancel) {}
                    Button("Save") {}
                } message: {
                    Text("Applies to 12 items.")
                }
        }
    }
}

extension Demo {
    static let dialog = Demo(
        "Dialog",
        description:
            "The system alert, for destructive confirmations and short forms; a text field goes inside the alert. The actions row is the only way out; anything bigger is its own view."
    ) {
        DialogDemo()
    }
}
