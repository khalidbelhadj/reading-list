import AppKit
import SwiftUI

@main
struct ReadingListApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var session: SessionController?

    init() {
        Typography.register()
        if let config = AppConfig.current {
            let controller = SessionController(config: config)
            _session = State(initialValue: controller)
            AppServices.session = controller
        }
    }

    var body: some Scene {
        // One window, like the Electron app. Hidden title bar: the sidebar
        // and the pane own the top of the window, the traffic lights float.
        Window("Reading List", id: "main") {
            if let session {
                RootView(session: session)
                    .environment(session)
                    .onAppear { session.start() }
                    .onOpenURL { url in Task { await session.handle(url) } }
            } else {
                MissingConfigView()
            }
        }
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 1100, height: 800)
        .commands { BoardCommands() }

        Window("Design board", id: "design") {
            DesignBoardView()
        }
        .defaultSize(width: 1180, height: 840)
    }
}

/// The live services, for the parts of the app that are not views (the
/// debug socket).
@MainActor
enum AppServices {
    static var session: SessionController?
    static var store: ItemStore?
    static var cards: FlashcardStore?
    static var settings: SettingsStore?
    static var navigator: Navigator?
}

/// No Supabase configuration in the environment or Info.plist.
struct MissingConfigView: View {
    var body: some View {
        NonIdealState(
            title: "No backend configured",
            description:
                "Launch with `bun run mac run --env=local` (or prod), which sets RL_SUPABASE_URL, RL_SUPABASE_ANON_KEY and RL_API_BASE."
        ) {}
        .padding(48)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .font(Typography.sans(13))
        .foregroundStyle(Theme.foreground)
        .containerBackground(Theme.background, for: .window)
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        // stdout is a log file when launched by `bun run mac run`; keep it live.
        setvbuf(stdout, nil, _IOLBF, 0)
        #if DEBUG
            DebugServer.shared.start()
        #endif
    }
}

/// Opens the design board window when BoardState asks for it (the menu
/// command, or `bun run mac board`). Lives on the main window's content,
/// where `openWindow` is available.
private struct OpenDesignBoardOnRequest: ViewModifier {
    @Environment(\.openWindow) private var openWindow

    func body(content: Content) -> some View {
        content.onReceive(NotificationCenter.default.publisher(for: .openDesignBoard)) { _ in
            openWindow(id: "design")
        }
    }
}

extension View {
    func openDesignBoardOnRequest() -> some View {
        modifier(OpenDesignBoardOnRequest())
    }
}
