import Foundation
import SwiftUI
import DeutschFlowKit

/// Observable runtime state for the app. Owns the singletons that touch the network or device storage,
/// and exposes login / logout / refresh-plan so views stay free of wiring concerns.
///
/// The backend base URL is read from an Info.plist key (`APIBaseURL`) so dev/staging/prod can switch without
/// a rebuild; falls back to a known staging host so the simulator works out of the box.
@MainActor
final class AppSession: ObservableObject {

    enum AuthState: Equatable { case loading, loggedOut, loggedIn }

    @Published private(set) var auth: AuthState = .loading
    @Published private(set) var plan: MyPlan?
    @Published var lastError: String?

    let apiClient: APIClient
    let tokenStore: TokenStore
    let payments: PaymentsAPI
    let storeKit: StoreKitManager

    private init(apiClient: APIClient, tokenStore: TokenStore, payments: PaymentsAPI, storeKit: StoreKitManager) {
        self.apiClient = apiClient
        self.tokenStore = tokenStore
        self.payments = payments
        self.storeKit = storeKit
    }

    static func live() -> AppSession {
        let baseURLString = (Bundle.main.object(forInfoDictionaryKey: "APIBaseURL") as? String)
            ?? "https://api.mydeutschflow.com"
        let baseURL = URL(string: baseURLString)!
        let tokenStore = TokenStore(baseURL: baseURL, storage: KeychainSecureStorage())
        let api = APIClient(baseURL: baseURL, tokenProvider: tokenStore)
        let payments = DeutschFlowPaymentsAPI(client: api)
        let storeKit = StoreKitManager(payments: payments)
        return AppSession(apiClient: api, tokenStore: tokenStore, payments: payments, storeKit: storeKit)
    }

    /// Decide the initial route based on whether we already have a stored access token.
    func bootstrap() async {
        let loggedIn = await tokenStore.isLoggedIn
        auth = loggedIn ? .loggedIn : .loggedOut
        if loggedIn { await refreshPlan() }
    }

    func login(email: String, password: String) async {
        lastError = nil
        do {
            let tokens: AuthTokens = try await apiClient.post(
                "/api/auth/login",
                body: LoginRequest(email: email, password: password),
                authorized: false
            )
            await tokenStore.setTokens(tokens)
            auth = .loggedIn
            await refreshPlan()
        } catch {
            lastError = readable(error)
        }
    }

    func logout() async {
        await tokenStore.clear()
        plan = nil
        auth = .loggedOut
    }

    func refreshPlan() async {
        do {
            plan = try await payments.currentPlan()
        } catch {
            lastError = readable(error)
        }
    }

    private func readable(_ error: Error) -> String {
        if let apiError = error as? APIError {
            switch apiError {
            case .unauthorized: return "Phiên đăng nhập đã hết hạn."
            case .http(let status, _): return "Lỗi máy chủ (HTTP \(status))."
            case .transport(let message): return "Mất kết nối: \(message)"
            case .decoding(let message): return "Dữ liệu không hợp lệ: \(message)"
            case .invalidURL, .notConfigured: return "Cấu hình API không hợp lệ."
            }
        }
        return error.localizedDescription
    }
}
