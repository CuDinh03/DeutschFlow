import Foundation

/// Access + refresh token pair returned by `/api/auth/login` and `/api/auth/refresh`.
/// NOTE: confirm exact field names against the backend AuthController when wiring Phase 1.
public struct AuthTokens: Codable, Sendable, Equatable {
    public let accessToken: String
    public let refreshToken: String

    public init(accessToken: String, refreshToken: String) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
    }
}

public struct LoginRequest: Codable, Sendable {
    public let email: String
    public let password: String

    public init(email: String, password: String) {
        self.email = email
        self.password = password
    }
}

/// Mirrors backend `MyPlanResponse` (`GET /api/auth/me/plan`). The provider-agnostic source of truth for the
/// user's tier — read this after any purchase rather than trusting local StoreKit state. Timestamps are kept
/// as ISO-8601 strings to avoid date-decoding pitfalls; parse in the UI layer if needed.
public struct MyPlan: Codable, Sendable, Equatable {
    public let planCode: String
    public let tier: String
    public let startsAtUtc: String?
    public let endsAtUtc: String?

    public init(planCode: String, tier: String, startsAtUtc: String?, endsAtUtc: String?) {
        self.planCode = planCode
        self.tier = tier
        self.startsAtUtc = startsAtUtc
        self.endsAtUtc = endsAtUtc
    }
}
