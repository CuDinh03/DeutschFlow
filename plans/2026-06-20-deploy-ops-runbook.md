# DeutschFlow — Runbook turnkey: Deploy v2 cutover (B2.1 · W2.1 · W2.2) + Apple register-later (B6.1)

> **Ngày:** 2026-06-21 · **Của:** delivery lead · **Bối cảnh:** thực thi `plans/2026-06-20-execution-plan.md` Mốc 2 + chuẩn bị Mốc 6.
> **Vì sao là runbook (không phải tôi tự chạy):** B2.1 SSH vào EC2 (`ubuntu@35.175.232.152`, PEM + `.env.production` secrets) — môi trường của tôi **chặn ssh** + đây là hành động prod rủi ro cao; W2.1 = AWS Amplify Console; W2.2 = PostHog dashboard. Tôi đã **verify mọi tiền đề** để bạn chạy trong vài phút. Mọi lệnh dưới đây đã đối chiếu code/CI thật.

> ⚠️ **CẬP NHẬT 2026-06-21 — CUTOVER ĐÃ XONG; phần cờ PostHog (§3) + rollout staged (§3-4) bên dưới = OBSOLETE.** Cờ `galerie-v2` bị **BỎ** (flaky person-property) → cutover ship dạng **v2-default hardcode** (#134), `/login`+/v2 `force-dynamic` (#132/#135), KHÔNG ramp %. Backend redeploy (§1) + env Amplify (§2, `GALERIE_V2_DISABLED` trống/`true` = kill-switch) vẫn **đúng & còn dùng**. Rollback hiện tại = `GALERIE_V2_DISABLED=true`. Trạng thái thật: `execution-plan.md` Nhật ký cuối.

---

## 🚀 GO-LIVE NOW — checklist hiện trạng (2026-06-21 · user tự chạy)

> Web v2 functionally-complete trên **[PR #130](https://github.com/CuDinh03/DeutschFlow/pull/130)** (route-in W1.1 + admin-12 + org-detail + B1.1/B1.2 + GaPageHdr). Backend prod đã có tree/audit (B2.1). Thứ tự bật:

1. **Merge PR #130 → main** (bỏ draft → review → merge). ✅ Amplify **auto-deploy FRONTEND** (route-in, admin-12, org-detail FE…).
2. **🔴 Redeploy BACKEND** — #130 có cả B1.1/B1.2 (`OrgController`/`OrgService`):
   ```bash
   git checkout main && git pull origin main
   git status            # phải sạch (git stash -u nếu bẩn)
   ./deploy-backend.sh   # đọc log; exit 1 ở cleanup-prompt = cosmetic
   ```
   ⚠️ **Bỏ bước này → `/v2/org/classes/[id]` + `/v2/org/students/[id]` sẽ 404** (endpoint chưa lên prod). Verify: `GET /api/org/classes/{id}` (org-admin) → 200.
3. **Env Amplify** (§2): có JWT verifier + `NEXT_PUBLIC_POSTHOG_KEY`; `GALERIE_V2_DISABLED` để **trống**. (Prod web đang chạy nên phần lớn đã set.)
4. **Cờ PostHog `galerie-v2`** (§3): tạo flag → bật tài khoản nội bộ trước.
5. **Verify route-in**: login user nội bộ (đã bật cờ) → vào `/v2/*` đúng vai (admin→/v2/admin/users · teacher→/v2/teacher · org-owner→/v2/org · student→/v2/student/dashboard). Vẫn ở legacy → kiểm cờ + W1.1 đã ở prod.
6. **W1.6 visual runtime-QA** (nấc nội bộ): smoke 4 vai + chụp `/v2/org/classes/[id]`, `/students/[id]`, vài màn admin-12 (1440px) đối chiếu Prototype A → ghi gap vào `UI_2.0_QA_GAPS.md`.
7. **Rollout** (§3): nội bộ → 10% → 50% → 100% (legacy fallback). **Rollback** = `GALERIE_V2_DISABLED=true` hoặc giảm % PostHog.
8. (tuỳ chọn, native) merge [#129](https://github.com/CuDinh03/DeutschFlow/pull/129) — IAP/Tts typed, không ảnh hưởng web.

> **AI hỗ trợ khi rollout:** lỗi/console-error/feedback fidelity → gửi lại, vá ngay. Web dev khác (W1.2 còn lại · W1.3 · iOS Mốc 3–7) **tạm dừng** theo yêu cầu.

---

## 0. Trạng thái CI (B0.3 — ✅ đã kiểm)

- ✅ **Sự cố GitHub Actions billing ĐÃ HẾT** — các run 2026-06-21 đều `success`. PR #129 + #130: Backend CI/CD ✅ · Frontend CI ✅ · Security CI ✅.
- ⚠️ **`main` Backend CI/CD = failure** ở merge #128 (2026-06-20). Job hỏng = **🐘 Integration Tests** (Failsafe/Testcontainers); **Compile ✅ + Unit Tests ✅**. Job **🚀 Deploy to EC2 = skipped** (gate sau IT).
  → Đây là **IT fail có sẵn** (khớp memory). Hệ quả: **auto-deploy CI không chạy** → **phải deploy thủ công** (mục 1). Không phải lỗi code build (compile+unit xanh).
  → **Việc nên làm (tuỳ chọn):** điều tra/khoanh vùng IT fail để mở lại auto-deploy — `gh run view 27881624218 --log-failed`. Hiện KHÔNG chặn manual deploy.

---

## 1. B2.1 — Deploy backend prod (THỦ CÔNG, turnkey)

### Cái gì sẽ lên prod khi deploy `main` HÔM NAY
`main` đã có (đã verify): **V219/V220** (learning tree) + module `curriculum` + `common/audit` (admin audit) + tới **V224**. → Deploy `main` bây giờ đưa **tree + audit** ra prod (đang treo từ trước).
⚠️ **Endpoint org-detail mới (B1.1/B1.2) CHƯA ở main** — chúng ở [PR #130](https://github.com/CuDinh03/DeutschFlow/pull/130). IAP/Tts R5 ở [PR #129](https://github.com/CuDinh03/DeutschFlow/pull/129). Muốn deploy kèm 2 cái này → **merge #129/#130 vào main trước** (xem mục 4 về thứ tự).

### Tiền đề (verify trước khi chạy)
- [ ] **IP của bạn được whitelist** trong AWS Security Group cho **port 22** (EC2 `35.175.232.152`). *(Gotcha cũ: từng whitelist nhầm `.190` vs IP thật.)*
- [ ] PEM tồn tại: `deutschflow-key.pem` (script trỏ cứng `/Users/dinhcu/Developer/DeutschFlow/deutschflow-key.pem`).
- [ ] `.env.production` tồn tại + đủ biến: `DB_HOST DB_PASSWORD GROQ_API_KEY AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY GEMINI_API_KEY UNSPLASH_*` (script tự check, thiếu là `exit 1`).
- [ ] **Đứng đúng branch muốn deploy** — script `git push origin <BRANCH>` rồi deploy **branch hiện tại**. Để deploy tree/audit: `git checkout main && git pull`.
- [ ] **Cây làm việc sạch** — ⚠️ script **Phase 1 auto-commit dirty tree**; `git stash -u` mọi WIP trước (đặc biệt: working tree đang có untracked `ios/` + `plans/2026-06-20-native-*`).

### Lệnh
```bash
cd /Users/dinhcu/Developer/DeutschFlow
git checkout main && git pull origin main      # deploy nội dung main (tree/audit)
git status                                       # phải sạch; nếu không: git stash -u
./deploy-backend.sh
```
Quy trình script: connectivity check → `git push origin main` → scp `.env.production` (+ `google-sa.json` nếu có) → EC2 pull+build → Edge-TTS sidecar → **blue-green** (GREEN:8081 health → promote 8080) → cleanup + health.

### Sau khi chạy — verify
- [ ] ⚠️ **Gotcha:** script **exit 1 ở bước cleanup-prompt DÙ deploy THÀNH CÔNG** — **đọc log**, đừng tin mỗi exit code.
- [ ] Health: `curl -sf https://<api-host>/actuator/health` → `UP`.
- [ ] Tree: `GET /api/roadmap/tree` (đăng nhập student) → 200, có dữ liệu cây.
- [ ] Audit: `GET /api/admin/audit` (admin) → 200.
- [ ] (nếu đã merge #130) `GET /api/org/classes/{id}` + `/api/org/students/{id}` → 200 / 404 đúng.

---

## 2. W2.1 — Biến môi trường Amplify (Console → App settings → Environment variables)

Verify từ `amplify.yml` (build **fail** nếu thiếu cả 2 JWT verifier) + `middleware.ts`/`next.config.mjs`:

| Biến | Bắt buộc | Giá trị / nguồn |
|---|---|---|
| `JWT_RSA_PUBLIC_KEY` **hoặc** `JWT_SECRET` | ✅ (1 trong 2) | RS256 PEM `\n`-escaped (ưu tiên, khớp backend) **hoặc** HS256 secret (phải khớp backend). Thiếu cả 2 → Amplify build abort. |
| `NEXT_PUBLIC_BACKEND_URL` | ✅ | vd `https://api.mydeutschflow.com` |
| `NEXT_PUBLIC_CLOUDFRONT_URL` | ✅ | vd `https://dxxxx.cloudfront.net` (vào CSP `connect-src`/`img`) |
| `NEXT_PUBLIC_POSTHOG_KEY` | ✅ | PostHog project API key (public) — **cần cho cờ `galerie-v2`** |
| `NEXT_PUBLIC_POSTHOG_HOST` | ✅ | vd `https://us.i.posthog.com` |
| ~~`GALERIE_V2_DISABLED`~~ | 🗑️ **ĐÃ KHAI TỬ 2026-07-14** — xoá khỏi Amplify | Kill-switch cũ (bounce `/v2`→legacy) đã bị **gỡ khỏi code** ở đợt 0 của kế hoạch xoá cây v1 (`plans/2026-07-14-xoa-sach-v1-web.md`). Đặt env này giờ **KHÔNG có tác dụng gì** — bật lên chỉ khiến người trực tưởng đã rollback. Xem mục Rollback bên dưới. |
| `NEXT_PUBLIC_MAINTENANCE_MESSAGE` | tuỳ chọn | banner bảo trì ở màn login |

Sau khi set → **redeploy** Amplify (FE auto-deploy khi merge main; hoặc bấm redeploy).

### ⚠️ Rollback bề mặt web (thay cho kill-switch cũ)

Kill-switch `GALERIE_V2_DISABLED` đã bị gỡ vì nó **tạo vòng lặp redirect vô hạn**: từ 2026-07-14 `next.config.mjs` redirect `/login`→`/v2/login`, nên nếu kill-switch còn sống và bounce `/v2/login`→`/login`, hai lớp sẽ đá qua đá lại và **sập cả site**. Nó cũng đã vô nghĩa từ lúc cutover (trang `/login` legacy cũng đẩy người dùng sang v2 sau khi đăng nhập).

**Rollback đúng cách bây giờ:** revert commit trên `main` (Amplify tự deploy lại), hoặc vào Amplify Console → chọn bản deploy trước đó → **Redeploy this version**.

---

## 3. W2.2 — Cờ PostHog `galerie-v2` (rollout)

⚠️ **Phụ thuộc:** route-in **W1.1** (đẩy user vào /v2) đang ở **PR #130, CHƯA ở prod**. Bật cờ chỉ có tác dụng **sau khi W1.1 deploy** (merge #130 hoặc ít nhất commit `3e1c6c09` → Amplify build). Cờ ON mà chưa có W1.1 ở prod = **không ai vào /v2** (đúng phát hiện ở audit).

Các bước (PostHog dashboard → Feature flags):
1. Tạo flag key **`galerie-v2`** (boolean).
2. **Nấc 0 — nội bộ:** release condition theo email/user-id nội bộ (vd `@deutschflow.com`/`@local.test`). Smoke 4 vai trên prod (login → đúng /v2 home; 0 console error).
3. **Nấc 1 — 10%** → theo dõi error-rate/CWV/ticket ≥24h.
4. **Nấc 2 — 50%** → ổn ≥24–48h.
5. **Nấc 3 — 100%** → legacy vẫn sống làm fallback.
- **Rollback:** ~~giảm % PostHog / `GALERIE_V2_DISABLED=true`~~ → cả hai đã chết (cờ bị bỏ 2026-06-21, kill-switch bị gỡ 2026-07-14). Xem mục Rollback ở §2.
- (Tuỳ chọn) `student-coins-v1` nếu bật coin song song.

> Phần "swap /v2→canonical + xoá legacy" (Mốc 2b) chỉ làm **sau khi 100% ổn** — runbook riêng, cần duyệt.

---

## 4. Thứ tự go-live web (ràng buộc phụ thuộc)

```
(a) merge #129 (IAP/Tts) → main          [an toàn, CI xanh; phục vụ iOS sau, không ảnh hưởng web]
(b) hoàn tất #130 (W1.4 FE + admin-12 + fidelity) HOẶC tối thiểu cherry-pick W1.1 → main
(c) deploy backend prod (mục 1)  ← đưa tree/audit (+ org-detail nếu #130 merged) ra prod
(d) set env Amplify (mục 2) + FE auto-deploy khi #130 vào main
(e) cấu hình cờ PostHog (mục 3) → rollout nội bộ → 10% → 50% → 100%
```
**Tối thiểu để bật v2 có ý nghĩa:** cần (b) W1.1 ở prod + (c) backend + (d) env + (e) cờ. Hiện (a)(b)(c)(d)(e) **đều chờ bạn** (merge + 3 hành động hạ tầng).

---

## 5. B6.1 (HOÃN — đăng ký Apple để làm sau)

> Quyết định: **bỏ qua bây giờ, đăng ký sau.** Đây là checklist để khi quay lại làm ngay (không chặn web go-live; chỉ chặn iOS TestFlight/submit — Mốc 6/7).

- [ ] **Apple Developer Program** — enroll ($99/năm), tài khoản tổ chức hoặc cá nhân.
- [ ] **App ID** `com.deutschflow.app` *(⚠️ đang gắn app Expo — xem M7.1: tái dùng id hay id mới cho beta)* — bật capability **In-App Purchase** + **Push Notifications**.
- [ ] **Signing:** Apple Distribution cert + provisioning profile (hoặc Xcode Automatic Signing + chọn Team).
- [ ] **4 sản phẩm IAP** (auto-renewable subscription): `com.deutschflow.app.{pro,ultra}.{monthly,yearly}` + giá theo region + nhóm subscription.
- [ ] **App Store Connect:** tạo app record; cấu hình **App Store Server Notifications V2** webhook → `<backend>/api/payments/apple/notifications` (handler đã có ở [PR #129](https://github.com/CuDinh03/DeutschFlow/pull/129)).
- [ ] **APNs `.p8` key** (cho push) — tải về, cấu hình `ApnsPushSenderService` (B3.1, chưa dựng).
- [ ] **Compliance trước submit** (Mốc 6): UI xoá tài khoản (`DELETE /api/profile/me` đã có), App Privacy labels, quyết ATT (PostHog), `NSMicrophoneUsageDescription` (đã khai), screenshots, demo account, privacy-policy URL.

Backend đã sẵn cho IAP: `AppleIapController` (`/verify`,`/sync`,`/notifications`,`/account-token`,`/products`) + `AppleIapService` — chỉ chờ tạo product + ký client StoreKit (M5.4).
