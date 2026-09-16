import Foundation
import Observation

extension Notification.Name {
    /// Asks the app to open (or front) the design board window.
    static let openDesignBoard = Notification.Name("ReadingList.openDesignBoard")
}

/// What the design board shows: one component, or everything. Shared so the
/// debug socket (`bun run mac board <name>`) can drive it.
@MainActor
@Observable
final class BoardState {
    static let shared = BoardState()
    static let everything = "everything"

    var selection: String = BoardState.everything

    /// Selects a demo by slug or title and asks for the window.
    func open(_ name: String?) -> Bool {
        if let name, !name.isEmpty, name != Self.everything {
            let wanted = Demo.slug(name)
            guard
                let demo = Demo.all.first(where: { $0.id == wanted })
                    ?? Demo.all.first(where: { $0.id.hasPrefix(wanted) })
            else { return false }
            selection = demo.id
        } else {
            selection = Self.everything
        }
        NotificationCenter.default.post(name: .openDesignBoard, object: nil)
        return true
    }
}
