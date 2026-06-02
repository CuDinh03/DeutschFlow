# DeutschFlow — Native iOS

Native Swift/SwiftUI rewrite of the iOS app (replaces the Expo `mobile/` app on iOS; Android dropped). The
Java backend is reused unchanged — it is a stateless JWT REST API, so the native client just consumes `/api/*`.

See the plans: [`plans/2026-06-02-native-ios-migration-plan.md`](../plans/2026-06-02-native-ios-migration-plan.md)
and [`plans/2026-06-02-native-ios-payments-iap-design.md`](../plans/2026-06-02-native-ios-payments-iap-design.md).

## `DeutschFlowKit` — Phase 0 core (this package)

UI-free Swift package holding the foundation the app shell will depend on. Kept platform-agnostic
(`iOS 17+`, `macOS 13+`) so it builds and unit-tests on the macOS host as well as against the iOS SDK.

```
Sources/DeutschFlowKit/
├── Networking/   APIClient (async URLSession, bearer + 401-refresh-retry), APIError
├── Auth/         TokenProviding, TokenStore (actor), SecureStorage + Keychain/in-memory impls
├── Models/       AuthTokens, LoginRequest, MyPlan, Apple* DTOs (mirror backend wire shapes)
└── Payments/     PaymentsAPI (+ default impl), StoreKitManager (StoreKit 2 purchase/restore → backend verify)
```

### Verify

```bash
cd ios-native/DeutschFlowKit
swift build            # host build
swift test             # 10 unit tests (APIClient, TokenStore, model decoding)
xcodebuild -scheme DeutschFlowKit -destination 'generic/platform=iOS Simulator' build   # iOS SDK compile
```

All three are green as of 2026-06-02.

## `DeutschFlowApp` — SwiftUI app shell

Minimal app target wiring up the package. Composition root in `AppSession` (`APIClient` + `TokenStore` +
`PaymentsAPI` + `StoreKitManager`), auth-gated routing via `RootView`, and three placeholder tabs:

- **Today** — shows the canonical tier from `GET /api/auth/me/plan`.
- **Paywall** — lists products from `GET /api/payments/apple/products`, drives StoreKit 2 purchase/restore.
- **Profile** — logout.

```bash
cd ios-native
xcodegen generate
xcodebuild -project DeutschFlowApp.xcodeproj -scheme DeutschFlowApp \
  -destination 'generic/platform=iOS Simulator' build
```

The `.xcodeproj` is git-ignored — always regenerate from `project.yml` (single source of truth).

## Next steps

1. **OpenAPI codegen** (deferred) — once a running staging instance is reachable,
   `curl https://api.mydeutschflow.com/v3/api-docs > openapi.json`, commit it, and wire
   `swift-openapi-generator` (build plugin) to regenerate the DTOs on every build.
   Current DTOs are hand-written **and locked** by `ModelDecodingTests` against the exact
   shape backend writes — wire mismatches now fail CI rather than runtime.
2. **Run on a simulator** end-to-end against staging (`APIBaseURL` in `Info.plist`).
3. Build out feature modules per the migration plan (SRS → Speaking → Roadmap → …).
