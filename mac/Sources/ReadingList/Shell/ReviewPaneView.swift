import AppKit
import SwiftUI

/// The always-on review, local-first (components/shell/review-pane.tsx):
/// the queue is frozen from the deck the moment the pane opens, so
/// background refetches never reshuffle a run; rating a card is a single
/// fire-and-forget scheduling update; there is no session. Review one card
/// or all of them, then just leave. An item id scopes the pane to that
/// item's cards, the due ones or all of them (a cram, scheduling untouched).
struct ReviewPaneView: View {
    var itemId: String?
    @Environment(FlashcardStore.self) private var deck
    @Environment(ItemStore.self) private var store
    @Environment(Navigator.self) private var navigator

    @State private var mode: ReviewQueues.Standing = .due
    /// Nil until the cards arrive: Due when the item has due cards, All
    /// (cram) otherwise.
    @State private var scopedMode: ScopedMode?
    @State private var queue: [Card]?
    @State private var index = 0
    @State private var revealed = false
    @State private var deckOpen = false
    /// The card on stage's editable copy; the end of an edit saves it.
    @State private var draft = CardDraft()
    @State private var keyMonitor: Any?

    enum ScopedMode: String, CaseIterable { case due, all }

    private var card: Card? {
        guard let queue, index < queue.count else { return nil }
        return queue[index]
    }
    private var loaded: Bool { queue != nil }
    private var remaining: Int { (queue?.count ?? 0) - index }
    private var scopeItem: Item? { itemId.flatMap { store.item($0) } }

    var body: some View {
        ZStack(alignment: .topLeading) {
            if deckOpen {
                DeckView { deckOpen = false }
            } else {
                stage
                header
                    .padding(.top, 12)
                    .padding(.leading, 16)
                TextLink(variant: .quiet, action: { deckOpen = true }) { Text("All cards") }
                    .textStyle(.micro, .medium)
                    .padding(.top, 16)
                    .padding(.trailing, 16)
                    .frame(maxWidth: .infinity, alignment: .topTrailing)
                    .accessibilityIdentifier("review.all-cards")
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear {
            freezeIfNeeded()
            installKeys()
        }
        .onDisappear {
            removeKeys()
            // Reconcile locally advanced due dates with the server's
            // scheduling on the way out of a run.
            deck.refresh()
        }
        .onChange(of: deck.hasLoaded) { freezeIfNeeded() }
        .onChange(of: store.hasLoaded) { freezeIfNeeded() }
        .onChange(of: mode) { reset() }
        .onChange(of: scopedMode) { reset() }
    }

    // MARK: The stage

    private var stage: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)
            if !loaded {
                Skeleton()
                    .frame(maxWidth: 576)
                    .frame(height: 192)
            } else if let card {
                ReviewCardView(
                    card: card, draft: $draft, revealed: revealedBinding, onCommit: commitDraft,
                    onOpenItem: { if let itemId = card.itemId { navigator.open(itemId) } }
                )
                .frame(maxWidth: 576)
                .id(card.id)
            } else {
                EmptyState(title: "All done", description: emptyDescription)
                    .accessibilityIdentifier("review.done")
            }
            Spacer(minLength: 0)
            RatingBar(active: loaded && card != nil, revealed: revealed, onSkip: skip, onRate: rate)
                .padding(.top, 16)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 48)
        .padding(.top, 48)
        .padding(.bottom, 24)
    }

    private var emptyDescription: String {
        if itemId != nil { return "This item has no cards." }
        return mode == .new ? "No new cards right now." : "No cards are due right now."
    }

    /// The Due/New switch (or the cram label when item-scoped) with the count.
    private var header: some View {
        HStack(spacing: 12) {
            if itemId != nil {
                Select(
                    selection: Binding(get: { scopedMode ?? .due }, set: { if let next = $0 { scopedMode = next } }),
                    items: [SelectItem(value: ScopedMode.due, label: "Due"), SelectItem(value: .all, label: "All")]
                )
                .frame(width: 80)
                .accessibilityIdentifier("review.scope")
                if loaded { Text("\(remaining) left").monospacedDigit() }
                HStack(spacing: 4) {
                    Text(scopedMode == .all ? "Cramming" : "Due in")
                    if let scopeItem {
                        Favicon(url: scopeItem.url, storedFaviconURL: scopeItem.faviconUrl, size: 12)
                        Text(scopeItem.displayTitle).lineLimit(1).frame(maxWidth: 224, alignment: .leading)
                    }
                    if scopedMode == .all { Text(", scheduling untouched") }
                }
            } else {
                Select(
                    selection: Binding(get: { mode }, set: { if let next = $0 { mode = next } }),
                    items: [
                        SelectItem(value: ReviewQueues.Standing.due, label: "Due"),
                        SelectItem(value: .new, label: "New"),
                    ]
                )
                .frame(width: 80)
                .accessibilityIdentifier("review.mode")
                if loaded, card != nil { Text("\(remaining) left").monospacedDigit() }
            }
        }
        .textStyle(.small)
        .foregroundStyle(Theme.mutedForeground)
    }

    // MARK: The queue

    /// Frozen on entry, per mode, from the first data that arrives (usually
    /// the snapshot, instantly). The standing queues need the items too:
    /// hidden-from-review lives on the item.
    private func freezeIfNeeded() {
        guard queue == nil, deck.hasLoaded else { return }
        if let itemId {
            let (all, due) = ReviewQueues.forItem(deck.cards, itemId: itemId)
            guard let scopedMode else {
                self.scopedMode = due.isEmpty ? .all : .due
                return
            }
            setQueue(scopedMode == .due ? due : all)
            return
        }
        guard store.hasLoaded else { return }
        setQueue(ReviewQueues.standing(deck.cards, items: store.items, mode: mode))
    }

    private func reset() {
        queue = nil
        index = 0
        revealed = false
        freezeIfNeeded()
    }

    private func setQueue(_ cards: [Card]) {
        queue = cards
        index = 0
        revealed = false
        loadDraft()
    }

    private func advance() {
        index += 1
        revealed = false
        loadDraft()
    }

    private func loadDraft() {
        draft = CardDraft(front: card?.front ?? "", back: card?.back ?? "")
    }

    /// Reveal through the card's own hint plays the sound too.
    private var revealedBinding: Binding<Bool> {
        Binding(get: { revealed }, set: { if $0 { reveal() } else { revealed = false } })
    }

    private func reveal() {
        guard !revealed else { return }
        Sounds.shared.cardRevealed()
        revealed = true
    }

    /// A scoped All-cards run is a cram: it never touches the schedule.
    private func rate(_ rating: Rating) {
        guard let queue, let card else { return }
        let affectsSchedule = !(itemId != nil && scopedMode == .all)
        deck.rate(card.id, rating, affectsSchedule: affectsSchedule)
        // The last card's rating ends the run: the finish chord replaces
        // the tap, since the two smear together.
        if index == queue.count - 1 {
            Sounds.shared.queueFinished()
        } else {
            Sounds.shared.cardRated(step: Rating.allCases.firstIndex(of: rating) ?? 0)
        }
        advance()
    }

    /// Skip sets the card aside for this run only; nothing is written.
    private func skip() {
        guard let queue, card != nil else { return }
        if index == queue.count - 1 { Sounds.shared.queueFinished() } else { Sounds.shared.cardSkipped() }
        advance()
    }

    /// An untouched edit (click in, click out) must not save: the notes
    /// rewrite canonicalises the card block, so a no-op would still reformat.
    private func commitDraft() {
        guard let card, draft.front != card.front || draft.back != card.back else { return }
        queue?[index].front = draft.front
        queue?[index].back = draft.back
        deck.edit(card.id, front: draft.front, back: draft.back, items: store)
    }

    // MARK: Keys

    /// Space reveals, 1 to 4 rate once revealed, S skips. Typing contexts
    /// are left alone.
    private func installKeys() {
        guard keyMonitor == nil else { return }
        keyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            let handled = MainActor.assumeIsolated { handle(event) }
            return handled ? nil : event
        }
    }

    private func removeKeys() {
        if let keyMonitor { NSEvent.removeMonitor(keyMonitor) }
        keyMonitor = nil
    }

    private func handle(_ event: NSEvent) -> Bool {
        guard !deckOpen, card != nil, event.modifierFlags.intersection([.command, .control, .option]).isEmpty else {
            return false
        }
        if NSApp.keyWindow?.firstResponder is NSTextView { return false }
        switch event.charactersIgnoringModifiers?.lowercased() {
        case " ":
            guard !revealed else { return false }
            reveal()
            return true
        case "s":
            skip()
            return true
        case let key? where revealed:
            guard let rating = Rating.allCases.first(where: { $0.key == key }) else { return false }
            rate(rating)
            return true
        default:
            return false
        }
    }
}

/// The editable copy of the card on stage.
struct CardDraft: Equatable {
    var front = ""
    var back = ""
}

/// The card on stage: its source line (the item, click to open it) and the
/// flashcard itself, editable in place.
private struct ReviewCardView: View {
    let card: Card
    @Binding var draft: CardDraft
    @Binding var revealed: Bool
    let onCommit: () -> Void
    let onOpenItem: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let title = card.itemTitle, !title.isEmpty {
                Button(action: onOpenItem) {
                    HStack(spacing: 6) {
                        Favicon(url: card.itemUrl ?? "", storedFaviconURL: card.itemFaviconUrl, size: 12)
                        Text(title).lineLimit(1)
                    }
                }
                .buttonStyle(.kit(.ghost, .sm))
                .foregroundStyle(Theme.mutedForeground)
                .disabled(card.itemId == nil)
                .padding(.leading, -4)
                .tooltip("Open item")
                .accessibilityIdentifier("review.source")
            }
            Flashcard(front: $draft.front, back: $draft.back, scale: .review, revealed: $revealed, onCommit: onCommit)
                .accessibilityIdentifier("review.card")
        }
    }
}
