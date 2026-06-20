# DeutschFlow iOS — Native SwiftUI app (Phase 0 foundation)

> **START HERE.** This is the native Swift/SwiftUI student app that replaces the Expo/React-Native app in `mobile/` (to be deprecated). It reuses 100% of the existing Java/Spring Boot backend via its OpenAPI contract.
> 📒 **Whole-initiative overview (read first):** [`NATIVE_IOS_SYNTHESIS.md`](NATIVE_IOS_SYNTHESIS.md) — ties together the API contract, the app, and the App Store path.
> Source of truth for this scaffold: `plans/2026-06-20-native-handoff-phase0.md` (Phase 0 + token table), `plans/2026-06-02-native-ios-migration-plan.md` (8 phases, tech stack), `plans/2026-06-20-appstore-release-plan.md` (release gating).

## What this is (Phase 0 = "Hello API")
Goal of Phase 0: an empty app that can call `/api/auth/me` for real, with the design system + networking + auth foundation in place. Phase 1 then builds the **Auth → Hôm nay** vertical slice.

## Decisions locked (from the handoff)
| Decision | Value |
|---|---|
| Language / UI | Swift 6 + SwiftUI |
| Min deployment | iOS 17 (needs `@Observable` + SwiftData) |
| Architecture | MVVM + `@Observable` + Repository (not TCA) |
| Networking | `URLSession` async/await |
| API client / DTO | **swift-openapi-generator** (Apple) from `/v3/api-docs/ios`, pinned spec |
| Token store | `actor TokenStore` + Keychain |
| Offline / SRS | SwiftData (Phase 2+) |
| Audio | AVFoundation (Phase 3+) |
| Push | APNs (Phase 5) |
| Payments | StoreKit 2 (Phase 5) |
| Design tokens | **GA tokens from `frontend/src/styles/galerie.css`** (NOT `mobile/lib/theme/tokens.ts`) |
| Card radius | **6** (native override of web's 2px) |
| Project generation | **XcodeGen** (`project.yml` → `DeutschFlow.xcodeproj`, kept out of git) |

## Layout
```
ios/
  project.yml                         # XcodeGen → DeutschFlow.xcodeproj (run `xcodegen generate`)
  openapi/
    openapi.yaml | openapi.json       # PINNED ios spec (see "Pin the spec" — not committed yet)
    openapi-generator-config.yaml     # swift-openapi-generator config
  Sources/
    App/                              # @main app, RootView (auth-gated), MainTabView (5 tabs)
    Core/
      DesignSystem/                   # GaColor/GaFont/GaSpace/GaRadius/GaMotion + components
      Networking/                     # AppEnvironment, AuthenticationMiddleware, APIClientFactory
      Auth/                           # TokenStore (actor+Keychain), AuthSession (@Observable)
      Persistence/ Push/ Audio/ Analytics/   # (placeholders for later phases)
    Features/                         # (Phase 1+: Auth, Onboarding, Home)
    Generated/                        # swift-openapi-generator output (gitignored; produced at build)
```

## First-run setup (on a Mac with Xcode 16+)
```bash
# 1. Tools
brew install xcodegen            # project generator

# 2. Pin the iOS OpenAPI spec (api-docs is public only under the local/dev/test profile —
#    run the backend with SPRING_PROFILES_ACTIVE=local, or use an ADMIN token).
curl -s http://localhost:8080/v3/api-docs/ios -o ios/openapi/openapi.json
#    (or fetch from staging/prod with an Authorization: Bearer <admin-jwt> header)

# 3. Generate the Xcode project and open
cd ios && xcodegen generate && open DeutschFlow.xcodeproj
#    swift-openapi-generator runs as a build-tool plugin → emits the typed Client + DTOs into Generated/

# 4. Build (the generated Client appears after the first build)
xcodebuild -project DeutschFlow.xcodeproj -scheme DeutschFlow \
  -destination 'platform=iOS Simulator,name=iPhone 16' build
```

## Phase 0 Definition of Done
- [ ] Project generates + builds clean (CI: `xcodebuild` + codegen + drift check).
- [ ] Paste a test JWT → `GET /api/auth/me` returns the real user.
- [ ] DesignSystem renders with the correct GA tokens.

## Status of THIS scaffold
- ✅ Project definition (`project.yml`), OpenAPI generator config, DesignSystem (tokens + a few primitives), Core Networking/Auth (TokenStore, AuthenticationMiddleware, environments), App skeleton (auth-gated root + 5-tab shell + placeholder Login/Home) — written as source.
- ⏳ **Pending (need Mac + Xcode, and were blocked here by a transient tooling outage):** pin `openapi/openapi.json` from the live spec, `xcodegen generate`, first `xcodebuild`, and bundling the Newsreader / Instrument Sans `.ttf` fonts (register in Info.plist `UIAppFonts`).
- ⚠️ This Swift has **not been compiled here** — treat as a faithful first draft to open in Xcode; fix any API/signature drift against your Xcode 16 / Swift 6 toolchain. The codegen-dependent wiring (`APIClientFactory` using the generated `Client`) compiles only after step 2–3 above.

## App Store guardrails carried from the release plan
- Paywall uses **StoreKit 2 only** → backend `POST /api/payments/apple/verify` (+ `/sync`, `/products`, `/account-token`). **Never** open Stripe/MoMo/SePay web payment in this app (Guideline 3.1.1/3.1.3).
- Account deletion UI → `DELETE /api/profile/me` (Guideline 5.1.1(v)).
- Mic permission strings required (speaking): add `NSMicrophoneUsageDescription` (+ `NSSpeechRecognitionUsageDescription`).
- No social login → Sign in with Apple not required (don't add Google login without also adding Sign in with Apple).
