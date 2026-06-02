import SwiftUI
import DeutschFlowKit

/// App entry. Composes the runtime environment once and hands it to the SwiftUI hierarchy.
@main
struct DeutschFlowAppMain: App {

    @StateObject private var session = AppSession.live()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .task { await session.bootstrap() }
        }
    }
}
