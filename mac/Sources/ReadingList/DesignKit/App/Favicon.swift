import SwiftUI

/// Where an item's favicon comes from: the stored one when the extractor
/// found it, otherwise Google's favicon service for the item's host.
func faviconURL(faviconURL stored: String? = nil, url: String) -> URL? {
    if let stored, let storedURL = URL(string: stored) { return storedURL }
    guard let host = URL(string: url)?.host, !host.isEmpty else { return nil }
    return URL(string: "https://www.google.com/s2/favicons?domain=\(host)&sz=32")
}

/// The id of a YouTube video URL, or nil (lib/url.ts, `getYouTubeVideoId`;
/// the fixtures in mac/Tests pin the two together).
func youtubeVideoID(_ url: String) -> String? {
    guard let parsed = URL(string: url), var host = parsed.host?.lowercased() else { return nil }
    if host.hasPrefix("www.") { host.removeFirst(4) }
    let isID = { (candidate: Substring) in
        candidate.count == 11 && candidate.allSatisfy { $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" }
    }
    // Trailing slashes are tolerated, as on the web.
    var path = Substring(parsed.path)
    while path.hasSuffix("/") { path = path.dropLast() }
    if host == "youtu.be" {
        let id = path.dropFirst().split(separator: "/", maxSplits: 1, omittingEmptySubsequences: false).first ?? ""
        return isID(id) ? String(id) : nil
    }
    guard host == "youtube.com" || host == "m.youtube.com" else { return nil }
    if path == "/watch" {
        guard
            let id = URLComponents(url: parsed, resolvingAgainstBaseURL: false)?.queryItems?.first(where: {
                $0.name == "v"
            })?.value,
            isID(Substring(id))
        else { return nil }
        return id
    }
    for prefix in ["/shorts/", "/embed/"] where path.hasPrefix(prefix) {
        let id = path.dropFirst(prefix.count).prefix(11)
        if isID(id) { return String(id) }
    }
    return nil
}

/// "3h ago", "2d ago", "1mo ago" (lib/format-time.ts, `timeAgo`; floor at
/// every step, so "1d ago" means at least 24 hours).
func timeAgo(_ date: Date, now: Date = Date()) -> String {
    let minutes = Int((now.timeIntervalSince(date) / 60).rounded(.down))
    if minutes < 1 { return "just now" }
    if minutes < 60 { return "\(minutes)m ago" }
    let hours = minutes / 60
    if hours < 24 { return "\(hours)h ago" }
    let days = hours / 24
    if days < 30 { return "\(days)d ago" }
    let months = days / 30
    if months < 12 { return "\(months)mo ago" }
    return "\(months / 12)y ago"
}

/// An item's favicon, shown bare: the icon as the site serves it, nothing
/// behind it. A file glyph when there is no URL or the image fails.
struct Favicon: View {
    let url: String
    var storedFaviconURL: String?
    var size: CGFloat = 16

    var body: some View {
        if let source = faviconURL(faviconURL: storedFaviconURL, url: url) {
            AsyncImage(url: source) { phase in
                if let image = phase.image {
                    image.resizable().scaledToFit()
                } else if phase.error != nil {
                    fallback
                } else {
                    Color.clear
                }
            }
            .frame(width: size, height: size)
            .clipShape(Theme.shape(3))
        } else {
            fallback
        }
    }

    private var fallback: some View {
        Icon(.fileFilled, size: size)
            .foregroundStyle(Theme.mutedForeground)
    }
}

private let paperTitle = Theme.dynamic(oklch(0.21, 0.006, 285), oklch(0.21, 0.006, 285))
private let paperLine = Theme.dynamic(oklch(0.87, 0.006, 286), oklch(0.87, 0.006, 286))

/// The preview thumbnail for cozy rows: a YouTube thumbnail when the URL is
/// a video, otherwise a "page" peeking up from a tinted tray (a stored
/// first-page render, or a stylised title and lines), with a favicon badge
/// in the corner.
struct ItemThumbnail: View {
    let url: String
    let title: String
    var previewImageURL: URL?
    var width: CGFloat = 96
    var height: CGFloat = 54

    var body: some View {
        ZStack {
            Theme.fg(0.05)
            if let id = youtubeVideoID(url), let thumb = URL(string: "https://i.ytimg.com/vi/\(id)/hqdefault.jpg") {
                AsyncImage(url: thumb) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        page
                    }
                }
            } else {
                page
            }
        }
        .frame(width: width, height: height)
        .clipShape(Theme.shape(3))
        .overlay(Theme.shape(3).strokeBorder(Theme.fg(0.05), lineWidth: 1))
        .overlay(alignment: .bottomTrailing) {
            Favicon(url: url, size: 12)
                .clipShape(Theme.shape(2))
                .frame(width: 16, height: 16)
                .background(Theme.background.opacity(0.9), in: Theme.shape(3))
                .overlay(Theme.shape(3).strokeBorder(Theme.fg(0.1), lineWidth: 1))
                .padding(4)
        }
    }

    /// The sheet of paper emerging from the tray.
    private var page: some View {
        GeometryReader { geometry in
            let sheet = UnevenRoundedRectangle(topLeadingRadius: 3, topTrailingRadius: 3)
            ZStack(alignment: .topLeading) {
                sheet.fill(Theme.paper)
                    .shadow(color: .black.opacity(0.18), radius: 4, y: 2)
                if let previewImageURL {
                    AsyncImage(url: previewImageURL) { phase in
                        if let image = phase.image { image.resizable().scaledToFill() } else { Color.clear }
                    }
                    .clipShape(sheet)
                } else {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(title.trimmingCharacters(in: .whitespaces).isEmpty ? "Untitled" : title)
                            .font(Typography.sans(6, .semibold))
                            .foregroundStyle(paperTitle)
                            .lineLimit(2)
                            .lineSpacing(0)
                        Capsule().fill(paperLine).frame(height: 2).padding(.top, 2)
                        Capsule().fill(paperLine).frame(width: geometry.size.width * 0.88 - 12, height: 2)
                        Capsule().fill(paperLine).frame(width: geometry.size.width * 0.7 - 12, height: 2)
                    }
                    .padding(.horizontal, 6)
                    .padding(.top, 6)
                }
            }
            .frame(width: geometry.size.width - 24, height: geometry.size.height * 1.3 - 8)
            .offset(x: 12, y: 8)
        }
    }
}

/// What a hovered item shows: the preview thumbnail, the full title, and
/// when it was added. Meant for the HoverCard beside a sidebar row.
struct ItemPreview: View {
    let title: String
    let url: String
    let createdAt: Date
    var now = Date()
    var previewImageURL: URL?

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            ItemThumbnail(url: url, title: title, previewImageURL: previewImageURL, width: 128, height: 72)
            VStack(alignment: .leading, spacing: 2) {
                Text(title.isEmpty ? "Untitled" : title)
                    .textStyle(.body)
                    .lineLimit(2)
                Text("Added \(timeAgo(createdAt, now: now))")
                    .textStyle(.small)
                    .foregroundStyle(Theme.mutedForeground)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: 376)
    }
}

// MARK: - Demos

private let sites: [(String, String)] = [
    ("YouTube", "https://www.youtube.com/watch?v=x1npPrzyKfs"),
    ("arXiv", "https://arxiv.org/abs/1908.01262"),
    ("GitHub", "https://github.com/google/brotli"),
    ("Wikipedia", "https://en.wikipedia.org/wiki/Kruskal%27s_algorithm"),
    ("LeetCode", "https://leetcode.com/problems/two-sum/"),
    ("No URL", ""),
]

private let demoNow = Date(timeIntervalSince1970: 1_787_450_400)  // 2026-08-22T02:00Z

extension Demo {
    static let favicon = Demo(
        "Favicon", section: .app,
        description:
            "An item's site icon as served, nothing behind it; a file glyph when there is no URL or the image fails. 16px in rows, 14px in meta, 18px beside a title."
    ) {
        VStack(alignment: .leading, spacing: 24) {
            HStack(spacing: 12) {
                ForEach(sites, id: \.0) { Favicon(url: $0.1) }
                Text("16px").textStyle(.small).foregroundStyle(Theme.mutedForeground).padding(.leading, 8)
            }
            HStack(spacing: 12) {
                ForEach(sites, id: \.0) { Favicon(url: $0.1, size: 20) }
                Text("20px").textStyle(.small).foregroundStyle(Theme.mutedForeground).padding(.leading, 8)
            }
            VStack(spacing: 2) {
                ForEach(sites.prefix(4), id: \.0) { site in
                    ListRow(title: "\(site.0): a title long enough to fade away at the right edge of the row") {
                        Favicon(url: site.1)
                    }
                }
            }
            .frame(width: 384)
        }
    }

    static let itemThumbnail = Demo(
        "Item thumbnail", section: .app,
        description:
            "The cozy-row preview: a YouTube thumbnail for videos, otherwise the page peeking from its tray (a stored first-page render fills it; a stylised placeholder stands in). Favicon badge in the corner."
    ) {
        HStack(alignment: .top, spacing: 12) {
            ItemThumbnail(url: "https://www.youtube.com/watch?v=x1npPrzyKfs", title: "Linux Container Primitives")
            ItemThumbnail(
                url: "https://arxiv.org/abs/1908.01262",
                title: "A systematic review of fuzzing based on machine learning")
        }
    }

    static let itemPreview = Demo(
        "Item preview", section: .app,
        description: "The hover card's content for an item: the preview thumbnail, full title, and when it was added."
    ) {
        HStack(alignment: .top, spacing: 16) {
            Surface(kind: .frost, padding: .sm) {
                ItemPreview(
                    title: "Linux Container Primitives: cgroups, namespaces, and more",
                    url: "https://www.youtube.com/watch?v=x1npPrzyKfs",
                    createdAt: demoNow.addingTimeInterval(-2.5 * 3600), now: demoNow
                )
            }
            .frame(width: 288)
            Surface(kind: .frost, padding: .sm) {
                ItemPreview(
                    title: "[1908.01262] A systematic review of fuzzing based on machine learning techniques",
                    url: "https://arxiv.org/abs/1908.01262",
                    createdAt: demoNow.addingTimeInterval(-6.7 * 86_400), now: demoNow
                )
            }
            .frame(width: 288)
        }
    }
}
