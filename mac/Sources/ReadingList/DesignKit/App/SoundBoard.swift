import SwiftUI

struct SoundEntry: Identifiable {
    let label: String
    /// What the sound marks, in a few words.
    let moment: String
    let play: () -> Void
    var id: String { label }
}

/// The app's sounds laid out to audition: one button per moment.
struct SoundBoard: View {
    let sounds: [SoundEntry]

    var body: some View {
        VStack(spacing: 2) {
            ForEach(sounds) { sound in
                HStack(spacing: 12) {
                    Button(action: sound.play) {
                        Text(sound.label).frame(width: 96, alignment: .leading)
                    }
                    .buttonStyle(.kit(.secondary, .sm))
                    Text(sound.moment)
                        .textStyle(.small)
                        .foregroundStyle(Theme.mutedForeground)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 8)
                .frame(height: Theme.rowHeight)
            }
        }
    }
}

// MARK: - Demo

extension Demo {
    static let soundBoard = Demo(
        "Sound board", section: .app,
        description:
            "Every sound the app makes, to audition: short sine taps from one family (see Sounds in DESIGN.md). Click to play."
    ) {
        SoundBoard(sounds: [
            SoundEntry(label: "Pasted", moment: "A url lands in the list") { Sounds.shared.itemCreated() },
            SoundEntry(label: "Reveal", moment: "The answer shows") { Sounds.shared.cardRevealed() },
            SoundEntry(label: "Again", moment: "Rated again") { Sounds.shared.cardRated(step: 0) },
            SoundEntry(label: "Hard", moment: "Rated hard") { Sounds.shared.cardRated(step: 1) },
            SoundEntry(label: "Good", moment: "Rated good") { Sounds.shared.cardRated(step: 2) },
            SoundEntry(label: "Easy", moment: "Rated easy") { Sounds.shared.cardRated(step: 3) },
            SoundEntry(label: "Skip", moment: "Card set aside") { Sounds.shared.cardSkipped() },
            SoundEntry(label: "Finished", moment: "The queue is done") { Sounds.shared.queueFinished() },
            SoundEntry(label: "Stack", moment: "A compiled stack starts") { Sounds.shared.stackStarted() },
            SoundEntry(label: "Star", moment: "Item starred") { Sounds.shared.itemStarred() },
            SoundEntry(label: "Unstar", moment: "Item unstarred") { Sounds.shared.itemUnstarred() },
            SoundEntry(label: "Delete", moment: "Item deleted") { Sounds.shared.itemDeleted() },
            SoundEntry(label: "Error", moment: "Something failed") { Sounds.shared.error() },
        ])
        .frame(width: 448)
    }
}
