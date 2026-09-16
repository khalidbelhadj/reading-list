import Foundation
import Observation

/// What the pane shows.
enum Pane: Hashable {
    case items
    case item(String)
    /// The review; an item id scopes it to that item's cards.
    case review(itemId: String?)
}

/// The shell's one selection, with browser-style history over it: navigating
/// pushes, back and forward walk the stack (⌘[ and ⌘], or the toolbar
/// arrows). The URL carries nothing; this is in memory, like the web shell.
@MainActor
@Observable
final class Navigator {
    private(set) var stack: [Pane] = [.items]
    private(set) var position = 0

    var current: Pane { stack[position] }
    var canGoBack: Bool { position > 0 }
    var canGoForward: Bool { position < stack.count - 1 }

    var openItemId: String? {
        if case .item(let id) = current { return id }
        return nil
    }

    func show(_ view: Pane) {
        guard view != current else { return }
        stack = Array(stack.prefix(position + 1)) + [view]
        position = stack.count - 1
    }

    func open(_ id: String) { show(.item(id)) }
    func showItems() { show(.items) }
    func showReview(itemId: String? = nil) { show(.review(itemId: itemId)) }

    func back() {
        if canGoBack { position -= 1 }
    }

    func forward() {
        if canGoForward { position += 1 }
    }

    /// An item that vanished (deleted here or elsewhere) falls back to the list.
    func dropItem(_ id: String) {
        stack = stack.filter { $0 != .item(id) && $0 != .review(itemId: id) }
        if stack.isEmpty { stack = [.items] }
        position = min(position, stack.count - 1)
    }
}
