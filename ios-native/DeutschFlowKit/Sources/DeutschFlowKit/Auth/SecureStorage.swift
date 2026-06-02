import Foundation

/// Abstraction over secure key/value storage so ``TokenStore`` can be unit-tested without the real Keychain.
public protocol SecureStorage: Sendable {
    func get(_ key: String) -> String?
    func set(_ value: String, for key: String)
    func remove(_ key: String)
}

/// In-memory storage for tests and SwiftUI previews. Thread-safe.
public final class InMemorySecureStorage: SecureStorage, @unchecked Sendable {
    private var store: [String: String] = [:]
    private let lock = NSLock()

    public init() {}

    public func get(_ key: String) -> String? {
        lock.lock(); defer { lock.unlock() }
        return store[key]
    }

    public func set(_ value: String, for key: String) {
        lock.lock(); defer { lock.unlock() }
        store[key] = value
    }

    public func remove(_ key: String) {
        lock.lock(); defer { lock.unlock() }
        store[key] = nil
    }
}
