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

## Next steps (not yet done)

1. **App shell** — add the SwiftUI app target (`DeutschFlowApp`) with this package as a local dependency.
   No xcodegen/tuist installed yet; generate the `.xcodeproj` via XcodeGen/Tuist or create it in Xcode.
2. **OpenAPI codegen** — export the backend spec (`/v3/api-docs`) to a file and wire
   `swift-openapi-generator` to replace the hand-written DTOs, keeping the contract in sync.
3. **Confirm wire shapes** — verify `/api/auth/login` + `/api/auth/refresh` request/response against
   `AuthController` (the DTOs here carry `NOTE:` markers where unconfirmed).
4. Build out feature modules per the migration plan (Auth → Today → SRS → Speaking → …).
