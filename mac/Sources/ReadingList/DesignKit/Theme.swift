import AppKit
import SwiftUI

/// A colour in OKLCH, written exactly as in app/globals.css.
struct OKLCH: Sendable {
    var l: Double
    var c: Double
    var h: Double
    var alpha: Double = 1

    /// Gamma-encoded sRGB, clamped to the gamut (the same conversion the
    /// browser does for `oklch()`).
    var srgb: (red: Double, green: Double, blue: Double) {
        let hue = h * .pi / 180
        let a = c * cos(hue)
        let b = c * sin(hue)
        let lPrime = l + 0.3963377774 * a + 0.2158037573 * b
        let mPrime = l - 0.1055613458 * a - 0.0638541728 * b
        let sPrime = l - 0.0894841775 * a - 1.2914855480 * b
        let l3 = lPrime * lPrime * lPrime
        let m3 = mPrime * mPrime * mPrime
        let s3 = sPrime * sPrime * sPrime
        let red = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
        let green = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
        let blue = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3
        return (Self.gamma(red), Self.gamma(green), Self.gamma(blue))
    }

    private static func gamma(_ linear: Double) -> Double {
        let value = min(max(linear, 0), 1)
        return value <= 0.0031308 ? 12.92 * value : 1.055 * pow(value, 1 / 2.4) - 0.055
    }

    var nsColor: NSColor {
        let (red, green, blue) = srgb
        return NSColor(srgbRed: red, green: green, blue: blue, alpha: alpha)
    }
}

func oklch(_ l: Double, _ c: Double, _ h: Double, alpha: Double = 1) -> OKLCH {
    OKLCH(l: l, c: c, h: h, alpha: alpha)
}

/// The design tokens. The colours, radii and row heights come from
/// app/globals.css through Theme.generated.swift (`bun run mac:tokens`),
/// resolved per appearance so every colour follows the window's light or
/// dark mode; this file keeps what has no CSS token: derived colours, the
/// shapes, and the motion from DESIGN.md.
enum Theme {
    /// A colour with a light and a dark value.
    static func dynamic(_ light: OKLCH, _ dark: OKLCH) -> Color {
        Color(
            nsColor: NSColor(name: nil) { appearance in
                let isDark = appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
                return (isDark ? dark : light).nsColor
            })
    }

    // MARK: Colours

    /// The page as a plain white / near-black, for the thumbnail's paper.
    static let paper = dynamic(oklch(1, 0, 0), oklch(0.96, 0.002, 80))

    /// `foreground/[0.05]` and friends: the foreground at an alpha.
    static func fg(_ opacity: Double) -> Color { foreground.opacity(opacity) }

    // Surface edge (`shadow-surface`): a 1px inset hairline and two shadows.
    static let hairline = dynamic(oklch(0.22, 0.004, 70, alpha: 0.06), oklch(0.96, 0.003, 80, alpha: 0.09))
    static let shadowSoft = dynamic(oklch(0, 0, 0, alpha: 0.04), oklch(0, 0, 0, alpha: 0.2))
    static let shadowAmbient = dynamic(oklch(0, 0, 0, alpha: 0.1), oklch(0, 0, 0, alpha: 0.4))

    // MARK: Shape and density

    static let menuRowHeight: CGFloat = 24

    static var controlShape: RoundedRectangle {
        RoundedRectangle(cornerRadius: radiusControl, style: .continuous)
    }
    static var surfaceShape: RoundedRectangle {
        RoundedRectangle(cornerRadius: radiusSurface, style: .continuous)
    }
    static func shape(_ radius: CGFloat) -> RoundedRectangle {
        RoundedRectangle(cornerRadius: radius, style: .continuous)
    }

    // MARK: Motion (ease-out quint)

    static let stateMotion = Animation.timingCurve(0.22, 1, 0.36, 1, duration: 0.15)
    static let layoutMotion = Animation.timingCurve(0.22, 1, 0.36, 1, duration: 0.25)
}

extension View {
    /// `shadow-surface`: the opaque surface's edge.
    func surfaceEdge(radius: CGFloat = Theme.radiusSurface) -> some View {
        self
            .overlay(Theme.shape(radius).strokeBorder(Theme.hairline, lineWidth: 1))
            .shadow(color: Theme.shadowSoft, radius: 1, y: 1)
            .shadow(color: Theme.shadowAmbient, radius: 10, y: 6)
    }

    /// The frost surface: Liquid Glass with a wash of the surface colour.
    func frost(radius: CGFloat = Theme.radiusSurface) -> some View {
        glassEffect(.regular.tint(Theme.surface.opacity(0.5)), in: Theme.shape(radius))
    }

    /// Liquid Glass only when `enabled`, so a variant can opt in.
    @ViewBuilder
    func glassEffect(_ glass: Glass, in shape: some Shape, when enabled: Bool) -> some View {
        if enabled {
            glassEffect(glass, in: shape)
        } else {
            self
        }
    }

    /// `depth-button` / `depth-button-primary`: the button's shadow.
    func depthButton(primary: Bool = false) -> some View {
        shadow(color: .black.opacity(primary ? 0.12 : 0.06), radius: 1, y: 1)
    }
}
