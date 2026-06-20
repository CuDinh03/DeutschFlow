import Foundation
import Security

/// Concurrency-safe token storage backed by the Keychain. Single source for the access/refresh
/// tokens; `AuthenticationMiddleware` reads and refreshes through it. The `actor` guarantees the
/// refresh path is serialized (no thundering-herd of refreshes on concurrent 401s).
actor TokenStore {
    static let shared = TokenStore()

    private let service = "com.deutschflow.app.tokens"
    private let accessAccount = "access"
    private let refreshAccount = "refresh"

    private(set) var accessToken: String?
    private(set) var refreshToken: String?

    init() {
        accessToken = Self.read(account: accessAccount, service: service)
        refreshToken = Self.read(account: refreshAccount, service: service)
    }

    var isLoggedIn: Bool { accessToken != nil }

    func save(access: String, refresh: String?) {
        accessToken = access
        Self.write(access, account: accessAccount, service: service)
        if let refresh {
            refreshToken = refresh
            Self.write(refresh, account: refreshAccount, service: service)
        }
    }

    func clear() {
        accessToken = nil
        refreshToken = nil
        Self.delete(account: accessAccount, service: service)
        Self.delete(account: refreshAccount, service: service)
    }

    // MARK: - Keychain
    private static func write(_ value: String, account: String, service: String) {
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(base as CFDictionary)
        var add = base
        add[kSecValueData as String] = Data(value.utf8)
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }

    private static func read(account: String, service: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private static func delete(account: String, service: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
