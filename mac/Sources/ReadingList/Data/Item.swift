import Foundation

/// A reading list item, the shape the app works with (lib/types.ts). The
/// preview image is deliberately absent: it is a large first-page render,
/// fetched on demand by the thumbnail.
struct Item: Identifiable, Codable, Hashable, Sendable {
    let id: String
    var title: String
    var url: String
    var faviconUrl: String?
    var starred: Bool
    var notes: String?
    var read: Bool
    var readAt: Date?
    var hiddenFromReview: Bool
    var createdAt: Date
    var updatedAt: Date
    var flashcardCount: Int

    /// A cache-shaped item for an optimistic insert, so the new row (and an
    /// open item view) renders before the server has answered.
    static func optimistic(id: String, title: String = "", url: String = "") -> Item {
        let now = Date()
        return Item(
            id: id, title: title, url: url, faviconUrl: nil, starred: false, notes: nil,
            read: false, readAt: nil, hiddenFromReview: false, createdAt: now, updatedAt: now,
            flashcardCount: 0
        )
    }

    var displayTitle: String { title.isEmpty ? "Untitled" : title }

    /// A title nobody wrote: empty, the placeholder, or the link's host.
    var hasPlaceholderTitle: Bool {
        let trimmed = title.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty || trimmed.lowercased() == "untitled" || trimmed == url || trimmed == domain
    }

    /// The link's host without "www.", or nil when there is no link.
    var domain: String? {
        guard let host = URL(string: url)?.host, !host.isEmpty else { return nil }
        return host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
    }
}

/// Items created in the same instant have equal timestamps, so the sort
/// breaks ties by title, then id, mirroring the server (lib/item-sort.ts).
enum ItemSort {
    enum Key { case createdAt, updatedAt }

    /// lib/item-sort.ts: by date, then title, then id, so equal timestamps
    /// never swap between refetches. Titles compare the way the web's
    /// localeCompare does (a before B before b), not by code point.
    static func compare(_ a: Item, _ b: Item, key: Key = .createdAt, descending: Bool = true) -> Bool {
        let (left, right) = key == .createdAt ? (a.createdAt, b.createdAt) : (a.updatedAt, b.updatedAt)
        if left != right { return descending ? left > right : left < right }
        let titles = a.title.compare(b.title, locale: Locale(identifier: "en"))
        if titles != .orderedSame { return titles == .orderedAscending }
        return a.id.compare(b.id, locale: Locale(identifier: "en")) == .orderedAscending
    }
}

/// The editable fields of an item; nil leaves a field alone. Merging two
/// patches keeps the later value for every field it sets.
struct ItemPatch: Sendable, Equatable {
    var title: String?
    var url: String?
    var notes: String?
    var starred: Bool?
    var read: Bool?
    var hiddenFromReview: Bool?
    /// Ask the server for the new url's page title (while the item's own
    /// title is still a placeholder). Not applied locally.
    var refreshTitle: Bool?

    var isEmpty: Bool {
        title == nil && url == nil && notes == nil && starred == nil && read == nil && hiddenFromReview == nil
    }

    /// Text fields ride a debounce; flags go out at once.
    var isTextOnly: Bool { starred == nil && read == nil && hiddenFromReview == nil }

    func merged(with next: ItemPatch) -> ItemPatch {
        ItemPatch(
            title: next.title ?? title, url: next.url ?? url, notes: next.notes ?? notes,
            starred: next.starred ?? starred, read: next.read ?? read,
            hiddenFromReview: next.hiddenFromReview ?? hiddenFromReview,
            refreshTitle: next.refreshTitle ?? refreshTitle
        )
    }

    func apply(to item: inout Item) {
        if let title { item.title = title }
        if let url { item.url = url }
        if let notes { item.notes = notes }
        if let starred { item.starred = starred }
        if let read {
            item.read = read
            item.readAt = read ? Date() : nil
        }
        if let hiddenFromReview { item.hiddenFromReview = hiddenFromReview }
        item.updatedAt = Date()
    }
}

/// Postgres timestamps come back with microseconds, a "+00" zone and (from
/// the API, which passes the database's text through) a space instead of
/// the "T"; Foundation's parser takes strict ISO 8601 with at most
/// milliseconds.
enum Timestamps {
    // Foundation's date formatters are thread-safe; the checker cannot see that.
    nonisolated(unsafe) private static let fractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
    nonisolated(unsafe) private static let plain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static func parse(_ raw: String) -> Date? {
        var text = raw
        if text.count > 10, text[text.index(text.startIndex, offsetBy: 10)] == " " {
            text.replaceSubrange(
                text.index(text.startIndex, offsetBy: 10)...text.index(text.startIndex, offsetBy: 10), with: "T")
        }
        if let range = text.range(of: #"\.\d+"#, options: .regularExpression) {
            let digits = text[range].dropFirst()
            text.replaceSubrange(range, with: "." + digits.prefix(3).padding(toLength: 3, withPad: "0", startingAt: 0))
        }
        if text.hasSuffix("+00") { text += ":00" }
        return fractional.date(from: text) ?? plain.date(from: text)
    }

    static func format(_ date: Date) -> String {
        fractional.string(from: date)
    }

    /// A decoder for the on-disk snapshot.
    static var decoder: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let raw = try container.decode(String.self)
            guard let date = parse(raw) else {
                throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unreadable timestamp \(raw)")
            }
            return date
        }
        return decoder
    }
}

// MARK: - Date groups (lib/date-groups.ts)

struct DateGroup: Hashable, Comparable {
    let key: String
    let label: String
    let sortKey: Int

    static func < (lhs: DateGroup, rhs: DateGroup) -> Bool { lhs.sortKey < rhs.sortKey }

    /// Today, Yesterday, This week, This month, then one group per month.
    static func of(_ date: Date, now: Date, calendar: Calendar = .current) -> DateGroup {
        let start = calendar.startOfDay(for: date)
        let today = calendar.startOfDay(for: now)
        let days = calendar.dateComponents([.day], from: start, to: today).day ?? 0
        if days == 0 { return DateGroup(key: "today", label: "Today", sortKey: 1_000_000) }
        if days == 1 { return DateGroup(key: "yesterday", label: "Yesterday", sortKey: 999_999) }
        if days < 7 { return DateGroup(key: "this-week", label: "This week", sortKey: 999_998) }
        let month = calendar.component(.month, from: date)
        let year = calendar.component(.year, from: date)
        if month == calendar.component(.month, from: now), year == calendar.component(.year, from: now) {
            return DateGroup(key: "this-month", label: "This month", sortKey: 999_997)
        }
        // The key counts months from zero, as JavaScript's getMonth does; the
        // label is the calendar's own month (its time zone, English names),
        // as the web's `toLocaleString("en-GB")`.
        var english = calendar
        english.locale = Locale(identifier: "en_GB")
        return DateGroup(
            key: "month-\(year)-\(month - 1)", label: "\(english.monthSymbols[month - 1]) \(year)",
            sortKey: year * 12 + month)
    }

    /// Groups newest first, entries within a group newest first.
    static func group(_ items: [Item], now: Date) -> [(group: DateGroup, items: [Item])] {
        var buckets: [DateGroup: [Item]] = [:]
        for item in items {
            buckets[of(item.createdAt, now: now), default: []].append(item)
        }
        return buckets.keys.sorted(by: >).map { key in
            (key, (buckets[key] ?? []).sorted { $0.createdAt > $1.createdAt })
        }
    }
}
