import Foundation

/// Errors surfaced by the networking layer. UI maps these to user-facing messages.
public enum APIError: Error, Equatable, Sendable {
    case invalidURL
    case unauthorized
    case http(status: Int, body: String?)
    case decoding(String)
    case transport(String)
    case notConfigured
}
