import Foundation
import Observation
import ReadingListAPI

/// The items, in memory, with a snapshot on disk so a launch renders the last
/// known state at once. Writes are optimistic: the change lands here first,
/// the request follows in the background, and a failure refetches the truth
/// and says so. This is the app's cache, the way React Query's is the web's.
@MainActor
@Observable
final class ItemStore {
    private(set) var items: [Item] = []
    /// A snapshot or a fetch has landed; before that the list is unknown.
    private(set) var hasLoaded = false
    private(set) var lastSyncedAt: Date?
    private(set) var isRefreshing = false
    /// Why the last refresh failed, until one succeeds. A refresh failing
    /// in the background is not announced (the list on screen is still
    /// right, as of `lastSyncedAt`); only a first load with nothing to
    /// show is.
    private(set) var lastRefreshError: String?
    /// A patch the server accepted.
    var onSaved: ((ItemPatch) -> Void)?

    private let api: ItemsAPI
    private let snapshot: SnapshotStore<Snapshot>
    private var index: [String: Int] = [:]
    /// Edits waiting for their debounce, per item; a refresh keeps the local
    /// version of these so typing is never clobbered by an older row.
    private var pending: [String: ItemPatch] = [:]
    private var pendingTasks: [String: Task<Void, Never>] = [:]
    private var refreshTask: Task<Void, Never>?

    init(api: ItemsAPI, snapshot: SnapshotStore<Snapshot>) {
        self.api = api
        self.snapshot = snapshot
    }

    func item(_ id: String) -> Item? {
        index[id].map { items[$0] }
    }

    // MARK: Loading

    /// The last snapshot, instantly; then the server, in the background.
    func start() {
        if let saved = snapshot.load() {
            replace(saved.items)
            lastSyncedAt = saved.syncedAt
            hasLoaded = true
        }
        refresh()
    }

    /// Fetches the list and reconciles it, keeping any edit still in flight.
    func refresh() {
        guard refreshTask == nil else { return }
        isRefreshing = true
        refreshTask = Task { [weak self] in
            guard let self else { return }
            defer {
                refreshTask = nil
                isRefreshing = false
            }
            do {
                let fetched = try await api.fetchItems()
                let kept = fetched.map { row in pending[row.id] != nil ? (item(row.id) ?? row) : row }
                replace(kept)
                lastSyncedAt = Date()
                lastRefreshError = nil
                hasLoaded = true
                persist()
            } catch {
                let summary = ErrorSummary(error)
                lastRefreshError = summary.message
                if !hasLoaded {
                    hasLoaded = true
                    report("Could not load items", error)
                }
            }
        }
    }

    private func replace(_ next: [Item]) {
        items = next.sorted { ItemSort.compare($0, $1) }
        reindex()
    }

    private func reindex() {
        index = Dictionary(uniqueKeysWithValues: items.enumerated().map { ($1.id, $0) })
    }

    /// An image for the notes, uploaded through the API; the url to embed.
    func uploadImage(_ data: Data, contentType: String) async throws -> String {
        try await api.uploadImage(data, contentType: contentType)
    }

    private func persist() {
        snapshot.save(Snapshot(items: items, syncedAt: lastSyncedAt ?? Date()))
    }

    // MARK: Writes

    /// A blank item, opened at once; the row exists before the server answers.
    @discardableResult
    func createBlank() -> String {
        let id = UUID().uuidString.lowercased()
        insert(Item.optimistic(id: id))
        Task { await create(id: id, url: nil, title: nil) }
        return id
    }

    /// A pasted link: the row starts with the hostname as its title and the
    /// server's fetched title replaces it, unless it was renamed meanwhile.
    @discardableResult
    func create(url: String) -> String {
        let id = UUID().uuidString.lowercased()
        let fallback = URL(string: url)?.host.map { $0.hasPrefix("www.") ? String($0.dropFirst(4)) : $0 } ?? url
        insert(Item.optimistic(id: id, title: fallback, url: url))
        Task { await create(id: id, url: url, title: nil, fallbackTitle: fallback) }
        return id
    }

    private func create(id: String, url: String?, title: String?, fallbackTitle: String? = nil) async {
        do {
            switch try await api.create(id: id, url: url, title: title) {
            case .created(_, let resolvedTitle):
                if let fallbackTitle, let current = item(id), current.title == fallbackTitle, !resolvedTitle.isEmpty {
                    mutate(id) { $0.title = resolvedTitle }
                }
                Sounds.shared.itemCreated()
            case .duplicate(let existingId, let existingTitle):
                remove(id)
                Notifier.shared.notify(
                    NotifyOptions(
                        title: "Already saved",
                        description: existingTitle.isEmpty ? "That link is already in your list." : existingTitle,
                        icon: .link, meta: "now"
                    ))
                _ = existingId
            }
        } catch {
            remove(id)
            report("Could not save item", error)
        }
    }

    /// Applies a patch now; flags are sent at once, text after a short pause
    /// so typing coalesces into one request. `flush` sends what is waiting.
    func patch(_ id: String, _ patch: ItemPatch) {
        guard !patch.isEmpty, index[id] != nil else { return }
        mutate(id) { patch.apply(to: &$0) }
        if patch.isTextOnly {
            pending[id] = (pending[id] ?? ItemPatch()).merged(with: patch)
            pendingTasks[id]?.cancel()
            pendingTasks[id] = Task { [weak self] in
                try? await Task.sleep(for: .milliseconds(600))
                guard !Task.isCancelled else { return }
                self?.flush(id)
            }
        } else {
            Task { await send(id, patch) }
        }
    }

    func flush(_ id: String) {
        pendingTasks[id]?.cancel()
        pendingTasks[id] = nil
        guard let waiting = pending.removeValue(forKey: id) else { return }
        Task { await send(id, waiting) }
    }

    func toggleStar(_ id: String) {
        guard let current = item(id) else { return }
        patch(id, ItemPatch(starred: !current.starred))
        if current.starred { Sounds.shared.itemUnstarred() } else { Sounds.shared.itemStarred() }
    }

    func toggleRead(_ id: String) {
        guard let current = item(id) else { return }
        patch(id, ItemPatch(read: !current.read))
    }

    func toggleHiddenFromReview(_ id: String) {
        guard let current = item(id) else { return }
        patch(id, ItemPatch(hiddenFromReview: !current.hiddenFromReview))
    }

    func delete(_ id: String) {
        guard let removed = item(id) else { return }
        remove(id)
        Sounds.shared.itemDeleted()
        Task {
            do {
                try await api.delete(id: id)
            } catch {
                insert(removed)
                report("Could not delete item", error)
            }
        }
    }

    // MARK: Plumbing

    private func send(_ id: String, _ patch: ItemPatch) async {
        do {
            let fetchedTitle = try await api.update(id: id, patch: patch)
            if patch.refreshTitle == true, let fetchedTitle, !fetchedTitle.isEmpty,
                let current = item(id), current.hasPlaceholderTitle
            {
                mutate(id) { $0.title = fetchedTitle }
            }
            onSaved?(patch)
        } catch {
            report("Could not save changes", error)
            refresh()
        }
    }

    private func insert(_ item: Item) {
        guard index[item.id] == nil else { return }
        items.append(item)
        replace(items)
        persist()
    }

    private func remove(_ id: String) {
        pendingTasks[id]?.cancel()
        pendingTasks[id] = nil
        pending[id] = nil
        guard let position = index[id] else { return }
        items.remove(at: position)
        reindex()
        persist()
    }

    private func mutate(_ id: String, _ change: (inout Item) -> Void) {
        guard let position = index[id] else { return }
        change(&items[position])
        persist()
    }

    private func report(_ title: String, _ error: Error) {
        let summary = ErrorSummary(error)
        Notifier.shared.notify(
            NotifyOptions(
                title: title, description: summary.message, detail: summary.detail, meta: "now", tone: .error
            ))
    }
}

// MARK: - Snapshot

struct Snapshot: Codable {
    let items: [Item]
    let syncedAt: Date
}

/// The last known state on disk, written atomically after every change, so
/// the next launch draws it before the network answers.
struct SnapshotStore<Value: Codable>: Sendable {
    let url: URL

    static func inApplicationSupport(name: String) -> SnapshotStore {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let directory = base.appending(path: Bundle.main.bundleIdentifier ?? "ReadingList")
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return SnapshotStore(url: directory.appending(path: name))
    }

    func load() -> Value? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(Value.self, from: data)
    }

    func save(_ snapshot: Value) {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(snapshot) else { return }
        try? data.write(to: url, options: .atomic)
    }

    func clear() {
        try? FileManager.default.removeItem(at: url)
    }
}
