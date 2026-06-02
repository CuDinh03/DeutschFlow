import Foundation

/// One purchasable product — `GET /api/payments/apple/products`.
public struct AppleProductInfo: Codable, Sendable, Equatable {
    public let productId: String
    public let planCode: String
    public let durationMonths: Int
}

/// Per-user appAccountToken — `GET /api/payments/apple/account-token`. Attached at purchase so App Store
/// Server Notifications V2 can be correlated back to this user (and to block cross-account JWS replay).
public struct AppleAccountToken: Codable, Sendable, Equatable {
    public let appAccountToken: String
}

/// Result of `/api/payments/apple/verify` and `/sync` (backend `AppleActivationResult`).
public struct AppleActivationResult: Codable, Sendable, Equatable {
    public let planCode: String
    public let endsAt: String?

    public init(planCode: String, endsAt: String?) {
        self.planCode = planCode
        self.endsAt = endsAt
    }
}
