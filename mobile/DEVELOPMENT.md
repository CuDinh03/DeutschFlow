# DeutschFlow Mobile — Hướng dẫn phát triển

> Tài liệu chuẩn cho việc phát triển & phát hành app mobile. Committable (không chứa secret).
> Giá trị nhạy cảm (ASC API Key…) nằm ở `mobile/DEPLOYMENT.md` (local-only, git-ignored).
> Cập nhật lần cuối: 2026-07-01.

---

## 0. App này là gì

- **Expo React Native** (SDK 54, RN 0.81.5, expo-router 6, New Architecture bật) ở thư mục `mobile/`.
- Đây là app iOS **và** Android chính thức. **KHÁC** app SwiftUI native ở `ios/` (đã retire — xem lịch sử repo).
- Backend Spring Boot ở `backend/`; web Next.js ở `frontend/`. Mobile gọi cùng API backend.
- Stack chính: `expo-router` (điều hướng theo file), `@tanstack/react-query` (server state), `expo-secure-store` (token), `posthog-react-native` (analytics), `expo-updates` (OTA).
- Định danh: iOS bundle `com.cudinh.mydeutschflow` · Android package `com.deutschflow.app`.
- EAS: owner `cudinh3502` · slug `deutschflow` · projectId `26fa9e21-f563-4891-953e-e00c704c3c6b`.

---

## 1. Yêu cầu & chạy local

```bash
cd mobile
npm install                 # cài deps

# chạy dev (Metro + Expo Dev Client / Expo Go tuỳ native deps)
npm start                   # = expo start
npm run ios                 # = expo run:ios  (build dev native + chạy simulator)
npm run android             # = expo run:android
```

> Vì app có native deps (expo-audio, image-picker, updates…), **không chạy được trên Expo Go**; dùng **dev build** (`expo run:ios` / EAS `development` profile).

**Lỗi build local hay gặp (EAS không bị):**
- Locale `Encoding::CompatibilityError ASCII-8BIT` → `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` trước khi build.
- Sandbox `[CP] Copy Pods Resources … deny file-write` → tắt sandbox trong pbxproj:
  `sed -i '' 's/ENABLE_USER_SCRIPT_SANDBOXING = YES;/ENABLE_USER_SCRIPT_SANDBOXING = NO;/g' ios/DeutschFlow.xcodeproj/project.pbxproj` (mất sau mỗi prebuild).

---

## 2. Cấu trúc thư mục

```
mobile/
├── app/                 # routes (expo-router, file-based)
│   ├── (auth)/          #   luồng đăng nhập/đăng ký
│   ├── (student)/       #   app học viên (roadmap, node, srs, stats, classes, messages, class-chat…)
│   ├── _layout.tsx      #   root layout (redirect khai báo ở app/index.tsx — XEM Gotcha §9.1)
│   └── index.tsx
├── lib/                 # API clients typed (skillTreeApi, messagesApi, classChannelApi, studentClassesApi…)
├── components/          # UI dùng chung (components/ui: Screen/Card/ThemedText/Button/Pill/EmptyState/ErrorState…)
├── hooks/               # custom hooks (usePushNotifications, useTreeGestures…)
├── stores/              # client state
├── __tests__/           # jest (unit cho lib/ + logic)
├── assets/              # icon/splash — GIỮ negation !mobile/assets/** ở root .gitignore (XEM Gotcha §9.2)
├── app.json             # cấu hình Expo (version, updates, runtimeVersion, plugins, permissions)
├── eas.json             # profiles build/submit + channels OTA
└── ios/                 # SINH RA từ prebuild — git-ignored, ĐỪNG sửa tay (sửa qua app.json)
```

Nguyên tắc: bám **design system** (`components/ui` + `lib/theme`), không hardcode màu hex. Mỗi màn có fetch phải đủ **loading / error (ErrorState + retry) / empty**.

---

## 3. Cổng chất lượng (chạy TRƯỚC mỗi commit/PR)

```bash
cd mobile
npx tsc --noEmit      # 0 lỗi type
npm test              # jest xanh (hiện 87 test / 12 suite)
npx expo-doctor       # 18/18 checks pass
```

Cả 3 phải xanh mới coi là xong. **Lưu ý:** tsc/jest/`expo export` **KHÔNG** bắt được lỗi render-loop runtime (§9.1) — với thay đổi luồng điều hướng phải test thêm dev build thật.

---

## 4. Quy ước commit & branch

Theo `CONTRIBUTING.md` (root): **Conventional Commits** `<type>(<scope>): <subject>` — types `feat/fix/refactor/chore/docs/test/perf/style/ci/security`. Branch: `main` (production), `feat/…`, `fix/…`, `chore/…`, `docs/…`. Không dùng commit kiểu `wip`/`update`/`deploy: …`.

---

## 5. Đánh version (iOS)

Hai số tách biệt — hiểu đúng để không bị App Store Connect từ chối:

| Trường | Là gì | Nguồn | Tự tăng? |
|---|---|---|---|
| **version** (`CFBundleShortVersionString`) | Số user thấy trên App Store | `app.json` `expo.version` | ❌ Không. **Bump tay** mỗi lần ra bản public. |
| **buildNumber** (`CFBundleVersion`) | Số build nội bộ | EAS server (remote) | ✅ Có. `eas.json` `cli.appVersionSource=remote` + `production.autoIncrement=true` |

- Mỗi `eas build -p ios --profile production` → buildNumber **tự +1** (2, 3, 4…), không phải đụng tay.
- **Marketing `version` không bao giờ tự tăng** — muốn user thấy bản mới thì sửa `app.json` `version` (semver: patch `1.0.1` = fix, minor `1.1.0` = tính năng, major `2.0.0` = lớn/breaking).
- Android `versionCode` cũng tự tăng nhờ cùng cấu hình khi build `-p android`.
- Baseline remote đã set 1 lần (`eas build:version:set -p ios` → 1). **KHÔNG cần** làm lại.
- ⚠️ ASC từ chối upload trùng cặp `(version, buildNumber)`. Nhờ autoIncrement nên không còn lo, miễn đừng tắt nó.

---

## 6. Build & submit (bản native — qua App Store)

Dùng khi có thay đổi **native** (§7 phân biệt), hoặc muốn ra bản public mới.

```bash
cd mobile
# (tuỳ) bump app.json "version" nếu ra bản user thấy mới
npx eas-cli build -p ios --profile production     # buildNumber tự +1
npx eas-cli submit -p ios --latest                # → TestFlight
```

- Auth submit dùng **ASC API Key** (không cần Apple ID/password). Nếu bị hỏi, export `EXPO_ASC_API_KEY_PATH` / `EXPO_ASC_KEY_ID` / `EXPO_ASC_ISSUER_ID` (giá trị ở `DEPLOYMENT.md §2`).
- Sau submit: Apple xử lý ~5–15' → hiện trong **TestFlight** → test → **Submit for Review** để lên App Store.
- **EAS build/submit KHÔNG nằm trong CI** — luôn chạy tay.
- Đọc log build lỗi: `eas build:view <id> --json` → `logFiles[0]` (URL hết hạn ~15') → `curl` → **`brotli -dc`** (nén brotli, không phải gzip).

**Còn cần (một lần) trước khi lên App Store công khai:** APNs Key `.p8` (push thật), Privacy Policy URL + Support URL, khai ASC privacy questionnaire (PostHog `identify()` → "Data linked to identity"). Xem `VIEC_CAN_LAM.md §1.1`.

---

## 7. Cập nhật OTA (EAS Update) — sửa nhỏ KHỎI build lại

Set up 2026-07-01: `expo-updates ~29`, `app.json` `updates.url` + `runtimeVersion.policy="fingerprint"`, `eas.json` channel theo profile (`development`/`preview`/`production`).

**Khi nào OTA được, khi nào phải build lại:**

| Loại thay đổi | Cách ship | Lệnh |
|---|---|---|
| **Chỉ JS/TS** (logic, UI, text, màu, fix bug RN) | ⚡ OTA — không cần Apple duyệt | `npx eas-cli update --channel production --message "sửa X"` |
| **Native** (thêm dep native, đổi permission/Info.plist, nâng SDK, đổi icon/splash, đổi plugin) | 🔁 Build + submit lại (§6) | `eas build … && eas submit …` |

- User mở app → tự check channel `production`, tải update nền, áp dụng ở lần mở kế.
- **Chính sách `fingerprint`:** update JS đến được **mọi build có native fingerprint không đổi** — kể cả sau khi bump `version`. Native đổi → fingerprint đổi → build cũ không nhận (đúng thiết kế: tránh JS gọi native chưa có).
- ⚠️ **OTA chỉ hoạt động từ build production làm SAU khi thêm `expo-updates`.** Bản `1.0.0 (1)` trên TestFlight (build trước khi có expo-updates) **không nhận OTA** — phải cut 1 build production mới (`1.0.0 (2)`) để kích hoạt.
- Xem lại lịch sử update: `eas update:list` · rollback: publish lại bản JS cũ.

---

## 8. Quan hệ với backend — **merge ≠ live**

- Backend **auto-deploy bị tắt cứng** (`.github/workflows/backend-ci.yml` `if:false`) → deploy **thủ công** `./deploy-backend.sh` (blue-green EC2). Migration Flyway chạy khi deploy.
- Thứ tự cho hạng mục đụng backend: **deploy backend TRƯỚC → rồi mới cut EAS build/OTA**. Đây là 2 bước riêng, không phải hệ quả của `git merge`.
- Chấm điểm/nghiệp vụ là **server-authoritative** — client gửi câu trả lời thô, đừng tin điểm client.

---

## 9. Gotchas BẮT BUỘC nhớ

1. **Render-loop fatal ở React 19 / Hermes** chỉ red-box ở **dev build**; tsc/jest/`expo export` KHÔNG bắt. **Tránh redirect imperative trong root layout** — dùng `<Redirect>` khai báo ở `app/index.tsx`. Debug = `npx expo run:ios` lấy red-box → bisect.
2. **EAS loại file khớp `.gitignore`** kể cả đã track → negation `!mobile/assets/**` ở root `.gitignore` PHẢI giữ (không thì rớt app icon → build ERRORED).
3. **expo-audio recording là hook-only** (`useAudioRecorder`); upload SDK 54 dùng `expo-file-system/legacy` (`uploadAsync`).
4. **Hợp đồng SSE notification:** đổi event name/format ở `NotificationSseBroadcaster` → phải sửa cả `frontend/.../notificationStream.ts` + test BE & FE. Thêm loại notification mới → chỉ thêm case ở `NotificationContentRenderer.render()` (server cấp title/body); **đừng xoá enum chết** (deserialize row cũ fail).
5. **`ios/` git-ignored** → EAS chạy prebuild sinh lại từ `app.json`. Sửa native (permission, plugin, version) ở **`app.json`**, không sửa `ios/Info.plist`/`project.pbxproj` (mất sau prebuild).
6. **Sentry @7.2 + New Arch = crash native** — nếu re-add Sentry phải test trên device trước khi tin.

---

## 10. Secrets

- **KHÔNG commit secret.** ASC API Key (Key ID/Issuer ID/`.p8`), giá trị nhạy cảm → ở `mobile/DEPLOYMENT.md` (git-ignored, local-only).
- Key nhúng client (PostHog key trong `app.json extra`) là public-key hợp lệ cho analytics — không phải secret.
- ASC API Key nên dùng role **App Manager** thay vì Admin.

---

## 11. Tài liệu liên quan

- `mobile/DEPLOYMENT.md` — runbook + giá trị secret (local-only).
- `mobile/VIEC_CAN_LAM.md` — việc còn lại + gotchas đầy đủ (§6).
- `mobile/KE_HOACH_HOAN_THIEN_MOBILE.md` — trạng thái tính năng P1–P7 (Rev 2: đã xong).
- `mobile/QA_SCREENS_AUDIT.md` · `mobile/A11Y_PASS.md` · `mobile/SKILL_TREE.md` · `mobile/SESSION_HANDOFF.md`.
- Root `CONTRIBUTING.md` (commit/branch) · `README.md` (sản phẩm).
