// swift-tools-version:5.10
import PackageDescription

// DeutschFlowKit — the platform-agnostic core of the native iOS app (Phase 0).
// UI-free on purpose: networking, auth/token storage, and the StoreKit IAP client live here so they can be
// unit-tested on the macOS host (swift test) and reused by the SwiftUI app shell added in a later step.
let package = Package(
    name: "DeutschFlowKit",
    platforms: [.iOS(.v17), .macOS(.v13)],
    products: [
        .library(name: "DeutschFlowKit", targets: ["DeutschFlowKit"]),
    ],
    targets: [
        .target(name: "DeutschFlowKit"),
        .testTarget(name: "DeutschFlowKitTests", dependencies: ["DeutschFlowKit"]),
    ]
)
