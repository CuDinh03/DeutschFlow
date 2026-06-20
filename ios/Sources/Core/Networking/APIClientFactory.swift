import Foundation
import OpenAPIRuntime
import OpenAPIURLSession

/// Builds the generated OpenAPI `Client` (URLSession transport + auth middleware).
///
/// ⚠️ **Compiles only AFTER swift-openapi-generator runs** — it produces the `Client` type from the
/// pinned spec. Setup: `curl <backend>/v3/api-docs/ios -o ios/openapi/openapi.json` then build.
/// Until then this file will not type-check (the `Client` symbol is generated).
enum APIClientFactory {
    static func make(
        environment: AppEnvironment = .current,
        tokenStore: TokenStore = .shared,
        onAuthFailure: @escaping @Sendable () async -> Void = {}
    ) -> Client {
        Client(
            serverURL: environment.baseURL,
            transport: URLSessionTransport(),
            middlewares: [
                AuthenticationMiddleware(
                    tokenStore: tokenStore,
                    // TODO(Phase 1): real refresh = raw URLSession POST /api/auth/refresh
                    // (raw, not through the generated client, to avoid recursive middleware).
                    refresh: { _ in nil },
                    onAuthFailure: onAuthFailure
                )
            ]
        )
    }
}
