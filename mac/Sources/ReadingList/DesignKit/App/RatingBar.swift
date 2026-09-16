import SwiftUI

enum Rating: String, CaseIterable {
    case again, hard, good, easy

    var label: String { rawValue.capitalized }

    var key: String {
        switch self {
        case .again: "1"
        case .hard: "2"
        case .good: "3"
        case .easy: "4"
        }
    }
}

/// The grades under the card in review, one group of secondary buttons at
/// the bottom centre of the stage; skip sits above them, available before
/// and after the reveal. Keeps its height when inactive so the stage does
/// not jump.
struct RatingBar: View {
    var active = true
    var revealed: Bool
    var onSkip: () -> Void = {}
    var onRate: (Rating) -> Void = { _ in }

    var body: some View {
        VStack(spacing: 8) {
            if active {
                Button(action: onSkip) {
                    Text("Skip")
                    Kbd("S")
                }
                .buttonStyle(.kit(.ghost))
                .tooltip("Set this card aside for now")
            }
            if active, revealed {
                ButtonGroup {
                    ForEach(Rating.allCases, id: \.self) { rating in
                        Button(action: { onRate(rating) }) {
                            Text(rating.label)
                            Kbd(rating.key)
                        }
                        .buttonStyle(.kit(.secondary))
                        .accessibilityIdentifier("review.rate.\(rating.rawValue)")
                    }
                }
            }
        }
        .frame(minHeight: 36, alignment: .bottom)
        .fixedSize(horizontal: false, vertical: true)
    }
}

// MARK: - Demo

private struct RatingBarDemo: View {
    @State private var front = "What does the MESI protocol's **E (Exclusive)** state guarantee?"
    @State private var back =
        "The line is present only in this cache and matches memory, so it can be written without a bus transaction."
    @State private var revealed = false
    @State private var lastRating: Rating?

    var body: some View {
        VStack(spacing: 16) {
            Flashcard(front: $front, back: $back, scale: .review, editable: false, revealed: $revealed)
            RatingBar(
                revealed: revealed, onSkip: { revealed = false },
                onRate: {
                    lastRating = $0
                    revealed = false
                })
            Text(lastRating.map { "Rated \($0.label)" } ?? "Reveal the answer to grade it")
                .textStyle(.small)
                .foregroundStyle(Theme.mutedForeground)
        }
        .frame(width: 448)
    }
}

extension Demo {
    static let ratingBar = Demo(
        "Rating bar", section: .app,
        description:
            "The grades under a revealed card: one group of secondary buttons, keys 1 to 4, with Skip above it."
    ) {
        RatingBarDemo()
    }
}
