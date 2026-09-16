import Foundation

/// The `<card>` blocks inside an item's notes are the source of truth for
/// its flashcards, so editing a card means rewriting its block in the notes
/// (lib/card-parse.ts, `replaceCardInNotes`). Structural tags only count
/// as standalone lines, and lines inside a code fence never count, so
/// `</card>` written in a code block cannot end a card early.
enum CardNotes {
    // Regex values are not Sendable, so these are built per use.
    private static var fence: Regex<(Substring, Substring)> { /^(`{3,}|~{3,})/ }
    private static var cardOpen: Regex<(Substring, Substring)> { /^<card\b([^>]*)>$/.ignoresCase() }
    private static var cardClose: Regex<Substring> { /^<\/card>$/.ignoresCase() }
    private static var idAttribute: Regex<(Substring, Substring)> { /\bid\s*=\s*"([^"]+)"/.ignoresCase() }
    private static var structuralLine: Regex<(Substring, Substring)> { /^<\/?(card|front|back)\b[^>]*>$/.ignoresCase() }

    /// The notes with one card's sides rewritten, by id. Everything outside
    /// the card, and its own open line, is kept byte for byte; the body is
    /// rebuilt in canonical form. Nil when no card has that id.
    static func replaceCard(in notes: String, id: String, front: String, back: String) -> String? {
        let lines = notes.components(separatedBy: "\n")
        var insideFence = false
        var index = 0
        while index < lines.count {
            let trimmed = lines[index].trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.contains(fence) {
                insideFence.toggle()
                index += 1
                continue
            }
            if insideFence {
                index += 1
                continue
            }
            guard let open = trimmed.wholeMatch(of: cardOpen) else {
                index += 1
                continue
            }
            guard let close = closingLine(lines, from: index + 1) else {
                index += 1
                continue
            }
            let attributes = String(open.output.1)
            guard let match = attributes.firstMatch(of: idAttribute), String(match.output.1) == id else {
                index = close + 1
                continue
            }
            let body = [
                "<front>", escapeStructuralLines(front), "</front>", "<back>", escapeStructuralLines(back), "</back>",
            ]
            return (Array(lines[...index]) + body + Array(lines[close...])).joined(separator: "\n")
        }
        return nil
    }

    /// The standalone `</card>` line at or after `start`, skipping code
    /// fences; nil when the block never closes.
    private static func closingLine(_ lines: [String], from start: Int) -> Int? {
        var insideFence = false
        for index in start..<lines.count {
            let trimmed = lines[index].trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.contains(fence) {
                insideFence.toggle()
                continue
            }
            if !insideFence, trimmed.wholeMatch(of: cardClose) != nil { return index }
        }
        return nil
    }

    /// A structural tag on its own line inside a side would corrupt the
    /// block on the next parse; a backslash keeps it literal in markdown.
    private static func escapeStructuralLines(_ text: String) -> String {
        text.components(separatedBy: "\n")
            .map { line in
                line.trimmingCharacters(in: .whitespacesAndNewlines).wholeMatch(of: structuralLine) != nil
                    ? "\\" + line : line
            }
            .joined(separator: "\n")
    }
}
