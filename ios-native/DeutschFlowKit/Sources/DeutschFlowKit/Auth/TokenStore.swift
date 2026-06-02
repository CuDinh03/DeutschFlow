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
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        // Refresh contract (backend RefreshRequest + AuthResponse): body { "refreshToken": "..." } → full
        // AuthResponse with the rotated tokens. We only persist the tokens here; the profile fields belong
        // to AppSession and are refreshed via /api/auth/me when needed.
        guard let body = try? JSONEncoder().encode(RefreshRequest(refreshToken: refreshToken)) else { return false }
        request.httpBody = body

        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                return false
            }
            let auth = try JSONDecoder().decode(AuthResponse.self, from: data)
            storage.set(auth.accessToken, for: Keys.access)
            storage.set(auth.refreshToken, for: Keys.refresh)
            return true
        } catch {
            return false
        }
    }

    /// Persists the tokens from a fresh ``AuthResponse``. Convenience over ``setTokens(_:)``.
    public func adopt(_ auth: AuthResponse) {
        storage.set(auth.accessToken, for: Keys.access)
        storage.set(auth.refreshToken, for: Keys.refresh)
    }
}
