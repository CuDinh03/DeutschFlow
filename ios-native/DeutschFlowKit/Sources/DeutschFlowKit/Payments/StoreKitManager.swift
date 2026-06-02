import Foundation
import StoreKit

/// Drives StoreKit 2 purchases and hands the signed transactions to the backend for verification.
///
/// The server entitlement (`GET /api/auth/me/plan`) stays the source of truth — never gate features on local
/// StoreKit state. The golden rule: `transaction.finish()` runs only AFTER the server confirms activation, so a
/// server failure leaves the transaction unfinished and StoreKit replays it via `Transaction.updates`.
public final class StoreKitManager {

    private let payments: PaymentsAPI
    private var updatesTask: Task<Void, Never>?

    public init(payments: PaymentsAPI) {
        self.payments = payments
    }

    deinit {
        updatesTask?.cancel()
    }

    /// Load products for the paywall and start listening for transaction updates (renewals, Ask-to-Buy, etc.).
    public func start(productIDs: [String]) async -> [Product] {
        listenForTransactions()
        return (try? await Product.products(for: productIDs)) ?? []
    }

    /// Purchase a product, binding it to this account via the server-issued appAccountToken.
    @discardableResult
    public func purchase(_ product: Product) async throws -> AppleActivationResult? {
        let token = try await payments.appleAccountToken()
        let result = try await product.purchase(options: [.appAccountToken(token)])
        switch result {
        case .success(let verification):
            return try await Self.deliver(verification, payments: payments)
        case .pending, .userCancelled:
            return nil
        @unknown default:
            return nil
        }
    }

    /// Restore purchases: re-sync every current entitlement with the backend.
    @discardableResult
    public func restore() async throws -> AppleActivationResult? {
        try await AppStore.sync()
        var jwsList: [String] = []
        for await entitlement in Transaction.currentEntitlements {
            jwsList.append(entitlement.jwsRepresentation)
        }
        return try await payments.appleSync(jwsList: jwsList)
    }

    private func listenForTransactions() {
        guard updatesTask == nil else { return }
        updatesTask = Task { [payments] in
            for await update in Transaction.updates {
                _ = try? await Self.deliver(update, payments: payments)
            }
        }
    }

    @discardableResult
    private static func deliver(_ verification: VerificationResult<Transaction>,
                                payments: PaymentsAPI) async throws -> AppleActivationResult? {
        guard case .verified(let transaction) = verification else { return nil } // ignore unverified
        let result = try await payments.appleVerify(jws: verification.jwsRepresentation)
        await transaction.finish()
        return result
    }
}
