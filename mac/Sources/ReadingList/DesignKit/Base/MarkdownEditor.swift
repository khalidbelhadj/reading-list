import SwiftUI
import WebKit

/// The markdown editor: the web shell's tiptap editor (headings, lists,
/// code blocks with highlighting, inline and block math, links, cards,
/// images, the bubble menu) hosted in a web view, from the page
/// `bun run build:editor` bundles into the app's resources. Markdown in,
/// markdown out; the view sizes itself to its content.
struct MarkdownEditor: View {
    @Binding var text: String
    var placeholder = ""
    var editable = true
    var toolbar = false
    /// Uploads a pasted or dropped image and returns the url to embed;
    /// without it, images cannot be inserted.
    var onUploadImage: ((_ data: Data, _ contentType: String) async throws -> String)?
    /// The web view's accessibility identifier. Set here rather than on the
    /// whole view, so it names the editor and not the bubble too.
    var identifier: String?
    @State private var height: CGFloat = 80
    @State private var bridge = EditorBridge()
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        EditorWebView(
            text: $text, placeholder: placeholder, editable: editable, toolbar: toolbar,
            dark: colorScheme == .dark, onUploadImage: onUploadImage, height: $height, bridge: bridge
        )
        .frame(height: max(height, 40))
        .accessibilityIdentifier(identifier ?? "")
        // The kit's glass bubble over the page's selection, in place of the
        // page's own: the page reports where the selection is and what is
        // applied, the bubble runs actions back in it.
        .overlay(alignment: .topLeading) {
            GeometryReader { geometry in
                if let selection = bridge.selection {
                    FormatBubble(state: selection.state) { key, argument in bridge.run(key, argument) }
                        .position(bubblePosition(for: selection.cgRect, in: geometry.size))
                }
            }
        }
    }

    private func bubblePosition(for rect: CGRect, in size: CGSize) -> CGPoint {
        let width: CGFloat = 340
        let x = min(max(rect.midX, width / 2 + 8), max(size.width - width / 2 - 8, width / 2 + 8))
        let y = max(rect.minY - 26, 20)
        return CGPoint(x: x, y: y)
    }
}

/// What the page and the bubble share: the current selection, and the way
/// back into the page.
@MainActor
@Observable
final class EditorBridge {
    var selection: EditorSelection?
    var run: (_ key: String, _ argument: String?) -> Void = { _, _ in }
}

struct EditorSelection: Decodable {
    struct Rect: Decodable {
        let x: Double
        let y: Double
        let width: Double
        let height: Double
    }

    let rect: Rect
    let state: FormatState

    var cgRect: CGRect { CGRect(x: rect.x, y: rect.y, width: rect.width, height: rect.height) }
}

extension EditorSelection {
    fileprivate init?(message body: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: body),
            let decoded = try? JSONDecoder().decode(Wire.self, from: data), let rect = decoded.rect,
            let state = decoded.state
        else { return nil }
        self.init(rect: rect, state: state)
    }

    private struct Wire: Decodable {
        let rect: Rect?
        let state: FormatState?
    }
}

private struct EditorWebView: NSViewRepresentable {
    @Binding var text: String
    let placeholder: String
    let editable: Bool
    let toolbar: Bool
    let dark: Bool
    let onUploadImage: ((Data, String) async throws -> String)?
    @Binding var height: CGFloat
    let bridge: EditorBridge

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(context.coordinator, name: "editor")
        // The page is served from the bundle over its own scheme: module
        // scripts are cross-origin from a file url and never load.
        configuration.setURLSchemeHandler(EditorPageHandler(), forURLScheme: EditorPageHandler.scheme)
        let webView = WKWebView(frame: .zero, configuration: configuration)
        // The app paints the background; the page is transparent.
        webView.setValue(false, forKey: "drawsBackground")
        webView.navigationDelegate = context.coordinator
        #if DEBUG
            webView.isInspectable = true
        #endif
        webView.load(URLRequest(url: EditorPageHandler.indexURL))
        context.coordinator.webView = webView
        bridge.run = { [weak coordinator = context.coordinator] key, argument in
            coordinator?.call("run", key, argument ?? NSNull())
        }
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        context.coordinator.parent = self
        context.coordinator.push()
    }

    static func dismantleNSView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "editor")
    }

    /// The bridge: props go in as calls on `window.editorHost`, the page
    /// reports back through the `editor` message handler.
    @MainActor
    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        var parent: EditorWebView
        weak var webView: WKWebView?
        private var ready = false
        /// What the page holds, so an echo of its own change is not pushed
        /// back and a caret is never disturbed.
        private var pageText: String?
        private var sent: (placeholder: String, editable: Bool, toolbar: Bool, dark: Bool)?

        init(_ parent: EditorWebView) {
            self.parent = parent
        }

        func push() {
            guard ready else { return }
            if parent.text != pageText {
                pageText = parent.text
                call("setValue", parent.text)
            }
            let next = (parent.placeholder, parent.editable, parent.toolbar, parent.dark)
            if sent?.placeholder != next.0 { call("setPlaceholder", next.0) }
            if sent?.editable != next.1 { call("setEditable", next.1) }
            if sent?.toolbar != next.2 { call("setToolbar", next.2) }
            if sent?.dark != next.3 { call("setTheme", next.3) }
            sent = next
        }

        func call(_ function: String, _ arguments: Any...) {
            guard let webView, let data = try? JSONSerialization.data(withJSONObject: arguments),
                let json = String(data: data, encoding: .utf8)
            else { return }
            webView.evaluateJavaScript("window.editorHost.\(function)(...\(json))") { _, _ in }
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            print("[editor] content process terminated")
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) {
            print("[editor] navigation failed: \(error.localizedDescription)")
        }

        func webView(
            _ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error
        ) {
            print("[editor] load failed: \(error.localizedDescription)")
        }

        nonisolated func userContentController(
            _ controller: WKUserContentController, didReceive message: WKScriptMessage
        ) {
            MainActor.assumeIsolated {
                guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
                switch type {
                case "ready":
                    ready = true
                    sent = nil
                    pageText = nil
                    push()
                case "change":
                    guard let value = body["value"] as? String else { return }
                    pageText = value
                    if parent.text != value { parent.text = value }
                case "height":
                    if let value = body["value"] as? Double { parent.height = value }
                case "selection":
                    parent.bridge.selection = EditorSelection(message: body)
                case "upload":
                    upload(body)
                case "error":
                    print("[editor] page error: \(body["message"] as? String ?? "?")")
                default:
                    break
                }
            }
        }

        private func upload(_ body: [String: Any]) {
            guard let id = body["id"] as? String else { return }
            guard let handler = parent.onUploadImage, let base64 = body["data"] as? String,
                let data = Data(base64Encoded: base64)
            else {
                call("resolveUpload", id, NSNull(), "Image upload is not available here.")
                return
            }
            let contentType = body["contentType"] as? String ?? "application/octet-stream"
            Task { [weak self] in
                do {
                    let src = try await handler(data, contentType)
                    self?.call("resolveUpload", id, src)
                } catch {
                    self?.call("resolveUpload", id, NSNull(), error.localizedDescription)
                }
            }
        }
    }
}

/// Serves the bundled editor page (Resources/Editor) at
/// `editor://page/…`, so it has an origin of its own.
private final class EditorPageHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "editor"
    static let indexURL = URL(string: "editor://page/index.html")!

    private static let mimeTypes: [String: String] = [
        "html": "text/html", "js": "text/javascript", "css": "text/css", "json": "application/json",
        "svg": "image/svg+xml", "png": "image/png", "woff2": "font/woff2", "woff": "font/woff", "ttf": "font/ttf",
    ]

    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        let path = url.path.hasPrefix("/") ? String(url.path.dropFirst()) : url.path
        let name = (path as NSString).deletingPathExtension
        let fileExtension = (path as NSString).pathExtension
        let subdirectory =
            "Editor"
            + ((name as NSString).deletingLastPathComponent.isEmpty
                ? "" : "/" + (name as NSString).deletingLastPathComponent)
        guard
            let file = Resources.url(
                (name as NSString).lastPathComponent, extension: fileExtension, subdirectory: subdirectory),
            let data = try? Data(contentsOf: file)
        else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        let response = HTTPURLResponse(
            url: url, statusCode: 200, httpVersion: "HTTP/1.1",
            headerFields: [
                "Content-Type": Self.mimeTypes[fileExtension] ?? "application/octet-stream",
                "Content-Length": String(data.count),
            ]
        )!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {}
}

// MARK: - Demo

private let editorSample = """
    # Notes

    Text with **bold**, *italic*, `code`, a [link](https://example.com), and inline math $e^{i\\pi} + 1 = 0$.

    - A list
    - With items
      - Nested

    - [ ] A task
    - [x] Done

    > A quote.

    ```swift
    let x = 42
    print("hello \\(x)")
    ```

    $$
    \\int_0^1 x^2\\,dx = \\frac{1}{3}
    $$

    <card id="demo1234">
    <front>
    What does the MESI protocol's **E (Exclusive)** state guarantee?
    </front>
    <back>
    The line is present only in this cache and matches memory.
    </back>
    </card>
    """

private struct MarkdownEditorDemo: View {
    @State private var text = editorSample

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            MarkdownEditor(text: $text, placeholder: "Write something…", toolbar: true)
                .frame(width: 576)
            Text("\(text.count) characters of markdown")
                .textStyle(.small)
                .foregroundStyle(Theme.mutedForeground)
        }
    }
}

extension Demo {
    static let markdownEditor = Demo(
        "Markdown editor",
        description:
            "The web shell's editor, hosted: headings, lists, checklists, quotes, code blocks with highlighting, inline and block math (KaTeX), links, cards, images, the toolbar, and the bubble over a selection. Markdown in, markdown out."
    ) {
        MarkdownEditorDemo()
    }
}
