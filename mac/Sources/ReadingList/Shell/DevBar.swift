import SwiftUI

#if DEBUG
    /// What the dev bar is previewing in place of the real state, so the
    /// sign-in page, the error page and the rest can be seen without
    /// arranging for them (components/dev-banner.tsx and the /dev-error route
    /// on the web).
    @MainActor
    @Observable
    final class DevState {
        static let shared = DevState()

        enum Preview: String, CaseIterable, Identifiable {
            case shell, review, signIn = "sign-in", loading, error, missingConfig = "missing-config"

            var id: String { rawValue }

            var title: String {
                switch self {
                case .shell: "Reading list (app shell)"
                case .review: "Review"
                case .signIn: "Sign in"
                case .loading: "Loading (session unknown)"
                case .error: "Error page"
                case .missingConfig: "No backend configured"
                }
            }
        }

        var preview: Preview = .shell
        /// What the shell is showing, for the bar's breadcrumb.
        var viewLabel = ""

        func show(_ preview: Preview) {
            self.preview = preview == .review ? .shell : preview
            if preview == .review { AppServices.navigator?.showReview() }
            if preview == .shell { AppServices.navigator?.showItems() }
        }
    }

    /// The bar along the bottom of the window in debug builds: which backend
    /// the app points at (blue for the local stack, amber for production, the
    /// web banner's colours), where the shell is, and a menu of UI states to
    /// preview. Collapses to a badge in the corner.
    struct DevBar: View {
        @Environment(SessionController.self) private var session
        @AppStorage("dev.bar.collapsed") private var collapsed = false
        private var dev = DevState.shared

        private var isLocal: Bool { session.config.isLocal }
        private var tint: Color {
            isLocal ? Color(red: 0.23, green: 0.51, blue: 0.96) : Color(red: 0.96, green: 0.62, blue: 0.04)
        }
        private var ink: Color {
            isLocal ? Color(red: 0.09, green: 0.16, blue: 0.36) : Color(red: 0.27, green: 0.16, blue: 0.02)
        }

        var body: some View {
            if collapsed {
                Button {
                    collapsed = false
                } label: {
                    HStack(spacing: 4) {
                        badge
                        Icon(.chevronRight, size: 10)
                    }
                    .padding(.horizontal, 8)
                    .frame(height: 20)
                    .background(tint, in: UnevenRoundedRectangle(topTrailingRadius: 4))
                }
                .buttonStyle(.plain)
                .foregroundStyle(ink)
                .tooltip("Show dev bar")
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityIdentifier("dev.expand")
            } else {
                HStack(spacing: 10) {
                    badge
                    Text("Native")
                    Text(session.config.apiBase.host ?? session.config.apiBase.absoluteString).opacity(0.8)
                    if !dev.viewLabel.isEmpty {
                        HStack(spacing: 4) {
                            Icon(.chevronRight, size: 10)
                            Text(dev.viewLabel)
                        }
                        .opacity(0.8)
                    }
                    Spacer(minLength: 8)
                    Menu {
                        ForEach(DevState.Preview.allCases) { preview in
                            Button(preview.title) { dev.show(preview) }
                        }
                        Divider()
                        Button("Design board") { _ = BoardState.shared.open(nil) }
                    } label: {
                        HStack(spacing: 4) {
                            Text("Go to")
                            Icon(.chevronDown, size: 10)
                        }
                        .padding(.horizontal, 6)
                        .frame(height: 16)
                        .background(ink.opacity(0.12), in: Theme.shape(3))
                    }
                    .menuStyle(.button)
                    .buttonStyle(.plain)
                    .menuIndicator(.hidden)
                    .fixedSize()
                    .accessibilityIdentifier("dev.goto")
                    Button {
                        collapsed = true
                    } label: {
                        Icon(.x, size: 10)
                    }
                    .buttonStyle(.plain)
                    .tooltip("Hide dev bar")
                    .accessibilityIdentifier("dev.collapse")
                }
                .font(Typography.sans(10, .medium))
                .foregroundStyle(ink)
                .padding(.horizontal, 10)
                .frame(height: 20)
                .frame(maxWidth: .infinity)
                .background(tint)
            }
        }

        private var badge: some View {
            Text(isLocal ? "LOCAL" : "PROD")
                .font(Typography.sans(9, .bold))
                .padding(.horizontal, 4)
                .padding(.vertical, 1)
                .background(ink, in: Theme.shape(2))
                .foregroundStyle(tint)
                .tooltip("Supabase: \(session.config.supabaseURL.absoluteString)")
        }
    }

    /// The root error page, as the web's route error boundary shows it. Only
    /// reachable from the dev bar until the app has errors of its own to show
    /// this way.
    struct ErrorPageView: View {
        var message = "Synthetic error for previewing the error page"

        var body: some View {
            NonIdealState(title: "Something went wrong", description: message) {
                Button("Reload") { DevState.shared.show(.shell) }
                    .buttonStyle(.kit(.primary))
            }
            .padding(48)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.background)
        }
    }
#endif
