import SwiftUI

/// The kit button. One accent (primary), two quiet tiers (secondary, ghost),
/// destructive, and the two Liquid Glass tiers for buttons that float over
/// content (toolbars, overlays). Heights follow the tight density: 24 / 28 / 32.
enum ButtonVariant { case primary, secondary, ghost, destructive, glass, glassProminent }

enum ButtonSize {
    case sm, md, lg, iconSm, iconMd, iconLg

    var height: CGFloat {
        switch self {
        case .sm, .iconSm: 24
        case .md, .iconMd: 28
        case .lg, .iconLg: 32
        }
    }
    var horizontalPadding: CGFloat {
        switch self {
        case .sm: 8
        case .md: 10
        case .lg: 12
        case .iconSm, .iconMd, .iconLg: 0
        }
    }
    var fontSize: CGFloat { self == .sm ? 12 : 13 }
    var iconSize: CGFloat {
        switch self {
        case .sm, .iconSm: 12
        case .md, .iconMd: 14
        case .lg, .iconLg: 16
        }
    }
    var isIconOnly: Bool {
        switch self {
        case .iconSm, .iconMd, .iconLg: true
        default: false
        }
    }
}

/// Where a button sits in a ButtonGroup: corners join accordingly.
enum ButtonGroupPosition { case none, first, middle, last }

private struct ButtonGroupPositionKey: EnvironmentKey {
    static let defaultValue = ButtonGroupPosition.none
}

private struct ButtonGroupGlassKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    var buttonGroupPosition: ButtonGroupPosition {
        get { self[ButtonGroupPositionKey.self] }
        set { self[ButtonGroupPositionKey.self] = newValue }
    }

    /// Inside a glass ButtonGroup the group is the one glass shape; the
    /// buttons draw no glass of their own.
    var buttonGroupGlass: Bool {
        get { self[ButtonGroupGlassKey.self] }
        set { self[ButtonGroupGlassKey.self] = newValue }
    }
}

struct KitButtonStyle: ButtonStyle {
    var variant: ButtonVariant = .secondary
    var size: ButtonSize = .md

    func makeBody(configuration: Configuration) -> some View {
        KitButtonBody(configuration: configuration, variant: variant, size: size)
    }
}

private struct KitButtonBody: View {
    let configuration: ButtonStyleConfiguration
    let variant: ButtonVariant
    let size: ButtonSize
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.buttonGroupPosition) private var groupPosition
    @Environment(\.buttonGroupGlass) private var groupGlass
    @State private var hovering = false

    var body: some View {
        HStack(spacing: 6) { configuration.label }
            .font(Typography.sans(size.fontSize, .medium))
            .foregroundStyle(foreground)
            .padding(.horizontal, size.horizontalPadding)
            .frame(height: size.height)
            .frame(minWidth: size.isIconOnly ? size.height : nil)
            .background(background, in: shape)
            .glassEffect(glass, in: shape, when: isGlass)
            .shadow(color: .black.opacity(shadowOpacity), radius: 1, y: 1)
            .opacity(isEnabled ? 1 : 0.5)
            .contentShape(shape)
            .onHover { hovering = $0 }
            .environment(\.iconSize, size.iconSize)
            .animation(Theme.stateMotion, value: hovering)
    }

    private var pressed: Bool { configuration.isPressed }

    private var isGlass: Bool { (variant == .glass || variant == .glassProminent) && !groupGlass }

    private var glass: Glass {
        variant == .glassProminent ? .regular.tint(Theme.primary).interactive() : .regular.interactive()
    }

    private var shape: UnevenRoundedRectangle {
        let radius = Theme.radiusControl
        switch groupPosition {
        case .none:
            return UnevenRoundedRectangle(
                cornerRadii: .init(
                    topLeading: radius, bottomLeading: radius, bottomTrailing: radius, topTrailing: radius),
                style: .continuous)
        case .first:
            return UnevenRoundedRectangle(
                cornerRadii: .init(topLeading: radius, bottomLeading: radius, bottomTrailing: 0, topTrailing: 0),
                style: .continuous)
        case .middle:
            return UnevenRoundedRectangle(
                cornerRadii: .init(topLeading: 0, bottomLeading: 0, bottomTrailing: 0, topTrailing: 0),
                style: .continuous)
        case .last:
            return UnevenRoundedRectangle(
                cornerRadii: .init(topLeading: 0, bottomLeading: 0, bottomTrailing: radius, topTrailing: radius),
                style: .continuous)
        }
    }

    private var foreground: Color {
        switch variant {
        case .primary: Theme.primaryForeground
        case .secondary: Theme.foreground
        case .ghost: hovering && isEnabled ? Theme.foreground : Theme.mutedForeground
        case .destructive: Theme.destructiveForeground
        case .glass: Theme.foreground
        case .glassProminent: Theme.primaryForeground
        }
    }

    private var background: Color {
        switch variant {
        case .primary: Theme.primary.opacity(pressed ? 0.85 : hovering ? 0.9 : 1)
        case .secondary: Theme.fg(pressed ? 0.11 : hovering ? 0.09 : 0.06)
        case .ghost: pressed ? Theme.fg(0.08) : hovering ? Theme.fg(0.05) : .clear
        case .destructive: Theme.destructive.opacity(hovering ? 0.9 : 1)
        case .glass, .glassProminent: groupGlass ? Theme.fg(pressed ? 0.12 : hovering ? 0.07 : 0) : .clear
        }
    }

    private var shadowOpacity: Double {
        switch variant {
        case .primary: 0.12
        case .destructive: 0.1
        case .secondary, .ghost, .glass, .glassProminent: 0
        }
    }
}

extension ButtonStyle where Self == KitButtonStyle {
    static func kit(_ variant: ButtonVariant = .secondary, _ size: ButtonSize = .md) -> KitButtonStyle {
        KitButtonStyle(variant: variant, size: size)
    }
}

/// Buttons that act as one control: a primary action with an options
/// chevron, a pair of toggles. Children keep their own variant; the group
/// joins the corners and separates them with a hairline of page colour.
/// `glass` makes the group one glass shape (a floating bar of glass
/// buttons), the buttons inside separated by a hairline.
struct ButtonGroup<Content: View>: View {
    var glass = false
    @ViewBuilder let content: () -> Content

    init(glass: Bool = false, @ViewBuilder content: @escaping () -> Content) {
        self.glass = glass
        self.content = content
    }

    var body: some View {
        Group(subviews: content()) { subviews in
            HStack(spacing: glass ? 0 : 1) {
                ForEach(subviews.indices, id: \.self) { index in
                    if glass, index > 0 {
                        Rectangle()
                            .fill(Theme.fg(0.12))
                            .frame(width: 1)
                            .padding(.vertical, 6)
                    }
                    subviews[index]
                }
            }
        }
        // Every child draws square and the group's own clip rounds the
        // ends. Set on the row, not per subview: a value set on a resolved
        // subview does not reach the button's style.
        .environment(\.buttonGroupPosition, .middle)
        .environment(\.buttonGroupGlass, glass)
        .background(glass ? Color.clear : Theme.background)
        .clipShape(Theme.controlShape)
        .glassEffect(.regular.interactive(), in: Theme.controlShape, when: glass)
    }
}

// MARK: - Demos

extension Demo {
    static let button = Demo(
        "Button",
        description:
            "Primary carries the accent and appears once per view. Secondary and ghost are the quiet tiers; destructive is for delete confirmations only."
    ) {
        VStack(alignment: .leading, spacing: 16) {
            DemoRow(label: "Variants") {
                Button("Review 110") {}.buttonStyle(.kit(.primary))
                Button("Flip") {}.buttonStyle(.kit(.secondary))
                Button("Next") {}.buttonStyle(.kit(.ghost))
                Button("Delete") {}.buttonStyle(.kit(.destructive))
            }
            DemoRow(label: "Sizes") {
                Button("Small") {}.buttonStyle(.kit(.primary, .sm))
                Button("Medium") {}.buttonStyle(.kit(.primary, .md))
                Button("Large") {}.buttonStyle(.kit(.primary, .lg))
            }
            DemoRow(label: "With icon") {
                Button(action: {}) {
                    Icon(.plus)
                    Text("Add")
                }.buttonStyle(.kit(.primary))
                Button(action: {}) {
                    Text("Open")
                    Icon(.arrowRight)
                }.buttonStyle(.kit(.secondary))
                Button(action: {}) {
                    Icon(.trash)
                    Text("Remove")
                }.buttonStyle(.kit(.ghost))
            }
            DemoRow(label: "Icon only") {
                Button(action: {}) { Icon(.plus) }.buttonStyle(.kit(.ghost, .iconSm))
                Button(action: {}) { Icon(.plus) }.buttonStyle(.kit(.secondary, .iconMd))
                Button(action: {}) { Icon(.plus) }.buttonStyle(.kit(.primary, .iconLg))
            }
            DemoRow(label: "Glass") {
                HStack(spacing: 8) {
                    Button("Review 110") {}.buttonStyle(.kit(.glassProminent))
                    Button("Flip") {}.buttonStyle(.kit(.glass))
                    Button(action: {}) { Icon(.plus) }.buttonStyle(.kit(.glass, .iconMd))
                }
                .padding(12)
                .background { DemoBackdrop().clipShape(Theme.surfaceShape) }
            }
            DemoRow(label: "Disabled") {
                Button("Review") {}.buttonStyle(.kit(.primary)).disabled(true)
                Button("Flip") {}.buttonStyle(.kit(.secondary)).disabled(true)
                Button("Next") {}.buttonStyle(.kit(.ghost)).disabled(true)
            }
        }
    }

    static let buttonGroup = Demo(
        "Button group",
        description:
            "Buttons that act as one control. Corners join; a hairline of page colour separates them. Glass makes the group one floating shape."
    ) {
        HStack(spacing: 16) {
            ButtonGroup {
                Button("Review 110") {}.buttonStyle(.kit(.primary))
                Button(action: {}) { Icon(.chevronDown) }.buttonStyle(.kit(.primary, .iconMd))
            }
            ButtonGroup {
                Button(action: {}) { Icon(.layoutList) }.buttonStyle(.kit(.secondary, .iconMd))
                Button(action: {}) { Icon(.layoutRows) }.buttonStyle(.kit(.secondary, .iconMd))
            }
            ButtonGroup {
                Button(action: {}) { Icon(.minus) }.buttonStyle(.kit(.secondary, .iconSm))
                Button("100%") {}.buttonStyle(.kit(.secondary, .sm))
                Button(action: {}) { Icon(.plus) }.buttonStyle(.kit(.secondary, .iconSm))
            }
            ButtonGroup(glass: true) {
                Button(action: {}) { Icon(.layoutList) }.buttonStyle(.kit(.glass, .iconMd))
                Button(action: {}) { Icon(.layoutRows) }.buttonStyle(.kit(.glass, .iconMd))
                Button("Review 110") {}.buttonStyle(.kit(.glass))
            }
            .padding(12)
            .background { DemoBackdrop().clipShape(Theme.surfaceShape) }
        }
    }
}
