import SwiftUI

/// What every kit component ships with: the board renders `content` under
/// the component's title. Keep demos exhaustive (every variant, size and
/// state), since the board is where a component is judged before it is used.
/// The web board collects `*.demo.tsx` automatically; here `Demo.all` is the
/// registry, one line per component.
@MainActor
struct Demo: Identifiable {
    enum Section: String, CaseIterable {
        case base = "Base"
        case app = "App"

        var blurb: String {
            switch self {
            case .base:
                "Primitives with no knowledge of the app: anything here could ship in another product unchanged."
            case .app:
                "Compositions shaped by this app: rows, sidebar entries and other pieces that know what an item or a card is."
            }
        }
    }

    let id: String
    let title: String
    let description: String
    let section: Section
    let content: () -> AnyView

    init<Content: View>(
        _ title: String,
        section: Section = .base,
        description: String,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.id = Demo.slug(title)
        self.title = title
        self.description = description
        self.section = section
        self.content = { AnyView(content()) }
    }

    /// The slug a board section and its outline entry share.
    static func slug(_ title: String) -> String {
        let lowered = title.lowercased()
        var slug = ""
        var pendingDash = false
        for scalar in lowered.unicodeScalars {
            if scalar.properties.isAlphabetic || scalar.properties.numericType != nil {
                if pendingDash, !slug.isEmpty { slug.append("-") }
                slug.unicodeScalars.append(scalar)
                pendingDash = false
            } else {
                pendingDash = true
            }
        }
        return slug
    }
}
