import Foundation
import Observation
import ReadingListAPI

/// The deck, in memory, with a snapshot on disk like the items. Review is
/// local-first and sessionless (components/shell/review-pane.tsx): queues
/// are derived from these cards, rating one moves its schedule here at
/// once with the same scheduler the server runs, and the write follows in
/// the background.
@MainActor
@Observable
final class FlashcardStore {
    private(set) var cards: [Card] = []
    private(set) var hasLoaded = false
    private(set) var lastSyncedAt: Date?
    private(set) var lastRefreshError: String?

    private let api: ItemsAPI
    private let snapshot: SnapshotStore<CardSnapshot>
    private var refreshTask: Task<Void, Never>?

    init(api: ItemsAPI, snapshot: SnapshotStore<CardSnapshot>) {
        self.api = api
        self.snapshot = snapshot
    }

    func card(_ id: String) -> Card? {
        cards.first { $0.id == id }
    }

    /// The last snapshot, instantly; then the server, in the background.
    func start() {
        if let saved = snapshot.load() {
            cards = saved.cards
            lastSyncedAt = saved.syncedAt
            hasLoaded = true
        }
        refresh()
    }

    func refresh() {
        guard refreshTask == nil else { return }
        refreshTask = Task { [weak self] in
            guard let self else { return }
            defer { refreshTask = nil }
            do {
                cards = try await api.fetchFlashcards()
                lastSyncedAt = Date()
                lastRefreshError = nil
                hasLoaded = true
                persist()
            } catch {
                lastRefreshError = ErrorSummary(error).message
                if !hasLoaded {
                    hasLoaded = true
                    report("Could not load the deck", error)
                }
            }
        }
    }

    /// The sidebar's due count, from the same deck the review pane freezes
    /// its queue from.
    func dueCount(items: [Item]) -> Int {
        ReviewQueues.standing(cards, items: items, mode: .due).count
    }

    // MARK: Writes

    /// Rate a card: the schedule moves here at once (unless this is a cram
    /// pass) and the server follows.
    func rate(_ id: String, _ rating: Rating, affectsSchedule: Bool) {
        guard let index = cards.firstIndex(where: { $0.id == id }) else { return }
        let now = Date()
        if affectsSchedule {
            cards[index].srs = SRS.schedule(cards[index].srs, rating, now: now)
            cards[index].updatedAt = now
            persist()
        }
        Task { [weak self] in
            guard let self else { return }
            do {
                try await api.rateCard(id: id, rating: rating, affectsSchedule: affectsSchedule)
            } catch {
                report("Could not save the review", error)
                refresh()
            }
        }
    }

    /// Save an edit to a card's sides. A card that belongs to an item is
    /// saved through the item's notes, its source of truth: the block is
    /// rewritten there and the item updated, and the server's notes-to-cards
    /// sync updates the row. Editing the row directly would be reverted by
    /// the next notes save. An orphan card has no notes and updates its row.
    func edit(_ id: String, front: String, back: String, items: ItemStore) {
        guard let index = cards.firstIndex(where: { $0.id == id }) else { return }
        cards[index].front = front
        cards[index].back = back
        persist()
        if let itemId = cards[index].itemId, let notes = items.item(itemId)?.notes,
            let rewritten = CardNotes.replaceCard(in: notes, id: id, front: front, back: back)
        {
            items.patch(itemId, ItemPatch(notes: rewritten))
            return
        }
        Task { [weak self] in
            guard let self else { return }
            do {
                try await api.updateFlashcard(id: id, front: front, back: back)
            } catch {
                report("Could not save the card", error)
                refresh()
            }
        }
    }

    private func persist() {
        snapshot.save(CardSnapshot(cards: cards, syncedAt: lastSyncedAt ?? Date()))
    }

    private func report(_ title: String, _ error: Error) {
        let summary = ErrorSummary(error)
        Notifier.shared.notify(
            NotifyOptions(
                title: title, description: summary.message, detail: summary.detail, meta: "now", tone: .error
            ))
    }
}

struct CardSnapshot: Codable {
    let cards: [Card]
    let syncedAt: Date
}
