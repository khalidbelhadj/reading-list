import Foundation
import Testing

@testable import ReadingList

/// The ports of TypeScript logic, replayed over the inputs
/// scripts/gen-fixtures.ts ran through the originals. A port that drifts
/// from the web fails here.
enum Fixtures {
    static func load<T: Decodable>(_ name: String, as type: T.Type = T.self) throws -> T {
        let url = try #require(Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures"))
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let raw = try decoder.singleValueContainer().decode(String.self)
            return try #require(Timestamps.parse(raw))
        }
        return try decoder.decode(T.self, from: Data(contentsOf: url))
    }

    static let utc: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }()
}

struct SRSTests {
    struct Fixture: Decodable {
        struct State: Decodable {
            let state: String
            let interval: Int
            let easeFactor: Double
            let reps: Int
            let lapses: Int
            let due: Date
        }
        let prev: State
        let rating: String
        let next: State
    }

    private func srs(_ state: Fixture.State) throws -> SrsState {
        SrsState(
            state: try #require(CardState(rawValue: state.state)), interval: state.interval,
            easeFactor: state.easeFactor,
            reps: state.reps, lapses: state.lapses, due: state.due
        )
    }

    @Test func matchesTheTypeScriptScheduler() throws {
        let fixtures: [Fixture] = try Fixtures.load("srs")
        #expect(fixtures.count == 24)
        let now = try #require(Timestamps.parse("2026-09-13T10:00:00.000Z"))
        for fixture in fixtures {
            let rating = try #require(Rating(rawValue: fixture.rating))
            let expected = try srs(fixture.next)
            let actual = SRS.schedule(try srs(fixture.prev), rating, now: now)
            let label = "\(fixture.prev.state) + \(fixture.rating)"
            #expect(actual.state == expected.state, "\(label)")
            #expect(actual.interval == expected.interval, "\(label)")
            #expect(abs(actual.easeFactor - expected.easeFactor) < 1e-9, "\(label)")
            #expect(actual.reps == expected.reps, "\(label)")
            #expect(actual.lapses == expected.lapses, "\(label)")
            #expect(abs(actual.due.timeIntervalSince(expected.due)) < 0.001, "\(label)")
        }
    }
}

struct ReviewOrderTests {
    struct Fixture: Decodable {
        struct CardRow: Decodable {
            let id: String
            let itemId: String?
            let due: Date
        }
        let cards: [CardRow]
        let order: [String]
    }

    @Test func dealsCardsAcrossItemsLikeTheWeb() throws {
        let fixture: Fixture = try Fixtures.load("review-order")
        let cards = fixture.cards.map { row in
            var card = Card.sample(id: row.id, itemId: row.itemId)
            card.due = row.due
            return card
        }
        #expect(ReviewQueues.interleaveByItem(cards).map(\.id) == fixture.order)
    }
}

struct CardNotesTests {
    struct Fixture: Decodable {
        let notes: String
        let id: String
        let front: String
        let back: String
        let result: String?
    }

    @Test func rewritesCardsLikeTheWeb() throws {
        let fixtures: [Fixture] = try Fixtures.load("card-notes")
        #expect(fixtures.count == 4)
        for fixture in fixtures {
            let actual = CardNotes.replaceCard(
                in: fixture.notes, id: fixture.id, front: fixture.front, back: fixture.back)
            #expect(actual == fixture.result, "card \(fixture.id)")
        }
    }
}

struct DateGroupTests {
    struct Fixture: Decodable {
        struct Group: Decodable {
            let key: String
            let label: String
            let entries: [Date]
        }
        let now: Date
        let groups: [Group]
    }

    @Test func bucketsDatesLikeTheWeb() throws {
        let fixture: Fixture = try Fixtures.load("date-groups")
        let dates = fixture.groups.flatMap(\.entries)
        var buckets: [String: (DateGroup, [Date])] = [:]
        var order: [String] = []
        for date in dates {
            let group = DateGroup.of(date, now: fixture.now, calendar: Fixtures.utc)
            if buckets[group.key] == nil { order.append(group.key) }
            buckets[group.key, default: (group, [])].1.append(date)
        }
        let sorted = order.compactMap { buckets[$0] }.sorted { $0.0.sortKey > $1.0.sortKey }
        #expect(sorted.map(\.0.key) == fixture.groups.map(\.key))
        #expect(sorted.map(\.0.label) == fixture.groups.map(\.label))
        for (actual, expected) in zip(sorted, fixture.groups) {
            #expect(actual.1.sorted(by: >) == expected.entries, "group \(expected.key)")
        }
    }
}

struct TimeAgoTests {
    struct Fixture: Decodable {
        let iso: Date
        let now: Date
        let label: String
    }

    @Test func wordsAgesLikeTheWeb() throws {
        let fixtures: [Fixture] = try Fixtures.load("time-ago")
        for fixture in fixtures {
            #expect(timeAgo(fixture.iso, now: fixture.now) == fixture.label, "\(fixture.label)")
        }
    }
}

struct YouTubeTests {
    struct Fixture: Decodable {
        let url: String
        let id: String?
    }

    @Test func readsVideoIdsLikeTheWeb() throws {
        let fixtures: [Fixture] = try Fixtures.load("youtube")
        for fixture in fixtures {
            #expect(youtubeVideoID(fixture.url) == fixture.id, "\(fixture.url)")
        }
    }
}

struct ItemSortTests {
    struct Fixture: Decodable {
        struct Row: Decodable {
            let id: String
            let title: String
            let createdAt: Date
            let updatedAt: Date
        }
        let items: [Row]
        let createdDesc: [String]
        let createdAsc: [String]
        let updatedDesc: [String]
    }

    @Test func ordersItemsLikeTheWeb() throws {
        let fixture: Fixture = try Fixtures.load("item-sort")
        let items = fixture.items.map { row in
            Item.sample(id: row.id, title: row.title, createdAt: row.createdAt, updatedAt: row.updatedAt)
        }
        #expect(items.sorted { ItemSort.compare($0, $1) }.map(\.id) == fixture.createdDesc)
        #expect(
            items.sorted { ItemSort.compare($0, $1, key: .createdAt, descending: false) }.map(\.id)
                == fixture.createdAsc)
        #expect(items.sorted { ItemSort.compare($0, $1, key: .updatedAt) }.map(\.id) == fixture.updatedDesc)
    }
}

// MARK: - Samples

extension Card {
    /// A card with only what the queues look at.
    static func sample(id: String, itemId: String?) -> Card {
        let json = """
            {"id":"\(id)","front":"f","back":"b","state":"review","due":"2026-09-13T10:00:00.000Z","interval":1,"easeFactor":2.5,"reps":1,"lapses":0,"itemId":\(itemId.map { "\"\($0)\"" } ?? "null"),"itemTitle":null,"itemUrl":null,"itemFaviconUrl":null,"createdAt":"2026-09-01T00:00:00.000Z","updatedAt":"2026-09-01T00:00:00.000Z"}
            """
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try! decoder.decode(Card.self, from: Data(json.utf8))
    }
}

extension Item {
    static func sample(id: String, title: String, createdAt: Date, updatedAt: Date) -> Item {
        Item(
            id: id, title: title, url: "", faviconUrl: nil, starred: false, notes: nil, read: false, readAt: nil,
            hiddenFromReview: false, createdAt: createdAt, updatedAt: updatedAt, flashcardCount: 0
        )
    }
}
