import SwiftUI

/// View > Design board (⇧⌘D) opens the board window.
struct BoardCommands: Commands {
    @Environment(\.openWindow) private var openWindow

    var body: some Commands {
        CommandGroup(after: .toolbar) {
            Button("Design board") {
                _ = BoardState.shared.open(nil)
            }
            .keyboardShortcut("d", modifiers: [.command, .shift])
        }
    }
}
