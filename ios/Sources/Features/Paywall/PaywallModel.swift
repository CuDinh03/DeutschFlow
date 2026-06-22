import Foundation
import StoreKit

/// StoreKit 2 paywall model (M5.4 scaffold).
///
/// Flow: backend catalog (`GET /api/payments/apple/products` → productId·planCode·durationMonths)
/// ∩ StoreKit `Product`s → `purchase` bound to the user via `appAccountToken`
/// (`GET /api/payments/apple/account-token`) → send the signed JWS to
/// `POST /api/payments/apple/verify` → entitlement (`planCode` + `endsAt`).
/// Restore = `AppStore.sync()` + current entitlements → `POST /api/payments/apple/sync`.
///
/// ⚠️ Apple-gated end-to-end: the 4 IAP products must exist in App Store Connect, and `/verify`
/// validates an Apple-signed JWS. Locally the purchase UI is testable with the bundled
/// `DeutschFlow.storekit` config (StoreKit Testing — no Apple account), but backend activation
/// needs a real signed transaction.
@MainActor
@Observable
final class PaywallModel {
    struct Tier: Identifiable {
        var id: String { product.id }
        let product: Product
        let planCode: String
        let durationMonths: Int
    }

    private(set) var tiers: [Tier] = []
    private(set) var loading = true
    private(set) var purchasingId: String?
    private(set) var restoring = false
    private(set) var activePlanCode: String?
    private(set) var activeUntil: Date?
    var error: String?

    /// Backend catalog ∩ StoreKit products, cheapest first.
    func load() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            let client = APIClientFactory.make()
            var catalog: [String: (plan: String, months: Int)] = [:]
            if case .ok(let ok) = try await client.products(.init()) {
                for p in try ok.body.json {
                    if let pid = p.productId {
                        catalog[pid] = (p.planCode ?? "", Int(p.durationMonths ?? 0))
                    }
                }
            }
            guard !catalog.isEmpty else { return }
            let products = try await Product.products(for: Array(catalog.keys))
            tiers = products
                .compactMap { prod -> Tier? in
                    guard let meta = catalog[prod.id] else { return nil }
                    return Tier(product: prod, planCode: meta.plan, durationMonths: meta.months)
                }
                .sorted { $0.product.price < $1.product.price }
        } catch {
            self.error = "Không tải được gói: \(error.localizedDescription)"
        }
    }

    func purchase(_ tier: Tier) async {
        purchasingId = tier.id
        error = nil
        defer { purchasingId = nil }
        do {
            let client = APIClientFactory.make()
            var options: Set<Product.PurchaseOption> = []
            if case .ok(let ok) = try await client.accountToken(.init()),
               let token = try ok.body.json.appAccountToken,
               let uuid = UUID(uuidString: token) {
                options.insert(.appAccountToken(uuid))
            }
            let result = try await tier.product.purchase(options: options)
            switch result {
            case .success(let verification):
                if case .ok(let ok) = try await client.verify(body: .json(.init(jws: verification.jwsRepresentation))) {
                    let r = try ok.body.json
                    activePlanCode = r.planCode
                    activeUntil = r.endsAt
                }
                if case .verified(let txn) = verification { await txn.finish() }
            case .userCancelled:
                break
            case .pending:
                error = "Giao dịch đang chờ xác nhận."
            @unknown default:
                break
            }
        } catch {
            self.error = "Mua không thành công: \(error.localizedDescription)"
        }
    }

    func restore() async {
        restoring = true
        error = nil
        defer { restoring = false }
        do {
            try await AppStore.sync()
            var jwsList: [String] = []
            for await entitlement in Transaction.currentEntitlements {
                jwsList.append(entitlement.jwsRepresentation)
            }
            guard !jwsList.isEmpty else {
                error = "Không tìm thấy giao dịch để khôi phục."
                return
            }
            let client = APIClientFactory.make()
            if case .ok(let ok) = try await client.sync(body: .json(.init(jws: jwsList))) {
                let r = try ok.body.json
                activePlanCode = r.planCode
                activeUntil = r.endsAt
            }
        } catch {
            self.error = "Khôi phục không thành công: \(error.localizedDescription)"
        }
    }
}
