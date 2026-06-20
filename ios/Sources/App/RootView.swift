import SwiftUI

/// Auth-gated root: TokenStore state decides Auth stack vs the 5-tab signed-in shell.
struct RootView: View {
    @Environment(AuthSession.self) private var session

    var body: some View {
        switch session.state {
        case .loading:
            ZStack { Color.gaBg.ignoresSafeArea(); ProgressView().tint(.gaAccent) }
        case .signedOut:
            LoginView()
        case .signedIn:
            MainTabView()
        }
    }
}
