import SwiftUI
import StoreKit
import DeutschFlowKit

/// Paywall — App Store guideline 3.1.1 requires all in-app subscription purchases to go through StoreKit.
/// Lists products published by the backend catalog (`/api/payments/apple/products`), maps each to its
/// StoreKit `Product`, and drives ``StoreKitManager``. Server entitlement is the source of truth: after a
/// purchase we refetch `/api/auth/me/plan` rather than trusting local StoreKit state.
struct PaywallView: View {
    @EnvironmentObject private var session: AppSession
    @State private var products: [Product] = []
    @State private var purchasing: String?
    @State private var message: String?

    var body: some View {
        NavigationStack {
            List {
                if let plan = session.plan, plan.planCode != "FREE" {
                    Section { Text("Bạn đang dùng gói \(plan.planCode).").foregroundStyle(.green) }
                }
                if products.isEmpty {
                    Section { Text("Đang tải gói…").foregroundStyle(.secondary) }
                }
                ForEach(products, id: \.id) { product in
                    Section {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(product.displayName).font(.headline)
                            Text(product.description).font(.caption).foregroundStyle(.secondary)
                            HStack {
                                Text(product.displayPrice).font(.title3.bold())
                                Spacer()
                                Button {
                                    purchase(product)
                                } label: {
                                    if purchasing == product.id {
                                        ProgressView()
                                    } else {
                                        Text("Mua").bold()
                                    }
                                }
                                .disabled(purchasing != nil)
                                .buttonStyle(.borderedProminent)
                            }
                        }.padding(.vertical, 4)
                    }
                }
                if let message {
                    Section { Text(message).font(.footnote).foregroundStyle(.secondary) }
                }
                Section {
                    Button("Khôi phục giao dịch") { restore() }
                        .disabled(purchasing != nil)
                }
            }
            .navigationTitle("Nâng cấp")
            .task { await loadProducts() }
        }
    }

    private func loadProducts() async {
        do {
            let catalog = try await session.payments.appleProducts()
            products = await session.storeKit.start(productIDs: catalog.map(\.productId))
        } catch {
            message = "Không tải được danh sách gói."
        }
    }

    private func purchase(_ product: Product) {
        Task {
            purchasing = product.id
            defer { purchasing = nil }
            do {
                _ = try await session.storeKit.purchase(product)
                await session.refreshPlan()    // server tier is the truth — refetch after activation
                message = "Đã kích hoạt gói."
            } catch {
                message = "Mua không thành công: \(error.localizedDescription)"
            }
        }
    }

    private func restore() {
        Task {
            purchasing = ""
            defer { purchasing = nil }
            do {
                _ = try await session.storeKit.restore()
                await session.refreshPlan()
                message = "Đã khôi phục."
            } catch {
                message = "Khôi phục thất bại: \(error.localizedDescription)"
            }
        }
    }
}
