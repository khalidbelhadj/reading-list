#if DEBUG
    import AppKit
    import Foundation
    import Network

    /// Dev-only control socket, the SwiftUI counterpart of the Electron app's
    /// CDP listener: newline-delimited JSON on 127.0.0.1 (`RL_DEBUG_PORT`,
    /// default 9400). `scripts/mac.ts` (`bun run mac …`) is the client; see
    /// mac/README.md. Compiled out of release builds.
    ///
    ///   request:  {"id": 1, "cmd": "click", "args": {"x": 120, "y": 64}}
    ///   response: {"id": 1, "ok": true, "result": …}
    ///             {"id": 1, "ok": false, "error": "…"}
    ///
    /// The listener runs on the main queue, so every callback lands on the main
    /// thread and command handlers touch AppKit directly.
    @MainActor
    final class DebugServer {
        static let shared = DebugServer()
        static let defaultPort: UInt16 = 9400

        @MainActor
        private final class Connection {
            let connection: NWConnection
            var buffer = Data()

            init(_ connection: NWConnection) {
                self.connection = connection
            }
        }

        private var listener: NWListener?
        private var connections: [ObjectIdentifier: Connection] = [:]

        private var port: UInt16 {
            let environment = ProcessInfo.processInfo.environment["RL_DEBUG_PORT"]
            return environment.flatMap { UInt16($0) } ?? Self.defaultPort
        }

        func start() {
            let port = self.port
            guard let endpointPort = NWEndpoint.Port(rawValue: port) else {
                print("[debug] invalid port \(port)")
                return
            }
            let parameters = NWParameters.tcp
            parameters.allowLocalEndpointReuse = true
            // Loopback only: never reachable from the network.
            parameters.requiredLocalEndpoint = .hostPort(
                host: .ipv4(.loopback),
                port: endpointPort
            )
            let listener: NWListener
            do {
                listener = try NWListener(using: parameters)
            } catch {
                print("[debug] could not create listener: \(error)")
                return
            }
            listener.stateUpdateHandler = { state in
                MainActor.assumeIsolated {
                    switch state {
                    case .ready:
                        print("[debug] listening on 127.0.0.1:\(port)")
                    case .failed(let error):
                        print("[debug] listener failed: \(error)")
                    default:
                        break
                    }
                }
            }
            listener.newConnectionHandler = { connection in
                MainActor.assumeIsolated {
                    DebugServer.shared.accept(connection)
                }
            }
            listener.start(queue: .main)
            self.listener = listener
        }

        private func accept(_ nwConnection: NWConnection) {
            let connection = Connection(nwConnection)
            let key = ObjectIdentifier(connection)
            connections[key] = connection
            nwConnection.stateUpdateHandler = { state in
                MainActor.assumeIsolated {
                    switch state {
                    case .failed, .cancelled:
                        DebugServer.shared.connections[key] = nil
                    default:
                        break
                    }
                }
            }
            nwConnection.start(queue: .main)
            receive(connection)
        }

        private func receive(_ connection: Connection) {
            connection.connection.receive(
                minimumIncompleteLength: 1,
                maximumLength: 1 << 16
            ) { data, _, isComplete, error in
                MainActor.assumeIsolated {
                    let server = DebugServer.shared
                    if let data {
                        connection.buffer.append(data)
                        server.drain(connection)
                    }
                    if isComplete || error != nil {
                        connection.connection.cancel()
                        return
                    }
                    server.receive(connection)
                }
            }
        }

        private func drain(_ connection: Connection) {
            while let newline = connection.buffer.firstIndex(of: UInt8(ascii: "\n")) {
                let line = Data(connection.buffer[connection.buffer.startIndex..<newline])
                connection.buffer.removeSubrange(connection.buffer.startIndex...newline)
                if line.isEmpty { continue }
                Task { @MainActor in
                    let response = await handle(line)
                    send(response, on: connection)
                }
            }
        }

        private func handle(_ line: Data) async -> [String: Any] {
            var id: Any = NSNull()
            do {
                guard let request = try JSONSerialization.jsonObject(with: line) as? [String: Any]
                else { throw DebugError("request must be a JSON object") }
                id = request["id"] ?? NSNull()
                let result = try await DebugCommands.run(request)
                return ["id": id, "ok": true, "result": result]
            } catch {
                return ["id": id, "ok": false, "error": "\(error.localizedDescription)"]
            }
        }

        private func send(_ object: [String: Any], on connection: Connection) {
            var data =
                (try? JSONSerialization.data(withJSONObject: object))
                ?? Data(#"{"ok":false,"error":"unserialisable response"}"#.utf8)
            data.append(UInt8(ascii: "\n"))
            connection.connection.send(content: data, completion: .contentProcessed { _ in })
        }
    }

    struct DebugError: LocalizedError, CustomStringConvertible {
        let description: String

        init(_ description: String) {
            self.description = description
        }

        var errorDescription: String? { description }
    }
#endif
