import Foundation

/// Where the app talks to: the Supabase project and the web app's API. Read
/// from the environment (`bun run mac run --env=local|prod` injects the
/// matching profile) with Info.plist keys as the fallback for a packaged
/// build.
struct AppConfig: Sendable {
    let supabaseURL: URL
    let supabaseAnonKey: String
    /// The web app, for the endpoints that carry server logic (create with a
    /// fetched title, notes with the flashcard sync).
    let apiBase: URL

    static let current: AppConfig? = {
        let environment = ProcessInfo.processInfo.environment
        let info = Bundle.main.infoDictionary ?? [:]
        func value(_ key: String, _ plistKey: String) -> String? {
            let raw = environment[key] ?? (info[plistKey] as? String)
            return raw?.isEmpty == false ? raw : nil
        }
        guard let url = value("RL_SUPABASE_URL", "RLSupabaseURL").flatMap(URL.init(string:)),
            let key = value("RL_SUPABASE_ANON_KEY", "RLSupabaseAnonKey"),
            let api = value("RL_API_BASE", "RLAPIBase").flatMap(URL.init(string:))
        else { return nil }
        return AppConfig(supabaseURL: url, supabaseAnonKey: key, apiBase: api)
    }()

    /// The url scheme this build registered (Info.plist): `readinglist-mac-dev`
    /// for the dev bundle, `readinglist-mac` for a release. Electron builds
    /// have their own (`readinglist`, `readinglist-dev`), so no two apps on
    /// one machine ever fight over a deep link.
    static let urlScheme: String = {
        let types = Bundle.main.infoDictionary?["CFBundleURLTypes"] as? [[String: Any]]
        let schemes = types?.first?["CFBundleURLSchemes"] as? [String]
        return schemes?.first ?? "readinglist-mac"
    }()

    /// Where Supabase sends the browser back after Google: the callback
    /// path every desktop client shares.
    static var authCallbackURL: URL { URL(string: "\(urlScheme)://auth/callback")! }

    var isLocal: Bool {
        let host = supabaseURL.host ?? ""
        return host == "localhost" || host == "127.0.0.1"
    }
}
