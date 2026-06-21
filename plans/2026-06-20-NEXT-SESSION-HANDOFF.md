# DeutschFlow — HANDOFF cho session mới (2026-06-21)

> **Đọc file này trước.** Tự chứa đủ để 1 session mới (không có context cũ) tiếp tục.
> **ƯU TIÊN: Web v2 go-live.** Native iOS **HOÃN** — chờ Apple Developer duyệt đăng ký.

---

## 1. TL;DR
- **Web v2 "Galerie" cutover đã code xong** (4 vai trò), nằm trên **PR #130** (draft, 15 commit, CI xanh). **Chưa live** (chờ go-live thủ công).
- **iOS MVP core đã code xong + build-verified** (Auth+Today+Lộ trình+SRS) trên `feat/native-ios-phase0`. **HOÃN** phần Paywall + release **vì chờ Apple Developer duyệt đăng ký**.
- **Prod backend** đang chạy (`main` = `467403b6`, health UP) — đã có Learning Tree + audit (deploy B2.1 trước đó).

## 2. Bản đồ branch / PR
| Branch | PR | Nội dung | Hành động |
|---|---|---|---|
| `feat/web-v2-cutover` | **#130** (draft) | Web cutover: route-in W1.1 + org-detail (B1.1/B1.2 BE+FE) + admin-12 + GaPageHdr + docs | **MERGE để go-live** |
| `feat/native-iap-tts-typed` | #129 (open) | Backend IAP/Tts typed (cho iOS) | optional; merge khi làm iOS |
| `feat/native-ios-phase0` | — (chưa PR) | iOS MVP (Auth/Today/Tree/SRS), +11 vs main | **KHÔNG merge** tới khi Apple sẵn sàng |
| `main` | — | prod (`467403b6`) | đích deploy |

## 3. 🚀 WEB GO-LIVE — checklist (làm trong session mới)
> Chi tiết + lệnh: `plans/2026-06-20-deploy-ops-runbook.md` §"GO-LIVE NOW". Tóm tắt:

1. **Merge PR #130 → main** (bỏ draft → review → merge). ✅ Amplify auto-deploy **frontend**.
2. **🔴 Redeploy BACKEND** (vì #130 có B1.1/B1.2 org-detail endpoints):
   ```bash
   cd /Users/dinhcu/Developer/DeutschFlow
   git checkout main && git pull origin main
   git status            # phải sạch (git stash -u nếu bẩn)
   ./deploy-backend.sh   # đọc log; exit 1 ở cleanup-prompt = bình thường
   ```
   ⚠️ **Bỏ bước này → `/v2/org/classes/[id]` + `/v2/org/students/[id]` 404.** Verify: `GET /api/org/classes/{id}` (org-admin) → 200.
3. **Env Amplify**: `GALERIE_V2_DISABLED` để **trống** + có `NEXT_PUBLIC_POSTHOG_KEY` (JWT + URL đã set vì prod đang chạy).
4. **Tạo cờ PostHog `galerie-v2`** → bật **tài khoản nội bộ** trước.
5. **Verify route-in**: login user nội bộ (đã bật cờ) → vào `/v2/*` đúng vai (admin→`/v2/admin/users` · teacher→`/v2/teacher` · org-owner→`/v2/org` · student→`/v2/student/dashboard`).
6. **W1.6 visual-QA** (nấc nội bộ): smoke 4 vai + chụp org-detail + vài màn admin-12 (1440px) đối chiếu `~/Downloads/deutschflow/Prototype A - Galerie.html`.
7. **Rollout**: nội bộ → 10% → 50% → 100% (legacy fallback). **Rollback** = `GALERIE_V2_DISABLED=true` hoặc giảm % PostHog.

**Rủi ro 🔴 cần biết:**
- Route-in (W1.1) chỉ ở prod sau khi #130 merge → bật cờ trước đó = vô tác dụng.
- `deploy-backend.sh` deploy **branch đang đứng** → phải `git checkout main` trước.
- `main` CI Integration-Tests fail (pre-existing) → auto-deploy CI skip → **deploy thủ công là đúng**.

## 4. 📱 NATIVE iOS — HOÃN (log)
**Lý do hoãn:** chờ **Apple Developer Program duyệt đăng ký** ($99 enroll + App ID + IAP products). Tới khi có:
- **M5.4 Paywall** (StoreKit 2 client → verify) — backend `AppleIapController` đã sẵn (#129).
- **Mốc 6–7**: UI xoá tài khoản (`DELETE /api/profile/me` sẵn) + privacy labels/ATT + screenshots/metadata + TestFlight → submit + khai tử Expo.
- **M5.3 offline SRS** = optional (đã chốt **online-only OK cho v1** — chưa làm, rủi ro cao).
- **B3.1 ApnsPushSender** = cần `.p8` (không chặn MVP; bật push sau).

**Đã xong (build-verified, Xcode 16.2):** Auth(Login+Register) · Hôm nay(dashboard) · Lộ trình(tree) · Ôn tập SRS. Chi tiết: `ios/MVP_PROGRESS.md`. Build: `cd ios && xcodegen generate && xcodebuild -scheme DeutschFlow -destination 'generic/platform=iOS Simulator' -skipPackagePluginValidation build`.

## 5. Tài liệu liên quan (đọc khi cần)
- `plans/2026-06-20-execution-plan.md` — master plan + Nhật ký thực thi realtime.
- `plans/2026-06-20-deploy-ops-runbook.md` — go-live/deploy/env/flag chi tiết.
- `plans/2026-06-20-v2-cutover-and-deploy-readiness.md` — audit cutover gốc.
- `ios/MVP_PROGRESS.md` — tiến độ iOS.
- `docs/UI_2.0_*.md` — QA/fidelity (⚠️ `docs/` gitignored → chỉ local).

## 6. Gotchas chung
- `docs/` gitignored (QA docs local, không vào PR); `plans/` tracked.
- Prod API host: `https://api.mydeutschflow.com`; EC2 `ubuntu@35.175.232.152` (PEM `deutschflow-key.pem`).
- Web QA login (local stack): admin@local.test · teacher@local.test (org1 OWNER) · student@deutschflow.com — pw `Admin12345!`.
- Token-discipline (literal hex→token) + a11y DataTable + W1.3 QA-gaps = web polish **chưa làm**, non-blocking (xem `docs/UI_2.0_W1.2_PUNCHLIST_STATUS_2026-06-21.md`).
