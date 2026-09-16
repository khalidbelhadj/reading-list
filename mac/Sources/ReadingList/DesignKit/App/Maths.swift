import SwiftUI

// The mental maths types the charts need (lib/mental-maths.ts).

enum MathsOperation: String {
    case addition, subtraction, multiplication, division

    var symbol: String {
        switch self {
        case .addition: "+"
        case .subtraction: "−"
        case .multiplication: "×"
        case .division: "÷"
        }
    }
}

struct MathsProblem {
    let operation: MathsOperation
    let left: Int
    let right: Int
    let answer: Int

    var formatted: String { "\(left) \(operation.symbol) \(right)" }
}

struct MathsAttempt {
    let problem: MathsProblem
    let correct: Bool
    let ms: Double
}

struct MathsRun {
    let at: Date
    let solved: Int
    let attempts: Int
    let averageMs: Double
}

func formatSeconds(_ ms: Double) -> String {
    String(format: "%.1fs", ms / 1000)
}

private let shortDate: DateFormatter = {
    let formatter = DateFormatter()
    formatter.dateFormat = "d MMM"
    return formatter
}()

private struct MathsStat: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .textStyle(.title, .medium)
                .monospacedDigit()
            Text(label)
                .textStyle(.small)
                .foregroundStyle(Theme.mutedForeground)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The record behind one configuration: how many runs, the best, the
/// typical, and solved-per-run over the recent runs with the best labelled.
struct MathsHistory: View {
    let runs: [MathsRun]
    private let shownRuns = 20
    private let chartHeight: CGFloat = 56

    private var recent: [MathsRun] { Array(runs.sorted { $0.at < $1.at }.suffix(shownRuns)) }

    private var columns: [ChartColumn] {
        let recent = recent
        let bestIndex = recent.indices.max { recent[$0].solved < recent[$1].solved } ?? 0
        return recent.enumerated().map { index, run in
            ChartColumn(
                id: run.at.description,
                value: Double(run.solved),
                valueLabel: index == bestIndex ? String(run.solved) : nil,
                tooltip:
                    "\(run.solved) of \(run.attempts) on \(shortDate.string(from: run.at)), \(formatSeconds(run.averageMs)) each",
                tone: index == recent.count - 1 ? .accent : .muted
            )
        }
    }

    var body: some View {
        let empty = runs.isEmpty
        let best = runs.map(\.solved).max() ?? 0
        let averageSolved = empty ? 0 : Double(runs.map(\.solved).reduce(0, +)) / Double(runs.count)
        let averageMs = empty ? 0 : runs.map(\.averageMs).reduce(0, +) / Double(runs.count)
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 16) {
                MathsStat(label: runs.count == 1 ? "Run" : "Runs", value: empty ? "–" : String(runs.count))
                MathsStat(label: "Best", value: empty ? "–" : String(best))
                MathsStat(label: "Typical", value: empty ? "–" : String(format: "%.1f", averageSolved))
                MathsStat(label: "Per answer", value: empty ? "–" : formatSeconds(averageMs))
            }
            if empty {
                VStack(spacing: 0) {
                    EmptyState(
                        title: "No runs yet", description: "Your first run with these settings will show up here."
                    )
                    .frame(maxWidth: .infinity)
                    .frame(height: chartHeight)
                    Rectangle().fill(Theme.fg(0.1)).frame(height: 1)
                }
            } else {
                ColumnChart(columns: columns, height: chartHeight)
            }
        }
    }
}

/// How the run's thinking times were spread: a count per second-wide bin,
/// the last bucket open-ended. The fullest bin carries its count.
struct ThinkingTimeHistogram: View {
    let attempts: [MathsAttempt]
    private let binCount = 8

    var body: some View {
        var counts = Array(repeating: 0, count: binCount + 1)
        for attempt in attempts {
            counts[min(binCount, Int(max(0, attempt.ms) / 1000))] += 1
        }
        let fullest = counts.max() ?? 0
        return ColumnChart(
            columns: counts.enumerated().map { index, count in
                ChartColumn(
                    id: String(index), value: Double(count),
                    label: index == binCount ? "\(binCount)s+" : "\(index)s",
                    valueLabel: count > 0 && count == fullest ? String(count) : nil,
                    tooltip:
                        "\(count) in \(index == binCount ? "\(binCount) seconds or more" : "\(index) to \(index + 1) seconds")"
                )
            },
            height: 80
        )
    }
}

/// The run as it happened: one column per problem, as tall as the thinking
/// took, coloured by whether you had it. The slowest carries its time.
struct RunTimeline: View {
    let attempts: [MathsAttempt]

    var body: some View {
        let slowest = attempts.map(\.ms).max() ?? 0
        VStack(alignment: .leading, spacing: 8) {
            ColumnChart(
                columns: attempts.enumerated().map { index, attempt in
                    ChartColumn(
                        id: String(index), value: attempt.ms,
                        valueLabel: attempt.ms == slowest ? formatSeconds(attempt.ms) : nil,
                        tooltip:
                            "\(attempt.problem.formatted) = \(attempt.problem.answer), \(formatSeconds(attempt.ms)), \(attempt.correct ? "got it" : "missed")",
                        tone: attempt.correct ? .accent : .destructive
                    )
                },
                height: 80
            )
            ChartLegend(items: [(.accent, "Got it"), (.destructive, "Missed")])
        }
    }
}

// MARK: - Demos

private let solvedPerRun = [8, 11, 9, 13, 12, 15, 14, 12, 17, 16, 19, 18, 21, 17]

private let demoRuns: [MathsRun] = solvedPerRun.enumerated().map { index, solved in
    MathsRun(
        at: Date(timeIntervalSince1970: 1_787_302_800 + Double(index) * 86_400),
        solved: solved, attempts: solved + index % 3,
        averageMs: 4200 - Double(index) * 120 + Double(index % 4) * 150
    )
}

private let sampleAttempts: [MathsAttempt] = [
    (MathsOperation.addition, 47, 38, 85, true, 1400.0), (.multiplication, 12, 9, 108, true, 2300),
    (.subtraction, 92, 45, 47, true, 1900),
    (.division, 84, 7, 12, false, 5200), (.addition, 66, 29, 95, true, 1100),
    (.multiplication, 23, 14, 322, false, 7800),
    (.subtraction, 71, 18, 53, true, 900), (.addition, 58, 77, 135, true, 1700), (.division, 96, 8, 12, true, 3400),
    (.multiplication, 17, 6, 102, true, 2600), (.subtraction, 40, 26, 14, true, 800),
    (.addition, 89, 33, 122, false, 4100),
    (.division, 72, 9, 8, true, 2900), (.multiplication, 15, 15, 225, true, 1500), (.addition, 24, 68, 92, true, 1200),
    (.subtraction, 83, 57, 26, true, 2100),
].map { operation, left, right, answer, correct, ms in
    MathsAttempt(
        problem: MathsProblem(operation: operation, left: left, right: right, answer: answer), correct: correct, ms: ms)
}

extension Demo {
    static let mathsHistory = Demo(
        "Maths history", section: .app,
        description:
            "Past runs for one Mental maths configuration: totals, then solved per run. Latest in the accent, best labelled."
    ) {
        VStack(alignment: .leading, spacing: 32) {
            MathsHistory(runs: demoRuns)
            MathsHistory(runs: [])
        }
        .frame(width: 448)
    }

    static let mathsRunCharts = Demo(
        "Maths run charts", section: .app,
        description:
            "One run, two ways: thinking time binned by the second, and each problem in order. Hover for the problem."
    ) {
        VStack(alignment: .leading, spacing: 32) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Thinking time").textStyle(.small, .medium).foregroundStyle(Theme.mutedForeground)
                ThinkingTimeHistogram(attempts: sampleAttempts)
            }
            VStack(alignment: .leading, spacing: 8) {
                Text("In order").textStyle(.small, .medium).foregroundStyle(Theme.mutedForeground)
                RunTimeline(attempts: sampleAttempts)
            }
        }
        .frame(width: 448)
    }
}
