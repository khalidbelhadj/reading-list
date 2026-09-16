import SwiftUI

struct ReviewStackSource: Identifiable {
    let id: String
    let title: String
    let url: String
    /// Cards of this item in the stack; zero means the source is on-topic
    /// but has nothing to review yet.
    let cardCount: Int
}

struct ReviewStackStats {
    var cards: Int
    var due: Int
    var fresh: Int
    var cram: Int
}

private struct Stat: View {
    let value: Int
    let label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(String(value))
                .textStyle(.heading)
                .monospacedDigit()
            Text(label)
                .textStyle(.micro)
                .foregroundStyle(Theme.mutedForeground)
        }
    }
}

/// A compiled review stack, presented before it starts: what it covers, how
/// many cards and of what kind, and the sources they come from. Sources
/// with no cards are listed too, because that is where cards are missing.
struct ReviewStackCard: View {
    let title: String
    let summary: String
    let stats: ReviewStackStats
    let sources: [ReviewStackSource]
    var onOpenSource: ((String) -> Void)?
    /// Absent when there is nothing to start.
    var onStart: (() -> Void)?

    private var footer: String {
        if stats.cards > 0 { return "Due and new cards are scheduled; the rest is a cram pass." }
        if !sources.isEmpty { return "These sources are on topic, but none of them have flashcards yet." }
        return "Nothing in the deck matches this yet."
    }

    var body: some View {
        Surface {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).textStyle(.title, .medium)
                    if !summary.isEmpty {
                        Text(summary)
                            .textStyle(.small)
                            .foregroundStyle(Theme.mutedForeground)
                    }
                }
                HStack(spacing: 24) {
                    Stat(value: stats.cards, label: "cards")
                    Stat(value: sources.count, label: "sources")
                    Stat(value: stats.due, label: "due")
                    Stat(value: stats.fresh, label: "new")
                    Stat(value: stats.cram, label: "cram")
                }
                if !sources.isEmpty {
                    VStack(spacing: 2) {
                        ForEach(sources) { source in
                            ListRow(
                                title: source.title.isEmpty ? "Untitled" : source.title,
                                meta: source.cardCount > 0
                                    ? "\(source.cardCount) card\(source.cardCount == 1 ? "" : "s")" : nil,
                                muted: source.cardCount == 0,
                                action: onOpenSource.map { open in { open(source.id) } }
                            ) {
                                Favicon(url: source.url, size: 14)
                            } trailing: {
                                if source.cardCount == 0 { Badge("no cards", variant: .outline) }
                            }
                        }
                    }
                    .padding(.horizontal, -8)
                }
                HStack(alignment: .center, spacing: 12) {
                    Text(footer)
                        .textStyle(.micro)
                        .foregroundStyle(Theme.mutedForeground)
                    Spacer(minLength: 0)
                    if let onStart {
                        Button("Review \(stats.cards) card\(stats.cards == 1 ? "" : "s")", action: onStart)
                            .buttonStyle(.kit(.primary))
                    }
                }
            }
        }
    }
}

// MARK: - Demo

extension Demo {
    static let reviewStackCard = Demo(
        "Review stack card", section: .app,
        description:
            "A compiled stack before it starts: title, the agent's summary, the card split, and the sources with their card counts. A source with no cards is listed muted so the gap shows."
    ) {
        VStack(spacing: 16) {
            ReviewStackCard(
                title: "Self-supervised learning",
                summary:
                    "Redundancy-reduction methods (Barlow Twins, VICReg) and how they avoid representational collapse.",
                stats: ReviewStackStats(cards: 18, due: 5, fresh: 10, cram: 3),
                sources: [
                    ReviewStackSource(
                        id: "1", title: "Barlow Twins: Self-Supervised Learning via Redundancy Reduction",
                        url: "https://arxiv.org/abs/2103.03230", cardCount: 8),
                    ReviewStackSource(
                        id: "2",
                        title: "VICReg: Variance-Invariance-Covariance Regularization for Self-Supervised Learning",
                        url: "https://arxiv.org/abs/2105.04906", cardCount: 10),
                    ReviewStackSource(
                        id: "3", title: "A Cookbook of Self-Supervised Learning",
                        url: "https://arxiv.org/abs/2304.12210", cardCount: 0),
                ],
                onOpenSource: { _ in },
                onStart: {}
            )
            ReviewStackCard(
                title: "Distributed systems",
                summary: "Plenty of reading on the topic, but no cards written yet.",
                stats: ReviewStackStats(cards: 0, due: 0, fresh: 0, cram: 0),
                sources: [
                    ReviewStackSource(
                        id: "4", title: "FoundationDB: A Distributed Unbundled Transactional KeyValue Store",
                        url: "https://www.foundationdb.org/files/fdb-paper.pdf", cardCount: 0),
                    ReviewStackSource(
                        id: "5", title: "The Snowflake Elastic Data Warehouse",
                        url: "https://dl.acm.org/doi/10.1145/2882903.2903741", cardCount: 0),
                ]
            )
        }
        .frame(width: 576)
    }
}
