import AppKit
import Foundation
import Observation
import ReadingListAPI
import Supabase

/// A signed-in user and the services bound to their session.
struct Account: Sendable {
    let userId: String
    let email: String?
    let client: SupabaseClient
    let api: ItemsAPI
    let snapshot: SnapshotStore<Snapshot>
    let cardSnapshot: SnapshotStore<CardSnapshot>
    /// Stamped on this client's writes; the sync echo carries it back.
    let syncOrigin: String
}

/// The Supabase session: restored from the Keychain at launch, Google
/// through the system web session, or email and password against the local
/// stack. `state` drives the root view.
@MainActor
@Observable
final class SessionController {
    enum State {
        case unknown
        case signedOut
        case signedIn(Account)
    }

    private(set) var state: State = .unknown
    /// The last deep-link exchange that failed, for the sign-in page.
    private(set) var signInError: String?
    let config: AppConfig
    let client: SupabaseClient
    /// Email and password is only for the local stack's dev user.
    var allowsPasswordSignIn: Bool { config.isLocal }

    private static let syncOriginKey = "sync-origin-id"
    private var watcher: Task<Void, Never>?

    init(config: AppConfig) {
        self.config = config
        // The saved session is announced at once, before the network
        // confirms it, so the app opens signed in. Dev builds keep it in a
        // file (every ad-hoc re-signed build would otherwise be a new app to
        // the Keychain); a release uses the SDK's Keychain storage.
        #if DEBUG
            let storage: any AuthLocalStorage = FileAuthStorage.inApplicationSupport(
                scope: config.supabaseURL.host ?? "default")
            let options = SupabaseClientOptions(auth: .init(storage: storage, emitLocalSessionAsInitialSession: true))
        #else
            let options = SupabaseClientOptions(auth: .init(emitLocalSessionAsInitialSession: true))
        #endif
        client = SupabaseClient(supabaseURL: config.supabaseURL, supabaseKey: config.supabaseAnonKey, options: options)
    }

    /// Restores the saved session, then follows every change to it.
    func start() {
        guard watcher == nil else { return }
        watcher = Task { [weak self] in
            guard let self else { return }
            for await change in client.auth.authStateChanges {
                switch change.event {
                case .initialSession, .signedIn, .tokenRefreshed, .userUpdated:
                    if let session = change.session {
                        if case .signedIn(let account) = state,
                            account.userId == session.user.id.uuidString.lowercased()
                        {
                            continue
                        }
                        state = .signedIn(account(for: session))
                    } else {
                        state = .signedOut
                    }
                case .signedOut:
                    state = .signedOut
                default:
                    break
                }
            }
        }
    }

    private func account(for session: Session) -> Account {
        let userId = session.user.id.uuidString.lowercased()
        let defaults = UserDefaults.standard
        let origin =
            defaults.string(forKey: Self.syncOriginKey)
            ?? {
                let fresh = UUID().uuidString.lowercased()
                defaults.set(fresh, forKey: Self.syncOriginKey)
                return fresh
            }()
        let client = client
        let api = ItemsAPI(
            base: config.apiBase,
            accessToken: { try await client.auth.session.accessToken },
            syncOrigin: origin
        )
        return Account(
            userId: userId, email: session.user.email, client: client,
            api: api,
            snapshot: SnapshotStore.inApplicationSupport(name: "items-\(userId).json"),
            cardSnapshot: SnapshotStore.inApplicationSupport(name: "flashcards-\(userId).json"),
            syncOrigin: origin
        )
    }

    /// The browser came back: `<scheme>://auth/callback?code=…` completes
    /// the PKCE exchange.
    func handle(_ url: URL) async {
        guard url.host == "auth", url.path == "/callback" else { return }
        signInError = nil
        do {
            _ = try await client.auth.session(from: url)
        } catch {
            signInError = ErrorSummary(error).message
        }
    }

    /// Google: the system browser opens the provider and Supabase sends it
    /// straight back to `<scheme>://auth/callback?code=…` (the scheme's
    /// callback url must be in the project's redirect allowlist), which
    /// lands in `handle(_:)`. The PKCE verifier stays in this client.
    func signInWithGoogle() async throws {
        let url = try oauthSignInURL()
        lastOAuthURL = url
        NSWorkspace.shared.open(url)
    }

    /// The url the browser is sent to. Each call makes a fresh PKCE verifier,
    /// which only the code from that url can redeem.
    func oauthSignInURL() throws -> URL {
        try client.auth.getOAuthSignInURL(provider: .google, redirectTo: AppConfig.authCallbackURL)
    }

    /// The url the last sign-in opened (the harness reads it).
    private(set) var lastOAuthURL: URL?

    func signIn(email: String, password: String) async throws {
        _ = try await client.auth.signIn(email: email, password: password)
    }

    func signOut() async {
        try? await client.auth.signOut()
        state = .signedOut
    }
}

/// Cross-device sync: the `items_sync_notify` trigger broadcasts on the
/// user's private topic after every write to items or flashcards; a ping
/// from another client refetches the list. Own writes carry this client's
/// origin and are ignored. A slow timer covers a missed message.
@MainActor
final class SyncWatcher {
    private let account: Account
    private let store: ItemStore
    private let cards: FlashcardStore
    private var listener: Task<Void, Never>?
    private var ticker: Task<Void, Never>?

    init(account: Account, store: ItemStore, cards: FlashcardStore) {
        self.account = account
        self.store = store
        self.cards = cards
    }

    private func refresh() {
        store.refresh()
        cards.refresh()
    }

    func start() {
        guard listener == nil else { return }
        let channel = account.client.channel("items-sync:\(account.userId)") { $0.isPrivate = true }
        let origin = account.syncOrigin
        listener = Task { [weak self] in
            let stream = channel.broadcastStream(event: "data-changed")
            try? await channel.subscribeWithError()
            for await message in stream {
                let payload = (message["payload"]?.objectValue) ?? message
                let from = payload["origin"]?.stringValue ?? ""
                if from == origin { continue }
                self?.refresh()
            }
        }
        ticker = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(300))
                self?.refresh()
            }
        }
    }

    deinit {
        listener?.cancel()
        ticker?.cancel()
    }
}
