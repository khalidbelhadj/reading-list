import Foundation

/// The SwiftPM resource bundle (fonts, icons). `scripts/bundle.sh` copies it
/// into the app's Contents/Resources; `swift run` finds it beside the binary.
enum Resources {
    static let bundle: Bundle = {
        if let url = Bundle.main.url(forResource: "ReadingList_ReadingList", withExtension: "bundle"),
            let bundle = Bundle(url: url)
        {
            return bundle
        }
        return Bundle.module
    }()

    static func url(_ name: String, extension fileExtension: String, subdirectory: String) -> URL? {
        bundle.url(
            forResource: name,
            withExtension: fileExtension,
            subdirectory: "Resources/\(subdirectory)"
        )
    }
}
