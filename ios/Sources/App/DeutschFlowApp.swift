import SwiftUI

@main
struct DeutschFlowApp: App {
    @State private var session = AuthSession()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .tint(.gaAccent)
                .task { await session.bootstrap() }
        }
    }
}
