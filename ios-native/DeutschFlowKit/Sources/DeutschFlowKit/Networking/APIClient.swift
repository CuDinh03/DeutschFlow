import Foundation

/// Supplies bearer tokens to ``APIClient`` and knows how to refresh them. Implemented by ``TokenStore``.
public protocol TokenProviding: Sendable {
    func accessToken() async -> String?
    /// Attempts a token refresh. Returns `true` if a fresh access token is now available.
    func refresh() async -> Bool
    func clear() async
}

/// Minimal async JSON client over `URLSession`. Attaches the bearer token, and on a `401` performs a single
/// token refresh + retry before surfacing ``APIError/unauthorized``. The backend is a stateless JWT REST API,
/// so this is all the client needs to talk to every `/api/*` endpoint.
public final class APIClient: @unchecked Sendable {

    private let baseURL: URL
    private let session: URLSession
    private let tokenProvider: TokenProviding?

    public init(baseURL: URL, session: URLSession = .shared, tokenProvider: TokenProviding? = nil) {
        self.baseURL = baseURL
        self.session = session
        self.tokenProvider = tokenProvider
    }

    public func get<T: Decodable>(_ path: String, authorized: Bool = true) async throws -> T {
        let data = try await send(path: path, method: "GET", authorized: authorized)
        return try decode(data)
    }

    public func post<B: Encodable, T: Decodable>(_ path: String, body: B, authorized: Bool = true) async throws -> T {
        let data = try await send(path: path, method: "POST", body: try JSONEncoder().encode(body), authorized: authorized)
        return try decode(data)
    }

    /// POST whose response may be empty (HTTP 204) — returns `nil` in that case.
    public func postOptional<B: Encodable, T: Decodable>(_ path: String, body: B, authorized: Bool = true) async throws -> T? {
        let data = try await send(path: path, method: "POST", body: try JSONEncoder().encode(body), authorized: authorized)
        return data.isEmpty ? nil : try decode(data)
    }

    private func decode<T: Decodable>(_ data: Data) throws -> T {
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decoding(String(describing: error))
        }
    }

    private func send(path: String, method: String, body: Data? = nil, authorized: Bool, isRetry: Bool = false) async throws -> Data {
        guard let url = URL(string: path, relativeTo: baseURL) else { throw APIError.invalidURL }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if authorized, let token = await tokenProvider?.accessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.transport(error.localizedDescription)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.transport("Non-HTTP response")
        }

        switch http.statusCode {
        case 200...299:
            return data
        case 401:
            if authorized, !isRetry, let provider = tokenProvider, await provider.refresh() {
                return try await send(path: path, method: method, body: body, authorized: authorized, isRetry: true)
            }
            throw APIError.unauthorized
        default:
            throw APIError.http(status: http.statusCode, body: String(data: data, encoding: .utf8))
        }
    }
}
