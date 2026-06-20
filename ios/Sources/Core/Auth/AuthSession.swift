import Foundation
import Observation

/// App-level auth state driving the auth-gated root view. `@Observable` (iOS 17+), main-actor bound.
@MainActor
@Observable
final class AuthSession {
    enum State: Equatable { case loading, signedOut, signedIn }

    private(set) var state: State = .loading
    private let tokenStore: TokenStore

    init(tokenStore: TokenStore = .shared) {
        self.tokenStore = tokenStore
    }

    /// Decide the initial route from persisted tokens.
    func bootstrap() async {
        state = await tokenStore.isLoggedIn ? .signedIn : .signedOut
    }

    func didSignIn(access: String, refresh: String?) async {
        await tokenStore.save(access: access, refresh: refresh)
        state = .signedIn
    }

    func signOut() async {
        await tokenStore.clear()
        state = .signedOut
    }
}
