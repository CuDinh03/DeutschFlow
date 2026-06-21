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
| M5.4 Paywall (StoreKit 2 + verify) | ⏸ **chờ Apple Developer** | backend `AppleIapController` sẵn (#129); cần 4 IAP product trong ASC | — |

## Mốc 6–7 — Compliance + Release
⏸ **Tất cả chờ Apple Developer** ($99 enroll + App ID + IAP products + cert) — đã hoãn theo quyết định ("đăng ký sau", xem `plans/2026-06-20-deploy-ops-runbook.md §5`). Gồm: UI xoá tài khoản (`DELETE /api/profile/me` sẵn), privacy labels/ATT, screenshots/metadata, TestFlight→submit, khai tử Expo.

## Backend cho mobile (Mốc 3)
- B3.2 push-token platform discriminator ✅ (sẵn). B3.3 verify-receipt ✅ (AppleIapController, #129/#128).
- B3.1 `ApnsPushSenderService` ☐ (cần `.p8`; không chặn MVP — bật push sau).

## Furthest slice chạy thật
Auth (Login+Register) → Hôm nay (dashboard thật) → Lộ trình (tree thật) → Ôn tập SRS (flashcard thật).
**Tất cả build-verified;** runtime: chạy simulator/device với 1 tài khoản để xem dữ liệu sống.
