# iOS Native MVP — tiến độ (nhánh `feat/native-ios-phase0`)

> Theo `plans/2026-06-20-execution-plan.md` Mốc 4–7 (tracker chính ở nhánh web `feat/web-v2-cutover`;
> file này theo dõi iOS vì plan nằm khác nhánh). **Build:** Xcode 16.2 trên máy; CLI cần
> `xcodegen generate` (khi thêm file) + `xcodebuild ... -skipPackagePluginValidation build`.

## Mốc 4 — Phase 0–1 (Auth → Hôm nay)
| Task | Trạng thái | Endpoint / ghi chú | Verify |
|---|---|---|---|
| M4.1 Foundation (Xcode/SPM/codegen/Networking/Auth/DesignSystem) | ✅ | scaffold trước | BUILD ✓ |
| M4.2 Register | ✅ | `POST /api/auth/register` (201→AuthResponse); Login↔Register NavigationStack | BUILD ✓ |
| M4.3 Onboarding tối giản | ⏸ defer-minor | slice Auth→Today chạy không cần; khớp quyết định hoãn onboarding bên web | — |
| M4.4 Hôm nay (Today) | ✅ | `/api/auth/me` + `/api/student/dashboard` (streak/XP/tiến độ/buổi/phút) | BUILD ✓ |

## Mốc 5 — MVP screens
| Task | Trạng thái | Endpoint / ghi chú | Verify |
|---|---|---|---|
| M5.1 Lộ trình (RoadmapTree) | ✅ | `GET /api/roadmap/tree` (TreeDto) — Option-1: levels→branch progress (no SVG canvas) | BUILD ✓ |
| M5.2 Ôn tập SRS (Từ vựng) | ✅ | `GET /api/srs/due` + `POST /api/srs/review` + `GET /api/srs/count`; flashcard→grade→next; entry trên Home | BUILD ✓ |
| M5.3 Offline SRS (SwiftData) | ☐ optional | rủi ro cao; có thể giữ online-only cho v1 | — |
| M5.4 Paywall (StoreKit 2 + verify) | ✅ **scaffold** · ⏸ test chờ Apple | `PaywallModel`+`PaywallView` (Features/Paywall): `products`∩StoreKit→`purchase`(appAccountToken)→`verify{jws}`→entitlement; restore=`AppStore.sync`+`sync`. Entry ở `ProfileView` (sheet) + disclosure auto-renew. Local `DeutschFlow.storekit` (StoreKit Testing, wired vào scheme). Sandbox/ASC products = Apple-gated. | BUILD ✓ |

## Mốc 6–7 — Compliance + Release
### ✅ Làm được KHÔNG cần Apple (2026-06-22)
| Task | Trạng thái | Ghi chú | Verify |
|---|---|---|---|
| M6.3 UI Xoá tài khoản | ✅ | `ProfileView` (tab Hồ sơ) → alert xác nhận → `DELETE /api/profile/me` (op `deleteAccount`, 204) → signOut. Thay `ProfilePlaceholder`. App Store 5.1.1(v). | BUILD ✓ |
| M6.4 Privacy Info.plist | ✅ | mic + speech + `ITSAppUsesNonExemptEncryption=NO` đã khai (project.yml). Rà: **0 camera / 0 tracking SDK** trong Sources → **ATT = none** (không cần NSCamera/NSUserTracking). | verified |
| M6.5 App icon | ✅ placeholder | `Resources/Assets.xcassets/AppIcon` 1024 (ink #161513 + "DF" vàng #FFCD00, no-alpha) + `ASSETCATALOG_COMPILER_APPICON_NAME`. ⚠️ **design thay PNG thật trước submit.** | BUILD ✓ (actool ✓) |

### ⏸ Chờ Apple Developer ($99 enroll + App ID + IAP products + cert)
M5.4 Paywall (StoreKit) · App Privacy labels (ASC form) · screenshots/metadata · demo account · TestFlight→submit · khai tử Expo. Xem `plans/2026-06-22-week-deploy-plan.md` §B2.

## Backend cho mobile (Mốc 3)
- B3.2 push-token platform discriminator ✅ (sẵn). B3.3 verify-receipt ✅ (AppleIapController, #129/#128).
- B3.1 `ApnsPushSenderService` ☐ (cần `.p8`; không chặn MVP — bật push sau).

## Furthest slice chạy thật
Auth (Login+Register) → Hôm nay (dashboard thật) → Lộ trình (tree thật) → Ôn tập SRS (flashcard thật).
**Tất cả build-verified;** runtime: chạy simulator/device với 1 tài khoản để xem dữ liệu sống.
