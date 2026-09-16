import SwiftUI

/// A block of markdown, the way the notes and card sides are written.
enum MarkdownBlock {
    case heading(level: Int, text: String)
    case paragraph(String)
    case bullets([String])
    case numbered([String])
    case tasks([(done: Bool, text: String)])
    case quote(String)
    case code(language: String?, source: String)
    case math(String)
    /// The app's `<card>` block: front and back.
    case card(front: String, back: String)
}

/// A small block parser for what the notes use: headings, paragraphs, lists
/// and checklists, quotes, fenced code, `$$` math, and `<card>` blocks.
/// Inline markdown is left to Foundation's parser at render time.
enum MarkdownParser {
    static func parse(_ text: String) -> [MarkdownBlock] {
        var blocks: [MarkdownBlock] = []
        var paragraph: [String] = []
        func flush() {
            if !paragraph.isEmpty {
                blocks.append(.paragraph(paragraph.joined(separator: " ")))
                paragraph = []
            }
        }
        let lines = text.components(separatedBy: "\n")
        var index = 0
        while index < lines.count {
            let trimmed = lines[index].trimmingCharacters(in: .whitespaces)
            if trimmed.hasPrefix("```") {
                flush()
                let language = String(trimmed.dropFirst(3)).trimmingCharacters(in: .whitespaces)
                let (body, next) = collect(lines, from: index + 1) {
                    $0.trimmingCharacters(in: .whitespaces).hasPrefix("```")
                }
                blocks.append(.code(language: language.isEmpty ? nil : language, source: body))
                index = next
            } else if trimmed == "$$" {
                flush()
                let (body, next) = collect(lines, from: index + 1) { $0.trimmingCharacters(in: .whitespaces) == "$$" }
                blocks.append(.math(body))
                index = next
            } else if trimmed.hasPrefix("<card") {
                flush()
                let (body, next) = collect(lines, from: index + 1) {
                    $0.trimmingCharacters(in: .whitespaces) == "</card>"
                }
                blocks.append(.card(front: tagged("front", in: body), back: tagged("back", in: body)))
                index = next
            } else if trimmed.isEmpty {
                flush()
                index += 1
            } else if let heading = heading(trimmed) {
                flush()
                blocks.append(.heading(level: heading.level, text: heading.text))
                index += 1
            } else if trimmed.hasPrefix("> ") {
                flush()
                let (items, next) = run(lines, from: index) { line in
                    line.hasPrefix("> ") ? String(line.dropFirst(2)) : nil
                }
                blocks.append(.quote(items.joined(separator: " ")))
                index = next
            } else if task(trimmed) != nil {
                flush()
                let (items, next) = run(lines, from: index, task)
                blocks.append(.tasks(items))
                index = next
            } else if bullet(trimmed) != nil {
                flush()
                let (items, next) = run(lines, from: index, bullet)
                blocks.append(.bullets(items))
                index = next
            } else if numbered(trimmed) != nil {
                flush()
                let (items, next) = run(lines, from: index, numbered)
                blocks.append(.numbered(items))
                index = next
            } else {
                paragraph.append(trimmed)
                index += 1
            }
        }
        flush()
        return blocks
    }

    /// Lines up to (not including) the closing line; returns the index after it.
    private static func collect(_ lines: [String], from start: Int, until isEnd: (String) -> Bool) -> (String, Int) {
        var body: [String] = []
        var index = start
        while index < lines.count, !isEnd(lines[index]) {
            body.append(lines[index])
            index += 1
        }
        return (body.joined(separator: "\n"), index + 1)
    }

    /// Consecutive lines that match, mapped; returns the index after them.
    private static func run<T>(_ lines: [String], from start: Int, _ match: (String) -> T?) -> ([T], Int) {
        var items: [T] = []
        var index = start
        while index < lines.count, let item = match(lines[index].trimmingCharacters(in: .whitespaces)) {
            items.append(item)
            index += 1
        }
        return (items, index)
    }

    private static func heading(_ line: String) -> (level: Int, text: String)? {
        let hashes = line.prefix { $0 == "#" }.count
        guard hashes > 0, hashes <= 3, line.dropFirst(hashes).hasPrefix(" ") else { return nil }
        return (hashes, String(line.dropFirst(hashes + 1)))
    }

    private static func task(_ line: String) -> (done: Bool, text: String)? {
        if line.hasPrefix("- [ ] ") { return (false, String(line.dropFirst(6))) }
        if line.hasPrefix("- [x] ") || line.hasPrefix("- [X] ") { return (true, String(line.dropFirst(6))) }
        return nil
    }

    private static func bullet(_ line: String) -> String? {
        guard task(line) == nil else { return nil }
        if line.hasPrefix("- ") || line.hasPrefix("* ") { return String(line.dropFirst(2)) }
        return nil
    }

    private static func numbered(_ line: String) -> String? {
        let digits = line.prefix { $0.isNumber }
        guard !digits.isEmpty, line.dropFirst(digits.count).hasPrefix(". ") else { return nil }
        return String(line.dropFirst(digits.count + 2))
    }

    private static func tagged(_ tag: String, in body: String) -> String {
        guard let open = body.range(of: "<\(tag)>"),
            let close = body.range(of: "</\(tag)>", range: open.upperBound..<body.endIndex)
        else { return "" }
        return String(body[open.upperBound..<close.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

/// One line of inline markdown: bold, italic, code (DM Mono), links (the
/// link colour), and `$math$`, which reads as code.
struct MarkdownInline: View {
    let text: String

    var body: some View {
        Text(MarkdownInline.attributed(text))
    }

    static func attributed(_ source: String) -> AttributedString {
        let withMath = source.replacingOccurrences(of: #"\$([^$\n]+)\$"#, with: "`$1`", options: .regularExpression)
        var attributed =
            (try? AttributedString(
                markdown: withMath, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)))
            ?? AttributedString(source)
        let runs = attributed.runs.map { ($0.range, $0.inlinePresentationIntent, $0.link) }
        for (range, intent, link) in runs {
            if let intent, intent.contains(.code) {
                attributed[range].font = Typography.mono(12)
                attributed[range].backgroundColor = Theme.muted
            }
            if link != nil {
                attributed[range].foregroundColor = Theme.link
                attributed[range].underlineStyle = .single
            }
        }
        return attributed
    }
}

/// Rendered markdown. `cardRenderer` draws the app's `<card>` blocks; without
/// it they show as their source.
struct MarkdownView: View {
    let text: String
    var cardRenderer: ((String, String) -> AnyView)?

    var body: some View {
        let blocks = MarkdownParser.parse(text)
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                MarkdownBlockView(block: block, cardRenderer: cardRenderer)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct MarkdownBlockView: View {
    let block: MarkdownBlock
    let cardRenderer: ((String, String) -> AnyView)?

    var body: some View {
        switch block {
        case .heading(let level, let text):
            MarkdownInline(text: text)
                .textStyle(level == 1 ? .heading : level == 2 ? .title : .body, .semibold)
                .padding(.top, 4)
        case .paragraph(let text):
            MarkdownInline(text: text).textStyle(.body)
        case .bullets(let items):
            list(items.map { ("•", $0) })
        case .numbered(let items):
            list(items.enumerated().map { ("\($0.offset + 1).", $0.element) })
        case .tasks(let items):
            VStack(alignment: .leading, spacing: 4) {
                ForEach(items.indices, id: \.self) { index in
                    HStack(alignment: .top, spacing: 8) {
                        Theme.shape(4)
                            .fill(items[index].done ? Theme.primary : Theme.fg(0.08))
                            .frame(width: 14, height: 14)
                            .overlay {
                                if items[index].done {
                                    Icon(.checkBold, size: 10).foregroundStyle(Theme.primaryForeground)
                                }
                            }
                            .padding(.top, 2)
                        MarkdownInline(text: items[index].text)
                            .textStyle(.body)
                            .strikethrough(items[index].done)
                            .foregroundStyle(items[index].done ? Theme.mutedForeground : Theme.foreground)
                    }
                }
            }
        case .quote(let text):
            HStack(alignment: .top, spacing: 10) {
                Rectangle().fill(Theme.fg(0.15)).frame(width: 2)
                MarkdownInline(text: text)
                    .textStyle(.body)
                    .foregroundStyle(Theme.mutedForeground)
            }
        case .code(let language, let source):
            VStack(alignment: .leading, spacing: 6) {
                if let language {
                    Text(language)
                        .textStyle(.micro, .medium)
                        .foregroundStyle(Theme.mutedForeground)
                }
                Text(source)
                    .font(Typography.mono(12))
                    .textSelection(.enabled)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.fg(0.04), in: Theme.controlShape)
        case .math(let source):
            Text(source)
                .font(Typography.mono(12))
                .padding(12)
                .frame(maxWidth: .infinity)
                .background(Theme.fg(0.04), in: Theme.controlShape)
        case .card(let front, let back):
            if let cardRenderer {
                cardRenderer(front, back)
            } else {
                Text("<card>\n\(front)\n\(back)\n</card>")
                    .font(Typography.mono(12))
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.fg(0.04), in: Theme.controlShape)
            }
        }
    }

    private func list(_ items: [(String, String)]) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            ForEach(items.indices, id: \.self) { index in
                HStack(alignment: .top, spacing: 6) {
                    Text(items[index].0)
                        .frame(minWidth: 12, alignment: .trailing)
                        .foregroundStyle(Theme.mutedForeground)
                    MarkdownInline(text: items[index].1)
                }
                .textStyle(.body)
            }
        }
        .padding(.leading, 4)
    }
}

/// A hairline between groups of toolbar buttons.
private struct ToolbarDivider: View {
    var body: some View {
        Rectangle()
            .fill(Theme.fg(0.1))
            .frame(width: 1, height: 16)
            .padding(.horizontal, 2)
    }
}

/// One formatting button: a ghost icon button with its tooltip.
/// What is applied at the selection, as the editor reports it.
struct FormatState: Decodable, Equatable {
    var bold = false
    var italic = false
    var underline = false
    var strike = false
    var code = false
    var link = false
    var href = ""
    /// The block type's key: paragraph, heading1…3, blockquote, bulletList,
    /// orderedList, taskList, codeBlock.
    var block = "paragraph"
}

private struct ToolButton: View {
    let icon: TablerIcon
    let label: String
    var active = false
    var action: () -> Void = {}

    var body: some View {
        Button(action: action) { Icon(icon) }
            .buttonStyle(.kit(.ghost, .iconSm))
            .background(active ? Theme.fg(0.09) : .clear, in: Theme.controlShape)
            .tooltip(label)
            .accessibilityLabel(label)
    }
}

private let blockTypes: [(key: String, icon: TablerIcon, label: String)] = [
    ("paragraph", .pilcrow, "Text"), ("heading1", .h1, "Heading 1"), ("heading2", .h2, "Heading 2"),
    ("heading3", .h3, "Heading 3"),
    ("blockquote", .blockquote, "Quote"), ("bulletList", .list, "Bullet list"),
    ("orderedList", .listNumbers, "Numbered list"),
    ("taskList", .listCheck, "Checklist"), ("codeBlock", .sourceCode, "Code block"),
]

/// The block-type picker at the start of the bubble: the current block's
/// icon and name, opening the system menu.
private struct BlockTypeMenu: View {
    let selection: String
    let onSelect: (String) -> Void

    var body: some View {
        Menu {
            ForEach(blockTypes, id: \.key) { block in
                Button {
                    onSelect(block.key)
                } label: {
                    MenuLabel(block.label, block.icon)
                }
            }
        } label: {
            let current = blockTypes.first { $0.key == selection } ?? blockTypes[0]
            HStack(spacing: 4) {
                Icon(current.icon, size: 12)
                Text(current.label)
                Icon(.chevronDown, size: 12).foregroundStyle(Theme.mutedForeground)
            }
        }
        .menuStyle(.button)
        .buttonStyle(.kit(.ghost, .sm))
        .menuIndicator(.hidden)
        .fixedSize()
    }
}

private let markTools: [(key: String, icon: TablerIcon, label: String)] = [
    ("bold", .bold, "Bold ⌘B"), ("italic", .italic, "Italic ⌘I"), ("underline", .underline, "Underline ⌘U"),
    ("strike", .strikethrough, "Strikethrough"), ("code", .code, "Code ⌘E"),
]

/// The formatting bubble over a text selection: block type, marks, and a
/// link (the field opens in place). Always glass: it floats over the notes.
/// `run` carries the action's key back to the editor.
struct FormatBubble: View {
    let state: FormatState
    var run: (_ key: String, _ argument: String?) -> Void = { _, _ in }
    @State private var linkOpen = false
    @State private var href = ""

    private func active(_ key: String) -> Bool {
        switch key {
        case "bold": state.bold
        case "italic": state.italic
        case "underline": state.underline
        case "strike": state.strike
        case "code": state.code
        default: false
        }
    }

    var body: some View {
        HStack(spacing: 2) {
            if linkOpen {
                Input(text: $href, placeholder: "Paste or type a link", autofocus: true, onSubmit: applyLink)
                    .frame(width: 224)
                    .accessibilityIdentifier("bubble.link")
                ToolButton(icon: .check, label: "Apply link", action: applyLink)
                if state.link {
                    ToolButton(icon: .linkOff, label: "Remove link") {
                        run("link", nil)
                        linkOpen = false
                    }
                }
            } else {
                BlockTypeMenu(selection: state.block) { run($0, nil) }
                ToolbarDivider()
                ForEach(markTools, id: \.key) { tool in
                    ToolButton(icon: tool.icon, label: tool.label, active: active(tool.key)) { run(tool.key, nil) }
                }
                ToolButton(icon: .link, label: "Link", active: state.link) {
                    href = state.href
                    linkOpen = true
                }
            }
        }
        .padding(4)
        .glassEffect(.regular, in: Theme.controlShape)
        .fixedSize()
        .onExitCommand { linkOpen = false }
        .accessibilityIdentifier("bubble")
    }

    private func applyLink() {
        run("link", href)
        linkOpen = false
    }
}

// MARK: - Demo

let markdownSample = #"""
    # Dynamic dispatch

    Two ways to do it, compared in **Logan Smith's** video:

    - An embedded vtable pointer, the C++ way
    - A fat pointer, the Rust way (`&dyn Trait`)

    Still to do:

    - [x] Watch the video
    - [ ] Write the card

    > The trade-off is memory layout against call-site cost.

    ```rust
    fn call(x: &dyn Shape) -> f64 {
        x.area()
    }
    ```

    Vtable size is $O(n)$ in methods; see the [reference](https://doc.rust-lang.org/reference/).

    $$
    \text{size} = \sum_{i=1}^{n} 8
    $$
    """#

/// A paragraph with a run highlighted as the selection, for the bubble demo.
private var selectedParagraph: AttributedString {
    var text = AttributedString(
        "Two ways to do it, compared in Logan Smith's video: an embedded vtable pointer, or a fat pointer.")
    if let range = text.range(of: "Logan Smith's video") {
        text[range].backgroundColor = Theme.selection
    }
    return text
}
