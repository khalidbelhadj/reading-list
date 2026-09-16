import Foundation
import Observation

/// The stored preview images (PDF first-page renders) by item id: fetched
/// once when a preview is first wanted, and rendered lazily for an item
/// that has never been checked. Three states per id, as on the web: absent
/// (never attempted), "" (checked, not a PDF), a data url (rendered).
/// YouTube links keep their own thumbnail and are never probed.
@MainActor
@Observable
final class ItemPreviews {
    private(set) var images: [String: String] = [:]
    private(set) var hasLoaded = false

    private let api: ItemsAPI
    private var loadTask: Task<Void, Never>?
    private var inFlight: Set<String> = []

    init(api: ItemsAPI) {
        self.api = api
    }

    func imageURL(for id: String) -> URL? {
        guard let data = images[id], !data.isEmpty else { return nil }
        return URL(string: data)
    }

    /// Makes the item's preview known: loads the map on first use, then
    /// renders this item's once if it has never been checked.
    func ensure(_ item: Item) {
        Task { [weak self] in
            guard let self else { return }
            await loadIfNeeded()
            guard hasLoaded else { return }
            generateIfUnknown(item)
        }
    }

    private func loadIfNeeded() async {
        if hasLoaded { return }
        if loadTask == nil {
            loadTask = Task { [weak self] in
                guard let self else { return }
                if let fetched = try? await api.fetchPreviews() {
                    images = fetched
                    hasLoaded = true
                }
                loadTask = nil
            }
        }
        await loadTask?.value
    }

    private func generateIfUnknown(_ item: Item) {
        guard images[item.id] == nil, !inFlight.contains(item.id), youtubeVideoID(item.url) == nil,
            let url = URL(string: item.url), let scheme = url.scheme?.lowercased(),
            scheme == "http" || scheme == "https"
        else { return }
        inFlight.insert(item.id)
        Task { [weak self] in
            guard let self else { return }
            do {
                let result = try await api.generatePreview(id: item.id)
                images[item.id] = result ?? ""
            } catch {
                // A failed request is not an answer: the id stays absent so
                // the next hover tries again.
            }
            inFlight.remove(item.id)
        }
    }
}
