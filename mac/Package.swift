// swift-tools-version: 6.2
import PackageDescription

// The native macOS app. There is no Xcode project: `bun run mac build` runs
// `swift build` and assembles a runnable .app bundle (see scripts/bundle.sh),
// so everything is plain text and drivable from the terminal.
let package = Package(
    name: "ReadingList",
    platforms: [.macOS(.v26)],
    dependencies: [
        // Auth and Realtime against the Supabase project.
        .package(url: "https://github.com/supabase/supabase-swift.git", from: "2.0.0"),
        // The HTTP API client, generated at build time from openapi.json.
        .package(url: "https://github.com/apple/swift-openapi-generator", from: "1.0.0"),
        .package(url: "https://github.com/apple/swift-openapi-runtime", from: "1.0.0"),
        .package(url: "https://github.com/apple/swift-openapi-urlsession", from: "1.0.0"),
        .package(url: "https://github.com/apple/swift-http-types", from: "1.0.0"),
    ],
    targets: [
        // The web app's API: `openapi.json` is written by `bun run gen:openapi`
        // from lib/api/contract.ts, and the generator plugin turns it into
        // `Client` + `Components`/`Operations` types on every build.
        .target(
            name: "ReadingListAPI",
            dependencies: [
                .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime"),
                .product(name: "OpenAPIURLSession", package: "swift-openapi-urlsession"),
                .product(name: "HTTPTypes", package: "swift-http-types"),
            ],
            path: "Sources/ReadingListAPI",
            plugins: [
                .plugin(name: "OpenAPIGenerator", package: "swift-openapi-generator")
            ]
        ),
        .executableTarget(
            name: "ReadingList",
            dependencies: [
                "ReadingListAPI",
                .product(name: "Supabase", package: "supabase-swift"),
            ],
            path: "Sources/ReadingList",
            resources: [.copy("Resources")]
        ),
        // `swift test`: the pure parts of the data layer, chiefly that the
        // scheduler agrees with the server's (lib/srs.ts).
        .testTarget(
            name: "ReadingListTests",
            dependencies: ["ReadingList"],
            path: "Tests/ReadingListTests",
            resources: [.copy("Fixtures")]
        ),
    ]
)
