import SwiftUI

/// The design board: every kit component's demo, one at a time or all
/// together, on the app background. The counterpart of /design/components.
struct DesignBoardView: View {
    @Bindable private var state = BoardState.shared

    private var demos: [Demo] { Demo.all }

    var body: some View {
        NavigationSplitView {
            List(selection: $state.selection) {
                Text("Everything")
                    .tag(BoardState.everything)
                ForEach(Demo.Section.allCases, id: \.self) { section in
                    Section(section.rawValue) {
                        ForEach(demos.filter { $0.section == section }) { demo in
                            Text(demo.title).tag(demo.id)
                        }
                    }
                }
            }
            .listStyle(.sidebar)
            .navigationSplitViewColumnWidth(min: 160, ideal: 200, max: 280)
        } detail: {
            ScrollView {
                if state.selection == BoardState.everything {
                    everything
                } else if let demo = demos.first(where: { $0.id == state.selection }) {
                    DemoSection(demo: demo)
                        .padding(32)
                }
            }
            .background(Theme.background)
            .accessibilityIdentifier("board.stage")
        }
        .overlay { CommandPaletteHost() }
        .overlay { NotificationHost() }
        .navigationTitle("Design board")
        .font(Typography.sans(13))
        .foregroundStyle(Theme.foreground)
        .containerBackground(Theme.background, for: .window)
    }

    private var everything: some View {
        VStack(alignment: .leading, spacing: 80) {
            ForEach(Demo.Section.allCases, id: \.self) { section in
                VStack(alignment: .leading, spacing: 48) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(section.rawValue)
                            .textStyle(.display, .semibold)
                            .tracking(-0.4)
                        Text(section.blurb)
                            .textStyle(.body)
                            .foregroundStyle(Theme.mutedForeground)
                            .frame(maxWidth: 560, alignment: .leading)
                    }
                    ForEach(demos.filter { $0.section == section }) { demo in
                        DemoSection(demo: demo)
                    }
                }
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Title, description, and the demo inside a hairline frame on the page
/// background (the web board's `rounded-surface ring-1 ring-border p-6`).
private struct DemoSection: View {
    let demo: Demo

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 4) {
                Text(demo.title)
                    .textStyle(.heading, .semibold)
                    .accessibilityIdentifier("board.title")
                Text(demo.description)
                    .textStyle(.body)
                    .foregroundStyle(Theme.mutedForeground)
                    .frame(maxWidth: 560, alignment: .leading)
            }
            demo.content()
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(24)
                .background(Theme.background, in: Theme.surfaceShape)
                .overlay(Theme.surfaceShape.strokeBorder(Theme.border, lineWidth: 1))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
