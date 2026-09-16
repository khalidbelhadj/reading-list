import AppKit
import CoreText
import SwiftUI

/// DM Sans for everything, DM Mono for code (DESIGN.md: one family). The
/// variable TTFs live in Resources/Fonts and are registered at launch;
/// weight and optical size are set through the font's variation axes, the
/// way the browser does for `font-variation-settings`.
enum Typography {
    enum Weight {
        case regular, medium, semibold, bold

        var value: Double {
            switch self {
            case .regular: 400
            case .medium: 500
            case .semibold: 600
            case .bold: 700
            }
        }
    }

    private static let sansName = "DMSans-9ptRegular"
    private static let sansItalicName = "DMSans-9ptItalic"
    private static let monoName = "DMMono-Regular"
    private static let monoMediumName = "DMMono-Medium"
    private static let weightAxis: UInt32 = 0x7767_6874  // 'wght'
    private static let opticalSizeAxis: UInt32 = 0x6F70_737A  // 'opsz'
    private static let files = ["DMSans-Variable", "DMSans-Italic-Variable", "DMMono-Regular", "DMMono-Medium"]

    static func register() {
        for file in files {
            guard let url = Resources.url(file, extension: "ttf", subdirectory: "Fonts") else {
                print("[fonts] missing \(file).ttf")
                continue
            }
            var error: Unmanaged<CFError>?
            if !CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error) {
                print("[fonts] could not register \(file): \(String(describing: error?.takeRetainedValue()))")
            }
        }
    }

    static func sansFont(size: CGFloat, weight: Weight = .regular, italic: Bool = false) -> NSFont {
        let descriptor = NSFontDescriptor(fontAttributes: [
            .name: italic ? sansItalicName : sansName,
            .variation: [
                NSNumber(value: weightAxis): NSNumber(value: weight.value),
                NSNumber(value: opticalSizeAxis): NSNumber(value: Double(min(max(size, 9), 40))),
            ],
        ])
        return NSFont(descriptor: descriptor, size: size) ?? .systemFont(ofSize: size)
    }

    static func monoFont(size: CGFloat, weight: Weight = .regular) -> NSFont {
        NSFont(name: weight == .regular ? monoName : monoMediumName, size: size)
            ?? .monospacedSystemFont(ofSize: size, weight: .regular)
    }

    static func sans(_ size: CGFloat, _ weight: Weight = .regular, italic: Bool = false) -> Font {
        Font(sansFont(size: size, weight: weight, italic: italic))
    }

    static func mono(_ size: CGFloat, _ weight: Weight = .regular) -> Font {
        Font(monoFont(size: size, weight: weight))
    }
}

/// The six type styles: micro 11, small 12, body 13, title 15, heading 20,
/// display 28, with their line heights.
enum TextStyle {
    case micro, small, body, title, heading, display

    var size: CGFloat {
        switch self {
        case .micro: 11
        case .small: 12
        case .body: 13
        case .title: 15
        case .heading: 20
        case .display: 28
        }
    }

    var lineHeight: CGFloat {
        switch self {
        case .micro: size * 1.3
        case .small: size * 1.35
        case .body: size * 1.4
        case .title: size * 1.3
        case .heading: size * 1.2
        case .display: size * 1.05
        }
    }
}

struct TextStyleModifier: ViewModifier {
    let style: TextStyle
    let weight: Typography.Weight

    func body(content: Content) -> some View {
        let font = Typography.sansFont(size: style.size, weight: weight)
        let natural = font.ascender - font.descender + font.leading
        return
            content
            .font(Font(font))
            .lineSpacing(max(0, style.lineHeight - natural))
    }
}

extension View {
    func textStyle(_ style: TextStyle, _ weight: Typography.Weight = .regular) -> some View {
        modifier(TextStyleModifier(style: style, weight: weight))
    }
}
