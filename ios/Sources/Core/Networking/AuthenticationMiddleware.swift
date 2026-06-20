import Foundation
import HTTPTypes
import OpenAPIRuntime

/// Adds `Authorization: Bearer <access>` to every request and, on a `401`, refreshes the token once
/// via the injected `refresh` closure and retries. Refresh state is serialized through the
/// `TokenStore` actor so concurrent 401s don't trigger multiple refreshes.
///
/// ⚠️ Caveat: this replays the original `body` on retry. For streamed request bodies (POST/PUT),
/// buffer the body before retrying — harden in Phase 1. `GET /api/auth/me` (the Phase 0 target)
/// has no body, so it's fine now.
struct AuthenticationMiddleware: ClientMiddleware {
    let tokenStore: TokenStore
    /// Returns the renewed tokens, or `nil` if refresh failed (→ caller signs out).
    let refresh: @Sendable (_ refreshToken: String) async throws -> (access: String, refresh: String?)?
    let onAuthFailure: @Sendable () async -> Void

    func intercept(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID: String,
        next: (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
    ) async throws -> (HTTPResponse, HTTPBody?) {
        var authed = request
        if let access = await tokenStore.accessToken {
            authed.headerFields[.authorization] = "Bearer \(access)"
        }

        let (response, responseBody) = try await next(authed, body, baseURL)
        guard response.status == .unauthorized else {
            return (response, responseBody)
        }

        guard let refreshToken = await tokenStore.refreshToken,
              let renewed = try await refresh(refreshToken) else {
            await onAuthFailure()
            return (response, responseBody)
        }

        await tokenStore.save(access: renewed.access, refresh: renewed.refresh)
        var retried = authed
        retried.headerFields[.authorization] = "Bearer \(renewed.access)"
        return try await next(retried, body, baseURL)
    }
}
