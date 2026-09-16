import SwiftUI

extension Demo {
    /// Every demo on the board, base first, then app. One line per component.
    static let all: [Demo] = [
        .foundations,
        .badge, .button, .buttonGroup, .checkbox, .columnChart, .commandPalette, .dialog,
        .editableText, .emptyState, .field, .hoverCard, .input, .kbd, .link, .markdownEditor,
        .menu, .nonIdealState, .notification, .numberInput, .popover, .segmentedControl,
        .select, .sidebar, .skeleton, .slider, .spinner, .squareSpinner, .surface, .kitSwitch,
        .textarea, .tooltip,
        .favicon, .flashcardNode, .flashcard, .itemMenu, .itemPreview, .itemThumbnail, .listRow,
        .listViewOptions, .mathsHistory, .mathsRunCharts, .previewRow, .ratingBar, .reviewStackCard,
        .sidebarItem, .soundBoard,
    ]
}

// MARK: - Foundations

private struct Swatch: View {
    let name: String
    let color: Color

    var body: some View {
        HStack(spacing: 8) {
            Theme.shape(6)
                .fill(color)
                .frame(width: 28, height: 20)
                .overlay(Theme.shape(6).strokeBorder(Theme.hairline, lineWidth: 1))
            Text(name)
                .textStyle(.small)
                .foregroundStyle(Theme.mutedForeground)
        }
    }
}

private struct FoundationsDemo: View {
    private let swatches: [(String, Color)] = [
        ("background", Theme.background), ("foreground", Theme.foreground),
        ("card", Theme.card), ("surface", Theme.surface),
        ("primary", Theme.primary), ("primary fg", Theme.primaryForeground),
        ("secondary", Theme.secondary), ("muted", Theme.muted),
        ("muted fg", Theme.mutedForeground), ("accent", Theme.accent),
        ("badge", Theme.badge), ("starred", Theme.starred),
        ("link", Theme.link), ("destructive", Theme.destructive),
        ("border", Theme.border), ("input", Theme.input), ("ring", Theme.ring),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), alignment: .leading), count: 4), spacing: 10) {
                ForEach(swatches, id: \.0) { swatch in
                    Swatch(name: swatch.0, color: swatch.1)
                }
            }
            VStack(alignment: .leading, spacing: 6) {
                Text("Display 28 semibold, DM Sans").textStyle(.display, .semibold)
                Text("Heading 20 semibold").textStyle(.heading, .semibold)
                Text("Title 15 medium").textStyle(.title, .medium)
                Text("Body 13 regular: the quick brown fox jumps over the lazy dog.").textStyle(.body)
                Text("Small 12, for meta").textStyle(.small).foregroundStyle(Theme.mutedForeground)
                Text("Micro 11, for key caps and group labels").textStyle(.micro, .medium).foregroundStyle(
                    Theme.mutedForeground)
                Text("fn call(x: &dyn Shape) -> f64  // DM Mono").font(Typography.mono(12))
            }
            HStack(spacing: 10) {
                ForEach(
                    [
                        TablerIcon.list, .cards, .calculator, .circlePlus, .star, .starFilled, .pin, .search, .settings,
                        .trash, .brandYoutube, .fileText, .world, .sparkles,
                    ], id: \.self
                ) { icon in
                    Icon(icon, size: 16)
                }
            }
            .foregroundStyle(Theme.mutedForeground)
        }
    }
}

extension Demo {
    static let foundations = Demo(
        "Foundations",
        description:
            "The tokens as this app resolves them: every colour from globals.css in the current appearance, the six type styles in DM Sans, and the Tabler icons."
    ) {
        FoundationsDemo()
    }
}
