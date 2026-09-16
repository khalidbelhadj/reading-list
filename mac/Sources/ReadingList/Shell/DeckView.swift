import SwiftUI

/// The deck: every card, grouped by item, answers shown, editable in place.
/// The quiet layer behind the review.
struct DeckView: View {
    let onBack: () -> Void
    @Environment(FlashcardStore.self) private var deck
    @Environment(ItemStore.self) private var store

    private struct Group: Identifiable {
        let id: String
        let title: String
        let url: String
        let faviconUrl: String?
        var cards: [Card]
    }

    /// Keyed by item id, not title: two items can share a title.
    private var groups: [Group] {
        var order: [String] = []
        var byItem: [String: Group] = [:]
        for card in deck.cards {
            let key = card.itemId ?? ""
            if byItem[key] == nil {
                order.append(key)
                byItem[key] = Group(
                    id: key, title: card.itemTitle.flatMap { $0.isEmpty ? nil : $0 } ?? "No item",
                    url: card.itemUrl ?? "", faviconUrl: card.itemFaviconUrl, cards: []
                )
            }
            byItem[key]?.cards.append(card)
        }
        return order.compactMap { byItem[$0] }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack(alignment: .firstTextBaseline) {
                    Text(deck.hasLoaded ? "\(deck.cards.count) cards" : "Cards")
                        .textStyle(.small)
                        .foregroundStyle(Theme.mutedForeground)
                    Spacer()
                    TextLink(variant: .quiet, action: onBack) { Text("Back to review") }
                        .textStyle(.micro, .medium)
                        .accessibilityIdentifier("deck.back")
                }
                if deck.hasLoaded {
                    ForEach(groups) { group in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(spacing: 6) {
                                if !group.id.isEmpty {
                                    Favicon(url: group.url, storedFaviconURL: group.faviconUrl, size: 12)
                                }
                                Text(group.title).lineLimit(1)
                            }
                            .textStyle(.small)
                            .foregroundStyle(Theme.mutedForeground)
                            .padding(.horizontal, 8)
                            VStack(spacing: 6) {
                                ForEach(group.cards) { card in
                                    DeckCardRow(card: card)
                                }
                            }
                        }
                    }
                } else {
                    VStack(spacing: 6) {
                        ForEach(0..<6, id: \.self) { _ in Skeleton().frame(height: 64) }
                    }
                }
            }
            .frame(maxWidth: 576)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 32)
            .padding(.top, 48)
            .padding(.bottom, 64)
        }
    }
}

/// One card in the deck, with its own editable copy; the end of an edit
/// saves it when something changed.
private struct DeckCardRow: View {
    let card: Card
    @Environment(FlashcardStore.self) private var deck
    @Environment(ItemStore.self) private var store
    @State private var front = ""
    @State private var back = ""

    var body: some View {
        Flashcard(front: $front, back: $back, revealed: .constant(true), onCommit: commit)
            .onAppear {
                front = card.front
                back = card.back
            }
            .onChange(of: card.front) { _, next in front = next }
            .onChange(of: card.back) { _, next in back = next }
            .accessibilityIdentifier("deck.card.\(card.id)")
    }

    private func commit() {
        guard front != card.front || back != card.back else { return }
        deck.edit(card.id, front: front, back: back, items: store)
    }
}
