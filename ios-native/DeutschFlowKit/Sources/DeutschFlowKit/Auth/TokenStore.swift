import Foundation

/// Owns the user's access + refresh tokens. An `actor` so concurrent requests can't race a refresh.
/// Performs the refresh call directly (not via ``APIClient``) to avoid a dependency cycle, since APIClient
/// depends on ``TokenProviding``.
public actor TokenStore: TokenProviding {

    private enum Keys {
        static let access = "deutschflow.accessToken"
        static let refresh = "deutschflow.refreshToken"
    }

    private let baseURL: URL
    private let session: URLSession
    private let storage: SecureStorage

    public init(baseURL: URL, session: URLSession = .shared, storage: SecureStorage) {
        self.baseURL = baseURL
        self.session = session
        self.storage = storage
    }

    public func setTokens(_ tokens: AuthTokens) {
        storage.set(tokens.accessToken, for: Keys.access)
        storage.set(tokens.refreshToken, for: Keys.refresh)
    }

    public var isLoggedIn: Bool {
        storage.get(Keys.access) != nil
    }

    public func accessToken() async -> String? {
        storage.get(Keys.access)
    }

    public func clear() async {
        storage.remove(Keys.access)
        storage.remove(Keys.refresh)
    }

    public func refresh() async -> Bool {
        guard let refreshToken = storage.get(Keys.refresh),
              let url = URL(string: "/api/auth/refresh", relativeTo: baseURL) else {
            return false
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // NOTE: confirm request/response shape against backend /api/auth/refresh when wiring Phase 1.
        guard let body = try? JSONEncoder().encode(["refreshToken": refreshToken]) else { return false }
        request.httpBody = body

        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                return false
            }
            let tokens = try JSONDecoder().decode(AuthTokens.self, from: data)
            storage.set(tokens.accessToken, for: Keys.access)
            storage.set(tokens.refreshToken, for: Keys.refresh)
            return true
        } catch {
            return false
        }
    }
}
