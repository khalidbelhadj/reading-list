import SwiftUI

struct NotifyAction: Identifiable {
    let id = UUID()
    let label: String
    /// The one action that resolves the notification, in the foreground
    /// colour; everything else reads as quiet text.
    var primary = false
    var action: () -> Void = {}
}

struct NotifyOptions {
    enum Tone { case standard, error }

    var title: String
    var description: String?
    /// The long version, behind "Show more": a request's full error, say.
    var detail: String?
    var icon: TablerIcon?
    var iconColor: Color = Theme.mutedForeground
    /// Short trailing note beside the title: "2m ago", "Saved".
    var meta: String?
    var actions: [NotifyAction] = []
    var tone: Tone = .standard
    var duration: Double?
}

/// The notification card: a frost surface with the surface radius, an icon,
/// a bold title with a quiet meta, a few lines of description (more behind
/// "Show more"), text-only actions, and a close in the corner. Modelled on
/// macOS notifications.
struct NotificationCard: View {
    let options: NotifyOptions
    let onClose: () -> Void
    /// The reader opened the rest of the description: keep the card up.
    var onExpand: () -> Void = {}

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if let icon = options.icon {
                Icon(icon, size: 20)
                    .foregroundStyle(options.iconColor)
                    .frame(width: 32, height: 32)
            }
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(options.title)
                        .textStyle(.body, .medium)
                        .foregroundStyle(options.tone == .error ? Theme.destructive : Theme.foreground)
                        .lineLimit(1)
                    if let meta = options.meta {
                        Text(meta)
                            .textStyle(.small)
                            .foregroundStyle(Theme.mutedForeground)
                    }
                }
                if let description = options.description {
                    ExpandableText(description, detail: options.detail, onExpand: onExpand)
                }
                if !options.actions.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(options.actions) { action in
                            Button(action.label) {
                                action.action()
                                onClose()
                            }
                            .buttonStyle(.kit(.ghost, .sm))
                            .foregroundStyle(action.primary ? Theme.foreground : Theme.mutedForeground)
                        }
                    }
                    .padding(.top, 8)
                    .padding(.leading, -8)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(16)
        .padding(.trailing, 24)
        .frame(width: 352, alignment: .leading)
        .overlay(alignment: .topTrailing) {
            Button(action: onClose) { Icon(.x) }
                .buttonStyle(.kit(.ghost, .iconSm))
                .padding(10)
                .accessibilityLabel("Dismiss")
        }
        .frost()
    }
}

/// Body text clamped to a few lines, with "Show more" when there is more:
/// the rest of the text, and the detail, which only shows expanded. The
/// full text is always laid out and the boxes around it animate between
/// the clamped and the full height, so opening reveals the rest smoothly
/// instead of re-wrapping.
private struct ExpandableText: View {
    let text: String
    var detail: String?
    var lines = 3
    var onExpand: () -> Void = {}
    @State private var expanded = false
    @State private var fullHeight: CGFloat = 0
    /// Measured from the clamped copy; starts as an estimate so the first
    /// frame is already clamped.
    @State private var clampedHeight: CGFloat = 3 * 18

    init(_ text: String, detail: String? = nil, lines: Int = 3, onExpand: @escaping () -> Void = {}) {
        self.text = text
        self.detail = detail
        self.lines = lines
        self.onExpand = onExpand
    }

    private var truncated: Bool { detail != nil || fullHeight > clampedHeight + 0.5 }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(text)
                .textStyle(.body)
                .foregroundStyle(Theme.mutedForeground)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .onGeometryChange(for: CGFloat.self) {
                    $0.size.height
                } action: {
                    fullHeight = $0
                }
                .frame(maxHeight: expanded ? nil : clampedHeight, alignment: .top)
                .clipped()
                .background {
                    // The same text, clamped: how tall the first lines are.
                    Text(text)
                        .textStyle(.body)
                        .lineLimit(lines)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .onGeometryChange(for: CGFloat.self) {
                            $0.size.height
                        } action: {
                            clampedHeight = $0
                        }
                        .hidden()
                }
            if let detail {
                Text(detail)
                    .textStyle(.small)
                    .foregroundStyle(Theme.mutedForeground)
                    .textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 4)
                    .frame(maxHeight: expanded ? nil : 0, alignment: .top)
                    .clipped()
            }
            if truncated {
                TextLink(variant: .quiet, action: toggle) {
                    Text(expanded ? "Show less" : "Show more")
                }
                .textStyle(.small, .medium)
                .accessibilityIdentifier("notification.show-more")
            }
        }
    }

    private func toggle() {
        withAnimation(Theme.layoutMotion) { expanded.toggle() }
        if expanded { onExpand() }
    }
}

/// Where notifications are posted from: `Notifier.shared.notify(...)`. An
/// error gets its sound here, the one place every failure passes through.
@MainActor
@Observable
final class Notifier {
    static let shared = Notifier()

    struct Item: Identifiable {
        let id: UUID
        let options: NotifyOptions
    }

    private(set) var items: [Item] = []
    private var timers: [UUID: Task<Void, Never>] = [:]

    @discardableResult
    func notify(_ options: NotifyOptions) -> UUID {
        if options.tone == .error { Sounds.shared.error() }
        let id = UUID()
        items.append(Item(id: id, options: options))
        let duration = options.duration ?? (options.actions.isEmpty ? 4 : 10)
        timers[id] = Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(duration))
            guard !Task.isCancelled else { return }
            self?.dismiss(id)
        }
        return id
    }

    /// Keeps a notification up until it is closed: the reader is in it.
    func hold(_ id: UUID) {
        timers[id]?.cancel()
        timers[id] = nil
    }

    func dismiss(_ id: UUID) {
        timers[id]?.cancel()
        timers[id] = nil
        items.removeAll { $0.id == id }
    }
}

/// Host for notifications: bottom-right of the window, newest at the bottom,
/// four at most. Mount once per window over everything else.
struct NotificationHost: View {
    private var notifier = Notifier.shared

    var body: some View {
        VStack(alignment: .trailing, spacing: 8) {
            ForEach(notifier.items.suffix(4)) { item in
                NotificationCard(
                    options: item.options, onClose: { notifier.dismiss(item.id) }, onExpand: { notifier.hold(item.id) }
                )
                .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
        .animation(Theme.layoutMotion, value: notifier.items.count)
    }
}

// MARK: - Demo

private let longError = """
    Client encountered an error invoking the operation "listItems", caused by "Middleware of type 'AuthMiddleware' threw an error.", \
    underlying error: Error Domain=NSURLErrorDomain Code=-1004 "Could not connect to the server." \
    UserInfo={NSErrorFailingURLStringKey=http://localhost:54321/auth/v1/token?grant_type=refresh_token, \
    NSLocalizedDescription=Could not connect to the server.}
    """

extension Demo {
    static let notification = Demo(
        "Notification",
        description:
            "Bottom-right, frost, the surface radius. Icon, bold title with a quiet meta, a few lines of description (the rest, and any detail, behind Show more, which also keeps the card up), text actions, close in the corner. Click to try the live ones."
    ) {
        VStack(alignment: .leading, spacing: 24) {
            HStack(spacing: 8) {
                Button("Plain") {
                    Notifier.shared.notify(
                        NotifyOptions(title: "Marked as read", icon: .check, iconColor: Theme.primary, meta: "now"))
                }
                .buttonStyle(.kit(.secondary))
                Button("With actions") {
                    Notifier.shared.notify(
                        NotifyOptions(
                            title: "110 cards due", description: "Your daily review is waiting.",
                            icon: .cards, iconColor: Theme.primary, meta: "2m ago",
                            actions: [NotifyAction(label: "Later"), NotifyAction(label: "Start review", primary: true)]
                        ))
                }
                .buttonStyle(.kit(.secondary))
                Button("With description") {
                    Notifier.shared.notify(
                        NotifyOptions(
                            title: "Link copied", description: "youtube.com/watch?v=x1npPrzyKfs", icon: .link,
                            meta: "now"))
                }
                .buttonStyle(.kit(.secondary))
                Button("Error") {
                    Notifier.shared.notify(
                        NotifyOptions(
                            title: "Could not save",
                            description: "The server did not respond. Your edit is still here.",
                            meta: "now", actions: [NotifyAction(label: "Retry", primary: true)], tone: .error
                        ))
                }
                .buttonStyle(.kit(.secondary))
                Button("Long error") {
                    Notifier.shared.notify(
                        NotifyOptions(
                            title: "Could not save item", description: "Could not connect to the server.",
                            detail: longError,
                            meta: "now", tone: .error
                        ))
                }
                .buttonStyle(.kit(.secondary))
                .accessibilityIdentifier("demo.notification.long")
            }
            NotificationCard(
                options: NotifyOptions(
                    title: "110 cards due", description: "Your daily review is waiting.",
                    icon: .cards, iconColor: Theme.primary, meta: "2m ago",
                    actions: [NotifyAction(label: "Later"), NotifyAction(label: "Start review", primary: true)]
                )
            ) {}
        }
    }
}
