import Foundation

/// Client surface of the Apple IAP backend endpoints used by ``StoreKitManager``, plus the canonical plan read.
public protocol PaymentsAPI: Sendable {
    func appleAccountToken() async throws -> UUID
    func appleProducts() async throws -> [AppleProductInfo]
    func appleVerify(jws: String) async throws -> AppleActivationResult
    func appleSync(jwsList: [String]) async throws -> AppleActivationResult?
    func currentPlan() async throws -> MyPlan
}

/// Default implementation backed by ``APIClient``.
public struct DeutschFlowPaymentsAPI: PaymentsAPI {

    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    public func appleAccountToken() async throws -> UUID {
        let response: AppleAccountToken = try await client.get("/api/payments/apple/account-token")
        guard let uuid = UUID(uuidString: response.appAccountToken) else {
            throw APIError.decoding("Invalid appAccountToken: \(response.appAccountToken)")
        }
        return uuid
    }

    public func appleProducts() async throws -> [AppleProductInfo] {
        try await client.get("/api/payments/apple/products")
    }

    public func appleVerify(jws: String) async throws -> AppleActivationResult {
        try await client.post("/api/payments/apple/verify", body: ["jws": jws])
    }

    public func appleSync(jwsList: [String]) async throws -> AppleActivationResult? {
        try await client.postOptional("/api/payments/apple/sync", body: ["jws": jwsList])
    }

    public func currentPlan() async throws -> MyPlan {
        try await client.get("/api/auth/me/plan")
    }
}
