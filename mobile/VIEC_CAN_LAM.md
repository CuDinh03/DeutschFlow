# Việc cần làm — nhánh `chore/ios-deploy-sdk54`

> Cập nhật: **2026-07-01**. App = Expo React Native ở `mobile/` (KHÁC app SwiftUI native ở `ios/`).
> Đây là danh sách việc CÒN LẠI, ưu tiên từ trên xuống. 👤 = cần bạn (tài khoản/quyết định Apple) · 🤖 = tôi chạy được.
> Trạng thái "đã làm" chi tiết: xem `mobile/SESSION_HANDOFF.md`. Runbook deploy: `mobile/DEPLOYMENT.md` (local).

---

## 0. Đang ở đâu (TL;DR)

- Nhánh `chore/ios-deploy-sdk54`: **71 commit** trên `main` (tách 2026-06-25), **~86% mobile**. **Đã push remote.**
- App **sẵn sàng kỹ thuật** để build production: EAS preview build đã xanh, bản release standalone mở sạch tới login, **0 crash**.
- Đã xong: SDK 52→54 · push plumbing · compliance · **reskin v2 "Galerie" 24/24 màn** · 3 crash launch · expo-av→expo-audio · a11y screen-reader toàn app · **Skill Tree "Cây học tập"** · **Notifications realtime + nội dung** (PR #176) · **định danh iOS** bundle id + Team ID (PR #178).
- PR: **#176 MERGED**, **#178 MERGED** (đều vào nhánh này) · **#177 DRAFT → main** (tracking, ĐỪNG merge thẳng).
- **Việc còn lại để LÊN STORE đều cần bạn ra hiệu** (tài khoản Apple). Sau đó tôi chạy build/submit được.

---

## 1. ƯU TIÊN CAO — Đưa lên TestFlight → App Store

### 1.1 👤 Cần bạn làm (Apple — tôi không làm thay được)
- [ ] **APNs Key (.p8)** để push chạy trên TestFlight/Store. Apple Developer → Keys → tạo key APNs, hoặc `eas credentials` (chọn iOS → Push Notifications).
- [ ] **`eas.json` > submit.production.ios** — hiện chỉ có `appleTeamId: 4M3CU3X9SS` (đã set ở PR #178).
  - Cân nhắc thêm **`ascAppId`** = `6785281013` (app record "MyDeutschFlow") để `eas submit` nhắm đúng app. (Auth submit dùng ASC API Key → **không cần** `appleId`/password.)
- [ ] **Privacy Policy URL** + **Support URL** (bắt buộc trên App Store Connect khi submit).
- [ ] **ASC privacy questionnaire**: cân nhắc khai "Data linked to identity" vì PostHog gọi `identify()`.
- [ ] **(Bảo mật) Cân nhắc revoke + tạo lại ASC API Key** với role **App Manager** thay vì Admin — Key ID/Issuer ID từng hiện trong transcript và đang nằm trong `SESSION_HANDOFF.md` (đã commit). Giá trị nhạy cảm: xem `mobile/DEPLOYMENT.md` §2 (local).

### 1.2 🤖 Tôi chạy được (khi có giá trị mục 1.1)
- [ ] **Pha 5 — production build & submit**: `eas build -p ios --profile production` → `eas submit` → TestFlight → điền metadata → gửi review.
- [ ] **Backend redeploy** để phần **render nội dung notification + Expo push** có hiệu lực trên prod (KHÔNG cần migration DB — render khi đọc).
- [ ] **Bật SSE đa node** trên prod (khi chạy nhiều instance sau load balancer): đặt env **`APP_NOTIFICATION_SSE_REDIS_PUBSUB=true`** (Redis phải reachable). Mặc định off = single-node an toàn.

---

## 2. ƯU TIÊN TRUNG BÌNH — QA trên thiết bị thật & hoàn thiện

### 2.1 👤/🤖 Device QA (cần thiết bị đăng nhập thật)
- [ ] **Audio** (chưa QA runtime): AI Speaking, Weekly Speaking, Video Lesson narration — record/playback qua `expo-audio` mới (API + compile + launch đã đúng; I/O mic/loa cần test thật).
- [ ] **Push thật** (sau khi có APNs key): nhận push foreground/background, badge cập nhật, tap mở inbox.
- [ ] **Notifications realtime** end-to-end: SSE badge cập nhật tức thì; nội dung title/body hiển thị đúng mọi loại.
- [ ] **Skill Tree gestures thật**: pinch 2 ngón thật (mới test simulator), pan/zoom/tap→sheet, share "Khoe cây".
- [ ] **Android QA**: emoji skill tree, layout, behavior (app cũng chạy Android).

### 2.2 🤖 Hoàn thiện
- [ ] **Re-add Sentry** đúng cách (bản mới / cấu hình New-Arch) — **test trên device trước khi tin** (bản cũ @7.2 crash New-Arch). Cần: Sentry project (DSN + org/project) + `eas secret SENTRY_AUTH_TOKEN` + bỏ `SENTRY_DISABLE_AUTO_UPLOAD` trong `eas.json`.
- [ ] **Skill Tree — mục còn nợ:**
  - Cosmetic/độc lập: pinch real-finger; ảnh share quá cao; RecRing spin còn tĩnh; emoji Android.
  - Gated (cần backend/quyết định): skill-leaves (§4.4), topic-limb regroup (§8 Q2), "Lên cấp" ritual + LevelUpBanner (H4), per-skill branch labels, growth-stage preview.

---

## 3. ƯU TIÊN THẤP — Dọn dẹp kỹ thuật

- [ ] **Gỡ hẳn NativeWind**: wiring đã gỡ; còn dep `nativewind`/`tailwindcss` + file mồ côi `global.css`/`tailwind.config.js`. App dùng 0 `className`.
- [ ] **a11y mở rộng**: (a) cue phi-màu cho người nhìn bị color-blind (state đã announce cho VoiceOver); (b) extract `SelectableChip`/`SelectableRow` (DRY); (c) policy `maxFontSizeMultiplier` trên `ThemedText` (Dynamic Type).
- [ ] **Tiện ích nhỏ**: `withAlpha()` helper thay hex-alpha concat; `TAB_BAR_CLEARANCE` chung.
- [ ] **Dọn nhánh đã merge**: `feat/notifications-realtime-content`, `chore/ios-deploy-config` (local + remote) — đã merge, xoá cho gọn.

---

## 4. Quyết định git/branch còn treo

- [ ] **Merge `chore/ios-deploy-sdk54` → `main`**: khi nào? (gợi ý: sau khi TestFlight chạy ổn). PR #177 hiện là **draft stacked 66 commit** — đừng merge thẳng; nên merge cả nhánh ios-deploy một lần khi sẵn sàng.
- [ ] **`mobile/DEPLOYMENT.md`**: đã quyết **giữ local** (`.git/info/exclude`), không commit (chứa ASC Key ID/Issuer ID + email). Lưu ý `SESSION_HANDOFF.md` (đã commit) vẫn chứa các giá trị này — cân nhắc redact nếu lo lộ.

---

## 5. Lệnh hay dùng (trích `SESSION_HANDOFF.md` §6–7 + `DEPLOYMENT.md`)

**Verify nhanh (gate xanh):**
```bash
cd mobile
npx tsc --noEmit      # 0 lỗi
npm test              # jest xanh
npx expo-doctor
```

**EAS build + cài Simulator (cần export ASC API key — giá trị ở DEPLOYMENT.md §2 local):**
```bash
cd mobile
export EXPO_ASC_API_KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_XXXX.p8"
export EXPO_ASC_KEY_ID="..."  EXPO_ASC_ISSUER_ID="..."
npx eas-cli@latest build -p ios --profile preview --no-wait   # simulator
npx eas-cli@latest build:run -p ios --latest                  # download + cài + launch
npx eas-cli@latest build:view <id> --json                     # status/artifact
```

**Production → TestFlight:**
```bash
cd mobile
npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest submit -p ios --latest
```

**Đọc log EAS lỗi:** `build:view <id> --json` → `logFiles[0]` (URL hết hạn ~15') → `curl` → **`brotli -dc`** (nén brotli, KHÔNG gzip).

---

## 6. ⚠️ Gotchas BẮT BUỘC nhớ (đầy đủ ở `SESSION_HANDOFF.md` §6)

1. **Render-loop fatal ở React 19 release/Hermes** chỉ red-box ở **dev build**; tsc/jest/`expo export` KHÔNG bắt. Debug = `npx expo run:ios` lấy red-box → bisect. **Tránh redirect imperative trong root layout** (dùng `<Redirect>` khai báo ở `app/index.tsx`).
2. **Build/pod local lỗi locale** `Encoding::CompatibilityError ASCII-8BIT` → `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` trước khi chạy.
3. **Build local lỗi sandbox** `[CP] Copy Pods Resources ... deny file-write` → `sed -i '' 's/ENABLE_USER_SCRIPT_SANDBOXING = YES;/...= NO;/g' ios/DeutschFlow.xcodeproj/project.pbxproj` (mất sau mỗi prebuild). **EAS không bị.**
4. **EAS loại file khớp `.gitignore`** kể cả đã track → negation `!mobile/assets/**` trong root `.gitignore` PHẢI giữ (nếu không rớt app icon → build ERRORED).
5. **Sentry @7.2 + New Arch = crash native** (TurboModule SIGABRT) → re-add phải test device.
6. **expo-av deprecated** (mất ở SDK 55) → đã migrate expo-audio; recording là **hook-only** (`useAudioRecorder`).
7. **Notification SSE contract**: nếu đổi event name/format ở `NotificationSseBroadcaster`, phải sửa cả `frontend/.../notificationStream.ts` + 2 test (BE `NotificationSseBroadcasterUnitTest` + FE `notificationStream.test.ts`).
8. **Thêm loại notification mới**: chỉ cần thêm case vào `backend/.../NotificationContentRenderer.render()` — server cấp title/body cho mọi surface + push. KHÔNG xoá enum chết (`@Enumerated(STRING)` fail deserialize row cũ).

---

## 7. Tài liệu liên quan trong repo
`mobile/SESSION_HANDOFF.md` (trạng thái đã-làm/chưa-làm) · `mobile/DEPLOYMENT.md` (runbook, local) · `mobile/IOS_DEPLOY_PLAN.md` · `mobile/QA_SCREENS_AUDIT.md` · `mobile/A11Y_PASS.md` · `mobile/SKILL_TREE.md` (kiến trúc cây) · `mobile/design/v2/native/na-*.jsx` (design source).
