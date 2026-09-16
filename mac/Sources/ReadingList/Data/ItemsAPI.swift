import Foundation
import ReadingListAPI

/// What the API can say back when creating an item.
enum CreateItemOutcome: Sendable {
    case created(id: String, title: String)
    /// The url is already saved: the existing item, so the caller can offer it.
    case duplicate(id: String, title: String)
}

/// The app's side of the web app's API, through the generated client: the
/// items and the deck, the preview images, and the writes that carry server logic
/// (creating with a fetched title and the duplicate check, updating with
/// the flashcard sync and url normalisation, deleting). Every client of the
/// app shares that one path.
struct ItemsAPI: Sendable {
    private let client: Client

    init(base: URL, accessToken: @escaping @Sendable () async throws -> String, syncOrigin: String) {
        client = Client.readingList(base: base, accessToken: accessToken, syncOrigin: syncOrigin)
    }

    func fetchItems() async throws -> [Item] {
        switch try await client.listItems() {
        case .ok(let ok):
            return try ok.body.json.compactMap(Item.init(wire:))
        case .default(let status, let failure):
            throw APIFailure(status: status) { try failure.body.json }
        }
    }

    func create(id: String, url: String?, title: String?, notes: String? = nil) async throws -> CreateItemOutcome {
        let body = Components.Schemas.CreateItemInput(
            id: id,
            title: title.flatMap { $0.isEmpty ? nil : $0 },
            url: url.flatMap { $0.isEmpty ? nil : $0 },
            notes: notes
        )
        switch try await client.createItem(body: .json(body)) {
        case .ok(let ok):
            switch try ok.body.json {
            case .CreatedItem(let created):
                return .created(id: created.itemId, title: created.title)
            case .DuplicateItem(let duplicate):
                return .duplicate(id: duplicate.duplicate.id, title: duplicate.duplicate.title)
            }
        case .default(let status, let failure):
            throw APIFailure(status: status) { try failure.body.json }
        }
    }

    /// Returns the title the server set, when it fetched one for a new url.
    @discardableResult
    func update(id: String, patch: ItemPatch) async throws -> String? {
        switch try await client.updateItem(path: .init(id: id), body: .json(patch.wire)) {
        case .ok(let ok):
            return try ok.body.json.title
        case .default(let status, let failure):
            throw APIFailure(status: status) { try failure.body.json }
        }
    }

    /// Preview images by item id ("" for an item checked and found not to
    /// be a PDF).
    func fetchPreviews() async throws -> [String: String] {
        switch try await client.listItemPreviews() {
        case .ok(let ok):
            return try ok.body.json.additionalProperties
        case .default(let status, let failure):
            throw APIFailure(status: status) { try failure.body.json }
        }
    }

    /// Renders (or returns) the item's first-page preview; nil when the
    /// link is not a PDF.
    func generatePreview(id: String) async throws -> String? {
        switch try await client.generateItemPreview(path: .init(id: id)) {
        case .ok(let ok):
            return try ok.body.json.previewImageUrl
        case .default(let status, let failure):
            throw APIFailure(status: status) { try failure.body.json }
        }
    }

    func fetchFlashcards() async throws -> [Card] {
        switch try await client.listFlashcards() {
        case .ok(let ok):
            return try ok.body.json.compactMap(Card.init(wire:))
        case .default(let status, let failure):
            throw APIFailure(status: status) { try failure.body.json }
        }
    }

    func rateCard(id: String, rating: Rating, affectsSchedule: Bool) async throws {
        guard let wireRating = Components.Schemas.RateCardInput.RatingPayload(rawValue: rating.rawValue) else { return }
        let body = Components.Schemas.RateCardInput(rating: wireRating, affectsSchedule: affectsSchedule)
        switch try await client.rateCard(path: .init(id: id), body: .json(body)) {
        case .ok:
            return
        case .default(let status, let failure):
            throw APIFailure(status: status) { try failure.body.json }
        }
    }

    func updateFlashcard(id: String, front: String, back: String) async throws {
        let body = Components.Schemas.UpdateFlashcardInput(front: front, back: back)
        switch try await client.updateFlashcard(path: .init(id: id), body: .json(body)) {
        case .ok:
            return
        case .default(let status, let failure):
            throw APIFailure(status: status) { try failure.body.json }
        }
    }

    /// Uploads a note image: a one-shot signed url from the API, the bytes
    /// put there, the src to embed back.
    func uploadImage(_ data: Data, contentType: String) async throws -> String {
        let body = Components.Schemas.RequestImageUploadInput(contentType: contentType, size: data.count)
        let target: (uploadUrl: String, src: String)
        switch try await client.requestImageUpload(body: .json(body)) {
        case .ok(let ok):
            let json = try ok.body.json
            target = (json.uploadUrl, json.src)
        case .default(let status, let failure):
            throw APIFailure(status: status) { try failure.body.json }
        }
        guard let url = URL(string: target.uploadUrl) else { throw APIFailure(message: "Bad upload url", status: 0) }
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        let (_, response) = try await URLSession.shared.upload(for: request, from: data)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            throw APIFailure(message: "The upload failed (\(status)).", status: status)
        }
        return target.src
    }

    func fetchSettings() async throws -> AppSettings {
        switch try await client.getSettings() {
        case .ok(let ok):
            let data = try JSONEncoder().encode(try ok.body.json)
            return try JSONDecoder().decode(AppSettings.self, from: data)
        case .default(let status, let failure):
            throw APIFailure(status: status) { try failure.body.json }
        }
    }

    func updateSettings(_ patch: SettingsPatch) async throws {
        let body = try JSONDecoder().decode(
            Components.Schemas.SettingsPatch.self, from: try JSONEncoder().encode(patch))
        switch try await client.updateSettings(body: .json(body)) {
        case .ok:
            return
        case .default(let status, let failure):
            throw APIFailure(status: status) { try failure.body.json }
        }
    }

    func delete(id: String) async throws {
        switch try await client.deleteItem(path: .init(id: id)) {
        case .ok:
            return
        case .default(let status, let failure):
            throw APIFailure(status: status) { try failure.body.json }
        }
    }
}

extension Item {
    /// From the wire: timestamps arrive as ISO 8601 strings.
    init?(wire: Components.Schemas.Item) {
        guard let createdAt = Timestamps.parse(wire.createdAt),
            let updatedAt = Timestamps.parse(wire.updatedAt)
        else { return nil }
        self.init(
            id: wire.id, title: wire.title, url: wire.url, faviconUrl: wire.faviconUrl, starred: wire.starred,
            notes: wire.notes, read: wire.read, readAt: wire.readAt.flatMap(Timestamps.parse),
            hiddenFromReview: wire.hiddenFromReview, createdAt: createdAt, updatedAt: updatedAt,
            flashcardCount: wire.flashcardCount
        )
    }
}

extension ItemPatch {
    var wire: Components.Schemas.UpdateItemFields {
        .init(
            title: title, url: url, starred: starred, notes: notes, read: read,
            hiddenFromReview: hiddenFromReview, refreshTitle: refreshTitle
        )
    }
}
