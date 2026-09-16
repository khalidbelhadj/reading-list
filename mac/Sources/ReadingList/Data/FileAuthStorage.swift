import Foundation
import Supabase

/// Session storage in a file under Application Support instead of the
/// Keychain. Every rebuild of the dev app is re-signed ad hoc, and the
/// Keychain treats each as a new app and asks before handing the session
/// over; a file is read without a prompt. The release build should use the
/// SDK's Keychain storage again.
struct FileAuthStorage: AuthLocalStorage {
    let directory: URL

    /// One directory per Supabase project (`scope`, its host), so switching
    /// between the local stack and the hosted project never presents one's
    /// session to the other.
    static func inApplicationSupport(scope: String) -> FileAuthStorage {
        let safeScope = String(scope.map { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "." ? $0 : "_" })
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let directory = base.appending(path: Bundle.main.bundleIdentifier ?? "ReadingList").appending(path: "auth")
            .appending(path: safeScope)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return FileAuthStorage(directory: directory)
    }

    private func url(for key: String) -> URL {
        let safe = key.map { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" ? $0 : "_" }
        return directory.appending(path: String(safe))
    }

    func store(key: String, value: Data) throws {
        try value.write(to: url(for: key), options: [.atomic, .completeFileProtection])
    }

    func retrieve(key: String) throws -> Data? {
        try? Data(contentsOf: url(for: key))
    }

    func remove(key: String) throws {
        try? FileManager.default.removeItem(at: url(for: key))
    }
}
