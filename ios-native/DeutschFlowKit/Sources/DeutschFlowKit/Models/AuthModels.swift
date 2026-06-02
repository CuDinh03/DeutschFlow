import Foundation

/// Body of `POST /api/auth/login`. Mirrors backend `LoginRequest`.
public struct LoginRequest: Codable, Sendable {
    public let email: String
    public let password: String

    public init(email: String, password: String) {
        self.email = email
        self.password = password
    }
}

/// Body of `POST /api/auth/refresh`. The backend also accepts the refresh token from an HttpOnly cookie;
/// the body field is the fallback we use from a native client.
public struct RefreshRequest: Codable, Sendable {
    public let refreshToken: String

    public init(refreshToken: String) { self.refreshToken = refreshToken }
}

/// Body of `POST /api/auth/register`. Phone number validates against backend pattern
/// `^0[35789]\d{8}$`; locale ∈ {vi, en, de} or nil.
public struct RegisterRequest: Codable, Sendable {
    public let email: String
    public let phoneNumber: String
    public let password: String
    public let displayName: String
    public let locale: String?
}

/// Success response for all `/api/auth/*` endpoints — mirrors backend `AuthResponse`. Carries both the
/// token pair (consumed by ``TokenStore``) and a starter user profile (consumed by the UI), so the app can
/// show the user's name + role immediately after login without an extra round-trip.
public struct AuthResponse: Codable, Sendable, Equatable {
    public let accessToken: String
    public let refreshToken: String
    public let userId: Int64
    public let email: String
    public let displayName: String
    public let role: String
    public let locale: String
    public let learningTargetLevel: String?
    public let industry: String?

    public init(accessToken: String, refreshToken: String, userId: Int64, email: String,
                displayName: String, role: String, locale: String,
                learningTargetLevel: String?, industry: String?) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.userId = userId
        self.email = email
        self.displayName = displayName
        self.role = role
        self.locale = locale
        self.learningTargetLevel = learningTargetLevel
        self.industry = industry
    }

    /// Token pair view consumed by ``TokenStore``.
    public var tokens: AuthTokens {
        AuthTokens(accessToken: accessToken, refreshToken: refreshToken)
    }

    /// User-facing profile view derived from the same response.
    public var profile: UserProfile {
        UserProfile(userId: userId, email: email, displayName: displayName, role: role, locale: locale,
                    learningTargetLevel: learningTargetLevel, industry: industry)
    }
}

/// Token pair lifted from ``AuthResponse`` — what ``TokenStore`` persists.
public struct AuthTokens: Sendable, Equatable {
    public let accessToken: String
    public let refreshToken: String

    public init(accessToken: String, refreshToken: String) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
    }
}

/// User profile lifted from ``AuthResponse``. Shown in the UI; not used for authentication.
public struct UserProfile: Sendable, Equatable {
    public let userId: Int64
    public let email: String
    public let displayName: String
    public let role: String
    public let locale: String
    public let learningTargetLevel: String?
    public let industry: String?
}

/// Mirrors backend `MyPlanResponse` (`GET /api/auth/me/plan`). The provider-agnostic source of truth for
/// the user's tier — read this after any purchase rather than trusting local StoreKit state.
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
