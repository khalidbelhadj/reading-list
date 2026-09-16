import Foundation
import ReadingListAPI

/// A flashcard with its scheduling state and its item, as the deck lists
/// them (`Flashcard` is the kit's view of one).
struct Card: Identifiable, Codable, Equatable, Sendable {
    let id: String
    var front: String
    var back: String
    var state: CardState
    var due: Date
    var interval: Int
    var easeFactor: Double
    var reps: Int
    var lapses: Int
    let itemId: String?
    var itemTitle: String?
    var itemUrl: String?
    var itemFaviconUrl: String?
    let createdAt: Date
    var updatedAt: Date

    var srs: SrsState {
        get { SrsState(state: state, interval: interval, easeFactor: easeFactor, reps: reps, lapses: lapses, due: due) }
        set {
            state = newValue.state
            interval = newValue.interval
            easeFactor = newValue.easeFactor
            reps = newValue.reps
            lapses = newValue.lapses
            due = newValue.due
        }
    }

    /// From the wire: timestamps arrive as strings, the state as text.
    init?(wire: Components.Schemas.Flashcard) {
        guard let state = CardState(rawValue: wire.state), let due = Timestamps.parse(wire.due),
            let createdAt = Timestamps.parse(wire.createdAt), let updatedAt = Timestamps.parse(wire.updatedAt)
        else { return nil }
        self.id = wire.id
        self.front = wire.front
        self.back = wire.back
        self.state = state
        self.due = due
        self.interval = wire.interval
        self.easeFactor = wire.easeFactor
        self.reps = wire.reps
        self.lapses = wire.lapses
        self.itemId = wire.itemId
        self.itemTitle = wire.itemTitle
        self.itemUrl = wire.itemUrl
        self.itemFaviconUrl = wire.itemFaviconUrl
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

/// The review queues, derived from the deck in memory the way the web
/// derives them from its cache (components/shell/review-queues.ts and
/// review-order.ts): nothing is asked of the server.
enum ReviewQueues {
    enum Standing { case due, new }

    /// Never-studied cards default `due` to their creation time, so "due"
    /// means scheduled and due: studied at least once.
    static func isDue(_ card: Card, now: Date) -> Bool {
        card.state != .new && card.due <= now
    }

    /// An item's cards, and the due slice of them, ordered by due date.
    static func forItem(_ cards: [Card], itemId: String, now: Date = Date()) -> (all: [Card], due: [Card]) {
        let itemCards = cards.filter { $0.itemId == itemId }
        let dueCards = itemCards.filter { isDue($0, now: now) }.sorted { $0.due < $1.due }
        return (itemCards, dueCards)
    }

    /// A standing queue over the whole deck, excluding cards on items hidden
    /// from review (orphan cards are always kept), dealt round-robin across
    /// items so a run moves between subjects.
    static func standing(_ cards: [Card], items: [Item], mode: Standing, now: Date = Date()) -> [Card] {
        let hidden = Set(items.filter(\.hiddenFromReview).map(\.id))
        return interleaveByItem(
            cards.filter { card in
                let wanted = mode == .due ? isDue(card, now: now) : card.state == .new
                return wanted && (card.itemId.map { !hidden.contains($0) } ?? true)
            })
    }

    /// Cards sorted by due date, then interleaved by item: items ranked by
    /// their most overdue card, each round taking the next card from every
    /// item in that order. Cards from one item are born and rated together,
    /// so a plain due sort would show them back to back forever.
    static func interleaveByItem(_ cards: [Card]) -> [Card] {
        let sorted = cards.sorted { $0.due < $1.due }
        var order: [String] = []
        var lanes: [String: [Card]] = [:]
        for card in sorted {
            let key = card.itemId ?? "card:\(card.id)"
            if lanes[key] == nil { order.append(key) }
            lanes[key, default: []].append(card)
        }
        var result: [Card] = []
        var round = 0
        while result.count < sorted.count {
            for key in order {
                if let lane = lanes[key], round < lane.count { result.append(lane[round]) }
            }
            round += 1
        }
        return result
    }
}
