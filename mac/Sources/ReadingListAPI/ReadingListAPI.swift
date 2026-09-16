import Foundation
import HTTPTypes
import OpenAPIRuntime
import OpenAPIURLSession

// The web app's HTTP API. `Client`, `Components` and `Operations` are
// generated at build time from openapi.json (itself generated from
// lib/api/contract.ts by `bun run gen:openapi`); this file adds the pieces
// the document can't express: the bearer token and the sync origin.

/// A non-2xx reply, with the server's message.
public struct APIFailure: Error, LocalizedError, Sendable {
    public let message: String
    public let status: Int

    public init(message: String, status: Int) {
        self.message = message
        self.status = status
    }

    /// From a route's `default` response: the server's `{ error }` body when
    /// it is JSON, a generic line otherwise.
    public init(status: Int, error: () throws -> Components.Schemas.ErrorResponse) {
        self.status = status
        self.message = (try? error().error) ?? (status == 401 ? "Unauthorized" : "The server did not respond.")
    }

    public var errorDescription: String? { message }
}

/// What to tell someone about a failed call: the underlying failure's own
/// words first (a refused connection, a timeout, the server's message), and
/// the client's full account of the request as the detail.
public struct ErrorSummary: Sendable {
    public let message: String
    public let detail: String?

    public init(_ error: any Error) {
        if let client = error as? ClientError {
            message = client.underlyingError.localizedDescription
            detail = client.localizedDescription
        } else if let failure = error as? APIFailure {
            message = failure.message
            detail = nil
        } else {
            message = error.localizedDescription
            detail = nil
        }
    }
}

/// Signs every request with a fresh Supabase access token and stamps it with
/// this client's sync origin, so its own Realtime echo can be ignored.
public struct AuthMiddleware: ClientMiddleware {
    let accessToken: @Sendable () async throws -> String
    let syncOrigin: String

    public init(accessToken: @escaping @Sendable () async throws -> String, syncOrigin: String) {
        self.accessToken = accessToken
        self.syncOrigin = syncOrigin
    }

    public func intercept(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID: String,
        next: @Sendable (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
    ) async throws -> (HTTPResponse, HTTPBody?) {
        var request = request
        request.headerFields[.authorization] = "Bearer \(try await accessToken())"
        request.headerFields[.cookie] = "sync-origin=\(syncOrigin)"
        return try await next(request, body, baseURL)
    }
}

extension Client {
    /// A client for the web app at `base` (its origin, e.g. http://localhost:3000).
    public static func readingList(
        base: URL,
        accessToken: @escaping @Sendable () async throws -> String,
        syncOrigin: String
    ) -> Client {
        // The document's paths are absolute (/api/items), so the server url
        // must be the bare origin.
        var origin = base.absoluteString
        while origin.hasSuffix("/") { origin.removeLast() }
        return Client(
            serverURL: URL(string: origin) ?? base,
            transport: URLSessionTransport(),
            middlewares: [AuthMiddleware(accessToken: accessToken, syncOrigin: syncOrigin)]
        )
    }
}
