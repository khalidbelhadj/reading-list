import Foundation

/// A card's place in the schedule (lib/srs.ts).
enum CardState: String, Codable, Sendable {
    case new, learning, review, relearning
}

/// The scheduling fields on a card, as the server keeps them.
struct SrsState: Equatable, Sendable {
    var state: CardState
    var interval: Int
    var easeFactor: Double
    var reps: Int
    var lapses: Int
    var due: Date
}

/// The scheduler, ported line for line from lib/srs.ts so the app can move
/// a card's schedule the moment it is rated, exactly as the server will
/// (mac/Tests checks the two agree).
enum SRS {
    private static let learningStepMinutes = 10.0
    private static let hardLearningStepMinutes = 15.0
    private static let graduatingIntervalDays = 1
    private static let easyIntervalDays = 4
    private static let relearnStepMinutes = 10.0
    private static let minEase = 1.3
    private static let hardIntervalMultiplier = 1.2
    private static let easyBonus = 1.3

    static func schedule(_ prev: SrsState, _ rating: Rating, now: Date) -> SrsState {
        let isGraduated = prev.state == .review
        let isRelearning = prev.state == .relearning

        if !isGraduated, !isRelearning {
            switch rating {
            case .again:
                return SrsState(
                    state: .learning, interval: 0, easeFactor: prev.easeFactor, reps: 0, lapses: prev.lapses,
                    due: now.addingTimeInterval(learningStepMinutes * 60)
                )
            case .hard:
                return SrsState(
                    state: .learning, interval: 0, easeFactor: prev.easeFactor, reps: prev.reps, lapses: prev.lapses,
                    due: now.addingTimeInterval(hardLearningStepMinutes * 60)
                )
            case .good, .easy:
                return graduate(prev, rating, now: now)
            }
        }

        if isRelearning {
            switch rating {
            case .again, .hard:
                return SrsState(
                    state: .relearning, interval: prev.interval, easeFactor: prev.easeFactor, reps: prev.reps,
                    lapses: prev.lapses, due: now.addingTimeInterval(relearnStepMinutes * 60)
                )
            case .good, .easy:
                return graduate(prev, rating, now: now)
            }
        }

        switch rating {
        case .again:
            return SrsState(
                state: .relearning, interval: 0, easeFactor: clampEase(prev.easeFactor - 0.2), reps: prev.reps,
                lapses: prev.lapses + 1, due: now.addingTimeInterval(relearnStepMinutes * 60)
            )
        case .hard:
            let interval = max(1, roundHalfUp(Double(prev.interval) * hardIntervalMultiplier))
            return SrsState(
                state: .review, interval: interval, easeFactor: clampEase(prev.easeFactor - 0.15), reps: prev.reps + 1,
                lapses: prev.lapses, due: addDays(now, interval)
            )
        case .good:
            let interval = max(1, roundHalfUp(Double(prev.interval) * prev.easeFactor))
            return SrsState(
                state: .review, interval: interval, easeFactor: prev.easeFactor, reps: prev.reps + 1,
                lapses: prev.lapses, due: addDays(now, interval)
            )
        case .easy:
            let interval = max(1, roundHalfUp(Double(prev.interval) * prev.easeFactor * easyBonus))
            return SrsState(
                state: .review, interval: interval, easeFactor: prev.easeFactor + 0.15, reps: prev.reps + 1,
                lapses: prev.lapses, due: addDays(now, interval)
            )
        }
    }

    /// Graduation to review on good or easy is the same from learning and
    /// relearning: a fixed interval, one more rep, ease untouched.
    private static func graduate(_ prev: SrsState, _ rating: Rating, now: Date) -> SrsState {
        let interval = rating == .easy ? easyIntervalDays : graduatingIntervalDays
        return SrsState(
            state: .review, interval: interval, easeFactor: prev.easeFactor, reps: prev.reps + 1, lapses: prev.lapses,
            due: addDays(now, interval)
        )
    }

    private static func clampEase(_ ease: Double) -> Double { max(minEase, ease) }
    private static func addDays(_ date: Date, _ days: Int) -> Date { date.addingTimeInterval(Double(days) * 86_400) }
    /// JavaScript's Math.round: halves go up.
    private static func roundHalfUp(_ value: Double) -> Int { Int((value + 0.5).rounded(.down)) }
}
