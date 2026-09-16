import AppKit
import Foundation
import Observation
import ReadingListAPI

/// The user's settings (lib/settings.ts), the same blob the web keeps on
/// the server: view options, theme, sounds. Cached in UserDefaults for the
/// first paint, refreshed from the API, written back as a debounced patch
/// so a run of clicks is one request. Fields the Mac app does not use yet
/// (Mental maths runs) ride along untouched.
struct AppSettings: Codable, Equatable, Sendable {
    var theme = "system"
    var density = "cozy"
    var groupBy = "day"
    var sortBy = "created-desc"
    var showRead = false
    var showOpenTabs = true
    var sounds = true
    var showMentalMaths = true
}

/// The fields of one save: only what changed goes to the server.
struct SettingsPatch: Codable, Equatable, Sendable {
    var theme: String?
    var density: String?
    var groupBy: String?
    var sortBy: String?
    var showRead: Bool?
    var showOpenTabs: Bool?
    var sounds: Bool?
    var showMentalMaths: Bool?

    var isEmpty: Bool { self == SettingsPatch() }

    init() {}

    /// Every field that differs between two states.
    init(from old: AppSettings, to new: AppSettings) {
        if old.theme != new.theme { theme = new.theme }
        if old.density != new.density { density = new.density }
        if old.groupBy != new.groupBy { groupBy = new.groupBy }
        if old.sortBy != new.sortBy { sortBy = new.sortBy }
        if old.showRead != new.showRead { showRead = new.showRead }
        if old.showOpenTabs != new.showOpenTabs { showOpenTabs = new.showOpenTabs }
        if old.sounds != new.sounds { sounds = new.sounds }
        if old.showMentalMaths != new.showMentalMaths { showMentalMaths = new.showMentalMaths }
    }

    mutating func merge(_ next: SettingsPatch) {
        theme = next.theme ?? theme
        density = next.density ?? density
        groupBy = next.groupBy ?? groupBy
        sortBy = next.sortBy ?? sortBy
        showRead = next.showRead ?? showRead
        showOpenTabs = next.showOpenTabs ?? showOpenTabs
        sounds = next.sounds ?? sounds
        showMentalMaths = next.showMentalMaths ?? showMentalMaths
    }
}

@MainActor
@Observable
final class SettingsStore {
    private(set) var settings = AppSettings()
    private(set) var hasLoaded = false
    private(set) var lastError: String?

    private let api: ItemsAPI
    private let cacheKey: String
    private var pending = SettingsPatch()
    private var flushTask: Task<Void, Never>?

    init(api: ItemsAPI, userId: String) {
        self.api = api
        self.cacheKey = "settings.\(userId)"
    }

    /// The cached copy at once, then the server's.
    func start() {
        if let data = UserDefaults.standard.data(forKey: cacheKey),
            let cached = try? JSONDecoder().decode(AppSettings.self, from: data)
        {
            settings = cached
            hasLoaded = true
            apply()
        }
        Task { await refresh() }
    }

    func refresh() async {
        do {
            let fetched = try await api.fetchSettings()
            // A patch still on its way wins over what the server had.
            var next = fetched
            next.apply(pending)
            settings = next
            hasLoaded = true
            lastError = nil
            persist()
            apply()
        } catch {
            lastError = ErrorSummary(error).message
        }
    }

    /// Change settings here first; the server follows after a short pause.
    func update(_ change: (inout AppSettings) -> Void) {
        var next = settings
        change(&next)
        let patch = SettingsPatch(from: settings, to: next)
        guard !patch.isEmpty else { return }
        settings = next
        persist()
        apply()
        pending.merge(patch)
        flushTask?.cancel()
        flushTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            await self?.flush()
        }
    }

    private func flush() async {
        let patch = pending
        pending = SettingsPatch()
        guard !patch.isEmpty else { return }
        do {
            try await api.updateSettings(patch)
        } catch {
            // Keep the change for the next flush; the app keeps behaving as
            // asked meanwhile.
            var merged = patch
            merged.merge(pending)
            pending = merged
            Notifier.shared.notify(
                NotifyOptions(
                    title: "Could not save settings", description: ErrorSummary(error).message, meta: "now",
                    tone: .error
                ))
        }
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(settings) {
            UserDefaults.standard.set(data, forKey: cacheKey)
        }
    }

    /// The settings that act outside the views: sounds, and the appearance
    /// when it overrides the system's.
    private func apply() {
        Sounds.shared.enabled = settings.sounds
        NSApp.appearance =
            switch settings.theme {
            case "dark": NSAppearance(named: .darkAqua)
            case "light": NSAppearance(named: .aqua)
            default: nil
            }
    }
}

extension AppSettings {
    mutating func apply(_ patch: SettingsPatch) {
        theme = patch.theme ?? theme
        density = patch.density ?? density
        groupBy = patch.groupBy ?? groupBy
        sortBy = patch.sortBy ?? sortBy
        showRead = patch.showRead ?? showRead
        showOpenTabs = patch.showOpenTabs ?? showOpenTabs
        sounds = patch.sounds ?? sounds
        showMentalMaths = patch.showMentalMaths ?? showMentalMaths
    }
}

// The list's option enums, as the settings blob spells them.
extension ListSortBy {
    init(setting: String) {
        self =
            switch setting {
            case "created-asc": .createdAsc
            case "updated-desc": .updatedDesc
            case "updated-asc": .updatedAsc
            default: .createdDesc
            }
    }

    var setting: String {
        switch self {
        case .createdDesc: "created-desc"
        case .createdAsc: "created-asc"
        case .updatedDesc: "updated-desc"
        case .updatedAsc: "updated-asc"
        }
    }
}

extension ListDensity {
    /// The stored value keeps its historical name: "cozy" is the preview row.
    init(setting: String) { self = setting == "compact" ? .compact : .preview }
    var setting: String { self == .compact ? "compact" : "cozy" }
}

extension ListGroupBy {
    init(setting: String) { self = setting == "none" ? .none : .day }
    var setting: String { rawValue }
}
