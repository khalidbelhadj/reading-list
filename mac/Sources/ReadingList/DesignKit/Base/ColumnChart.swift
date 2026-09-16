import SwiftUI

/// What a column can be painted with: the accent for the one series a chart
/// is about, muted for context, destructive for the "went wrong" state.
enum ColumnTone {
    case accent, muted, destructive

    var color: Color {
        switch self {
        case .accent: Theme.primary
        case .muted: Theme.fg(0.25)
        case .destructive: Theme.destructive
        }
    }

    var hoverColor: Color {
        switch self {
        case .accent: Theme.primary.opacity(0.8)
        case .muted: Theme.fg(0.4)
        case .destructive: Theme.destructive.opacity(0.8)
        }
    }
}

struct ChartColumn: Identifiable {
    let id: String
    let value: Double
    /// Under the column, on the axis. Keep it short.
    var label: String?
    /// On the column's cap. Selective: the extreme, the latest, never all.
    var valueLabel: String?
    /// Hover detail for the column.
    var tooltip: String?
    var tone: ColumnTone = .accent
}

/// A single-series column chart: thin columns with a rounded cap, growing
/// from one hairline baseline, a 2pt gap between neighbours, and a hover
/// tooltip per column. Columns cap at 24pt thick and the slot's leftover is
/// air. Data only; the caller decides bins, order and labels.
struct ColumnChart: View {
    let columns: [ChartColumn]
    var max: Double?
    var height: CGFloat = 96

    private var top: Double {
        max ?? Swift.max(1, columns.map(\.value).max() ?? 1)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .bottom, spacing: 2) {
                ForEach(columns) { column in
                    Column(column: column, fraction: Swift.max(0, Swift.min(1, column.value / top)), height: height)
                        .frame(maxWidth: .infinity)
                }
            }
            .frame(height: height)
            Rectangle().fill(Theme.fg(0.1)).frame(height: 1)
            if columns.contains(where: { $0.label != nil }) {
                HStack(spacing: 2) {
                    ForEach(columns) { column in
                        Text(column.label ?? "")
                            .textStyle(.micro)
                            .foregroundStyle(Theme.mutedForeground)
                            .monospacedDigit()
                            .lineLimit(1)
                            .frame(maxWidth: .infinity)
                    }
                }
                .padding(.top, 4)
            }
        }
    }
}

private struct Column: View {
    let column: ChartColumn
    let fraction: Double
    let height: CGFloat
    @State private var hovering = false

    var body: some View {
        VStack(spacing: 4) {
            if let valueLabel = column.valueLabel {
                Text(valueLabel)
                    .textStyle(.micro)
                    .foregroundStyle(Theme.mutedForeground)
                    .monospacedDigit()
            }
            UnevenRoundedRectangle(topLeadingRadius: 4, topTrailingRadius: 4)
                .fill(hovering ? column.tone.hoverColor : column.tone.color)
                .frame(maxWidth: 24)
                .frame(height: Swift.max(fraction * height, column.value > 0 ? 2 : 0))
        }
        .frame(maxHeight: .infinity, alignment: .bottom)
        .contentShape(Rectangle())
        .onHover { hovering = $0 }
        .help(column.tooltip ?? "")
    }
}

/// The identity key for a chart with more than one tone.
struct ChartLegend: View {
    let items: [(tone: ColumnTone, label: String)]

    var body: some View {
        HStack(spacing: 12) {
            ForEach(items.indices, id: \.self) { index in
                HStack(spacing: 6) {
                    Theme.shape(2).fill(items[index].tone.color).frame(width: 8, height: 8)
                    Text(items[index].label)
                }
            }
        }
        .textStyle(.small)
        .foregroundStyle(Theme.mutedForeground)
    }
}

// MARK: - Demo

private let week: [(String, String, Double)] = [
    ("mon", "Mon", 4), ("tue", "Tue", 7), ("wed", "Wed", 3), ("thu", "Thu", 9),
    ("fri", "Fri", 6), ("sat", "Sat", 0), ("sun", "Sun", 2),
]

extension Demo {
    static let columnChart = Demo(
        "Column chart",
        description:
            "One series of thin columns on a hairline baseline, a tooltip per column. Accent, muted, or destructive tones, with a legend when two mix."
    ) {
        VStack(alignment: .leading, spacing: 32) {
            ColumnChart(
                columns: week.map { key, label, value in
                    ChartColumn(
                        id: key, value: value, label: label, valueLabel: value == 9 ? "9" : nil,
                        tooltip: "\(Int(value)) read on \(label)")
                })
            VStack(alignment: .leading, spacing: 8) {
                ColumnChart(
                    columns: [3.1, 1.2, 0.9, 4.8, 1.6, 2.2, 0.7, 5.4, 1.1, 1.9].enumerated().map { index, seconds in
                        ChartColumn(
                            id: String(index), value: seconds, tooltip: String(format: "%.1fs", seconds),
                            tone: index == 3 || index == 7 ? .destructive : .accent)
                    }, height: 64)
                ChartLegend(items: [(.accent, "Got it"), (.destructive, "Missed")])
            }
            ColumnChart(
                columns: week.map { key, label, value in
                    ChartColumn(id: key, value: value, label: label, tone: .muted)
                }, height: 48)
        }
        .frame(width: 448)
    }
}
