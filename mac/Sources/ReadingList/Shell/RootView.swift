import SwiftUI

/// Signed out shows the sign-in page; signed in shows the shell with its
/// store. Until the session is known nothing is drawn but the background,
/// which is over before it is seen.
struct RootView: View {
    let session: SessionController
    #if DEBUG
        private var dev = DevState.shared
    #endif

    init(session: SessionController) {
        self.session = session
    }

    var body: some View {
        Group {
            #if DEBUG
                switch dev.preview {
                case .signIn: SignInView(session: session)
                case .loading: Theme.background
                case .error: ErrorPageView()
                case .missingConfig: MissingConfigView()
                case .shell, .review: live
                }
            #else
                live
            #endif
        }
        .font(Typography.sans(13))
        .foregroundStyle(Theme.foreground)
        .containerBackground(Theme.background, for: .window)
        .frame(minWidth: 400, minHeight: 400)
        .overlay { CommandPaletteHost() }
        .overlay { NotificationHost() }
        .openDesignBoardOnRequest()
        #if DEBUG
            .safeAreaInset(edge: .bottom, spacing: 0) { DevBar() }
        #endif
    }

    /// The real thing: the session decides.
    @ViewBuilder
    private var live: some View {
        switch session.state {
        case .unknown:
            Theme.background
        case .signedOut:
            SignInView(session: session)
        case .signedIn(let account):
            ShellView(account: account)
                .id(account.userId)
        }
    }
}

/// Sign in to save items, sync across devices, and review flashcards
/// (app/login/login-form.tsx): Google, and against the local stack the
/// dev user's email and password too.
struct SignInView: View {
    let session: SessionController
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    /// The browser has the sign-in; this page waits for the deep link back.
    @State private var awaitingBrowser = false
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Sign in").textStyle(.title, .medium)
                Text("Sign in to save items, sync across your devices, and review flashcards.")
                    .textStyle(.body)
                    .foregroundStyle(Theme.mutedForeground)
            }
            HStack(spacing: 8) {
                Button {
                    awaitingBrowser = true
                    error = nil
                    Task {
                        do {
                            try await session.signInWithGoogle()
                        } catch {
                            awaitingBrowser = false
                            self.error = error.localizedDescription
                        }
                    }
                } label: {
                    HStack(spacing: 6) {
                        if awaitingBrowser { Spinner() } else { Icon(.google, size: 14) }
                        Text("Continue with Google")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.kit(.secondary))
                .disabled(awaitingBrowser || busy)
                .accessibilityIdentifier("signin.google")
                if awaitingBrowser {
                    Button("Cancel") { awaitingBrowser = false }
                        .buttonStyle(.kit(.ghost))
                        .accessibilityIdentifier("signin.cancel")
                }
            }
            if session.allowsPasswordSignIn {
                HStack(spacing: 16) {
                    Rectangle().fill(Theme.border).frame(height: 1)
                    Text("or log in with email").textStyle(.small).foregroundStyle(Theme.mutedForeground)
                    Rectangle().fill(Theme.border).frame(height: 1)
                }
                VStack(alignment: .leading, spacing: 8) {
                    Field("Email (required)") { Input(text: $email, placeholder: "you@example.com") }
                    Field("Password") { Input(text: $password, placeholder: "Password") }
                    Button {
                        run { try await session.signIn(email: email, password: password) }
                    } label: {
                        Group { if busy { Spinner() } else { Text("Continue") } }
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.kit(.secondary))
                    .disabled(busy || email.isEmpty || password.isEmpty)
                    .accessibilityIdentifier("signin.submit")
                }
            }
            if let error {
                Text(error)
                    .textStyle(.small)
                    .foregroundStyle(Theme.destructive)
            }
        }
        .frame(width: 448, alignment: .leading)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background)
        .onChange(of: session.signInError) { _, message in
            // The deep link came back but the exchange failed.
            guard let message else { return }
            awaitingBrowser = false
            error = message
        }
    }

    private func run(_ action: @escaping () async throws -> Void) {
        busy = true
        error = nil
        Task {
            defer { busy = false }
            do { try await action() } catch { self.error = error.localizedDescription }
        }
    }
}
