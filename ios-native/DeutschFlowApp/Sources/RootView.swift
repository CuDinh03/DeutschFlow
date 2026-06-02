import SwiftUI
import DeutschFlowKit

/// Auth-gated root. Swaps between the splash, the login flow, and the main tab bar based on ``AppSession``.
struct RootView: View {
    @EnvironmentObject private var session: AppSession

    var body: some View {
        switch session.auth {
        case .loading:
            ProgressView("DeutschFlow")
        case .loggedOut:
            LoginView()
        case .loggedIn:
            MainTabView()
        }
    }
}
