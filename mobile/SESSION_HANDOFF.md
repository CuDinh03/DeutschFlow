# DeutschFlow Mobile — Session Handoff (2026-06-29)

Bàn giao để tiếp tục ở session sau. App Expo (`mobile/`) → deploy iOS App Store.
Nhánh: **`chore/ios-deploy-sdk54`** (CHƯA merge, CHƯA push, `main` nguyên vẹn).

---

## TL;DR — đang ở đâu (cập nhật 2026-06-29, cuối session)

- ✅ SDK 52→54, push/compliance, QA-fix — đã commit.
- ✅ **CRASH KHI MỞ APP — ĐÃ FIX** (`660c753a`). Root cause = redirect imperative (`router.replace` trong effect phụ thuộc `useRootNavigationState()`) → vòng lặp re-render vô hạn ở `@react-navigation/core` useSyncState. Fix = `<Redirect>` khai báo ở `app/index.tsx` + bỏ `useRootNavigationState` khỏi root layout. Verified dev build: app mở tới login, 0 loop. (Chi tiết mục dưới.)
- ✅ **RESKIN v2 "Galerie" — XONG 24/24 màn** (`95938161` = 5 màn cosmetic cuối qua workflow restyle+adversarial-review). Toàn bộ app editorial.
- ✅ **expo-av → expo-audio — XONG** (`e9f935ff`). Bỏ expo-av (deprecated, mất ở SDK 55). Migrate playback (createAudioPlayer) + recording (useAudioRecorder hook). Native rebuild compile + launch OK. (⚠️ behavior record/play CHƯA QA trên device đăng nhập.)
- ✅ **EAS preview build XANH + VERIFY** — build `30ec9041` (simulator) FINISHED ~8'. Đã `eas build:run` cài bản RELEASE standalone (no Metro) vào Simulator → **mở sạch tới màn login v2, KHÔNG crash** (process alive, 0 crash report mới). ⇒ crash render-loop đã hết Ở CẢ RELEASE (không chỉ dev red-box); reskin + expo-audio chạy chung OK. Artifact: https://expo.dev/accounts/cudinh3502/projects/deutschflow/builds/30ec9041-7b63-4fb3-9908-3dc4ef46c46a
- ⏳ Next = Pha 5 production build/TestFlight/submit. Việc 👤: APNs key + Sentry re-add + 3 giá trị `eas.json submit` (appleId/ascAppId/appleTeamId) + Privacy/Support URL. + device QA cho audio (record/play).

---

## ✅ VIỆC #1 — Fix crash khi mở app (render loop) — ĐÃ XONG (`660c753a`)

**KẾT QUẢ:** Đã reproduce trên dev build (`npx expo run:ios`), bisect ra chính xác nguyên nhân, fix, và verify app mở được tới màn login (screenshot OK, 0 loop). Tóm tắt cho người sau:

**Root cause (đã chứng minh bằng bisect trên dev build):**
- KHÔNG phải zustand selector / màn restyle / NativeWind / Sentry / expo-av. componentStack toàn framework wrapper (ExpoRoot `Content`/`SafeAreaProvider`) nên đọc code màn KHÔNG ra.
- Thủ phạm = **redirect imperative trong `app/_layout.tsx`**: `useEffect` gọi `router.replace('/(auth)/login')` với dep `rootNavState?.key` (từ `useRootNavigationState()`). `router.replace` đổi nav-state → `useRootNavigationState` re-render root layout → re-render navigator → re-sync nav-state → **lặp vô hạn** → `@react-navigation/core` useSyncState ném `Maximum update depth exceeded`. Ở React 19 release/Hermes = FATAL.
- Bisect: bỏ redirect (giữ hook) → hết loop; thêm lại redirect (kể cả ref-guard fire-once) → loop lại. ⇒ chính cặp **hook (subscribe nav-state ở root) + redirect (perturb nav-state)** tạo feedback loop.

**Fix (`660c753a`):**
- MỚI `app/index.tsx`: gate auth **khai báo** — `if (isLoading) return null; return <Redirect href={isLoggedIn ? '/(student)' : '/(auth)/login'} />`.
- `app/_layout.tsx`: **bỏ `useRootNavigationState()` + bỏ redirect effect**; `appReady = fontsReady && !isLoading` (bỏ `rootNavState?.key`). Root layout không còn subscribe nav-state → hết amplifier.
- Tiện thể **gỡ NativeWind** (babel jsxImportSource + nativewind/babel, metro withNativeWind, import `global.css`) — app dùng 0 `className` (toàn inline style + lib/theme); css-interop wrap mọi JSX là risk thừa trên New Arch. (NativeWind KHÔNG phải nguyên nhân crash — đã loại trừ bằng test.)
- ⚠️ Lưu ý: bỏ redirect ở root layout nghĩa là **chỉ `/` được gác auth** (qua index.tsx); route protected khác khi logout dựa vào interceptor 401→login (`lib/api.ts`) + gating từng màn. Đủ cho hiện tại.

**Verify đã chạy:** `npx expo run:ios` (dev build, Simulator iPhone 16 Pro) → app mở tới **màn login v2 Galerie** (warm-paper + Newsreader serif + nút vàng), Metro log 0 `Maximum update depth`. tsc 0, jest 18/18.

**CÒN LẠI (👤 nên làm để chốt):** **rebuild EAS preview** (hoặc dev build) để xác nhận trên **release** build (dev đã chứng minh loop biến mất ở tầng JS nên release cũng hết; rebuild chỉ để chốt + lấy artifact). Nên gộp với phần reskin 8 màn + migrate expo-av rồi build 1 lần.

### Gotcha QUAN TRỌNG — pod install / dev build local
- `npx expo run:ios` (và `pod install`) FAIL với `Encoding::CompatibilityError ... ASCII-8BIT` = shell non-interactive thiếu UTF-8 locale (Ruby 4 + CocoaPods 1.16). **FIX: `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` trước khi chạy.** Đây là lý do "chạy tay trong terminal thì ổn".
- Build local FAIL ở `[CP] Copy Pods Resources` với `Sandbox: bash deny(1) file-write-create .../resources-to-copy-DeutschFlow.txt` = Xcode 16 **User Script Sandboxing** (project prebuild sinh `ENABLE_USER_SCRIPT_SANDBOXING = YES`) chặn script ghi manifest. **FIX local: `sed -i '' 's/ENABLE_USER_SCRIPT_SANDBOXING = YES;/ENABLE_USER_SCRIPT_SANDBOXING = NO;/g' ios/DeutschFlow.xcodeproj/project.pbxproj`** rồi rebuild (ios/ gitignore → mất sau mỗi prebuild, sed lại). **EAS KHÔNG bị** (toolchain cloud OK — các build EAS trước chạy tốt). Nếu muốn fix vĩnh viễn: config-plugin `withXcodeProject` set NO.
- Reload dev khi đang debug loop: app kẹt loop → HMR/cold-relaunch KHÔNG nhận code mới (serve bundle cũ). Mỗi lần đổi code phải **restart Metro `--clear`** (`npx expo start --dev-client --clear`) rồi cold-launch app (`xcrun simctl openurl <udid> "exp+deutschflow://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"`). Marker `console.log` để xác nhận bundle fresh.

---

## (cũ — để tham khảo) Triệu chứng & chẩn đoán ban đầu

**Triệu chứng:** EAS build OK → cài vào Simulator → mở lên **crash về home screen** (process tắt).

**Đã chẩn đoán chính xác** (qua crash log + EAS log):
- 2 lỗi crash riêng biệt, đã xử lý lỗi #1, còn lỗi #2:
  1. ~~`SIGABRT` trên `com.meta.react.turbomodulemanager.queue`~~ → **Sentry** (`@sentry/react-native@7.2.0`) crash native TurboModule trên New Architecture. **ĐÃ FIX** = gỡ Sentry (commit `43917cc4`).
  2. **CÒN LẠI:** `SIGSEGV` trên thread `com.facebook.react.runtime.JavaScript`:
     ```
     Unhandled JS Exception: Maximum update depth exceeded.
     componentStack: at Content → SafeAreaEnv → SafeAreaProvider
                     → SafeAreaProviderShim → LinkPreviewContextProvider → …
     ```
     = **một component re-render vô hạn** (gọi setState liên tục). Ở **React 19 release/Hermes lỗi này FATAL** (ở dev chỉ là red-box, app vẫn chạy → nên trước đó không thấy). Crash xảy ra ~0.65s sau khi mở, **ngay sau 1 request API** (TLS tới api) → nhiều khả năng ở màn đầu tiên render sau khi auth/data load, hoặc ở `app/_layout.tsx`.

**Cách fix (DÙNG XCODE / dev build để lấy đúng file:line):**
> Crash log release chỉ cho số dòng bundle đã minify (`main.jsbundle:145132`), không ra source. **Bản dev sẽ hiện red-box trỏ thẳng `app/(student)/xxx.tsx:NN`.**

```bash
cd /Users/dinhcu/Developer/DeutschFlow/mobile
npx expo run:ios          # prebuild + pod install + build debug + Metro + launch
# (hoặc: npx expo prebuild --clean -p ios  → mở ios/DeutschFlow.xcworkspace trong Xcode → Run)
```
- Khi app mở (dev), **red-box "Maximum update depth exceeded"** sẽ liệt kê component-stack trỏ tới SOURCE → tên component + file + dòng gây loop.
- ⚠️ Lần mình tự chạy `pod install` qua script đã FAIL (`verify_podfile_exists!` — workspace chưa sinh). **Chạy trong Xcode/terminal tay sẽ ổn** (môi trường iOS của bạn đã có sẵn).

**Nghi vấn ưu tiên soi (loop ở gần root):**
- `app/_layout.tsx` — các `useEffect` redirect/auth bootstrap + `setSubscriptionTier(planTier)` + splash `setSplashDone`. Kiểm xem có effect nào setState mà dep thay đổi mỗi render.
- Màn đầu tiên render (Home `index.tsx`) hoặc component dùng selector zustand trả về **object/array mới mỗi lần** (`useStore(s => ({...}))` / `.filter()` / `.map()` trong selector) → loop kinh điển.
- 16 màn vừa restyle bởi agent (commit `83b068ca`) — 1 agent có thể đã thêm setState-in-render hoặc effect thiếu deps. Sau khi red-box chỉ ra file, sửa đúng chỗ đó.

**Sau khi fix:** rebuild lại preview để xác nhận app mở được + xem giao diện v2:
```bash
cd /Users/dinhcu/Developer/DeutschFlow/mobile
export EXPO_ASC_API_KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_FADUS86X4V.p8"
export EXPO_ASC_KEY_ID="FADUS86X4V"
export EXPO_ASC_ISSUER_ID="c32647c2-006c-4e10-be92-0a3bfd5dab4f"
npx eas-cli@latest build -p ios --profile preview --no-wait
# build xong: npx eas-cli@latest build:run -p ios --latest   (cài vào Simulator)
```

---

## Commits trên nhánh (mới → cũ)

| Commit | Nội dung |
|---|---|
| `e9f935ff` | feat: **migrate expo-av → expo-audio** (3 file: speaking/weekly-speaking/VideoLessonPlayer + app.json plugin + bỏ expo-av) |
| `95938161` | feat: **restyle 5 màn cosmetic cuối** v2 Galerie (classes×2, settings/profile, weekly-detail, assignments/[id]) → 24/24 xong |
| `8f624b02` | docs: handoff — render-loop fixed |
| `660c753a` | fix: **render-loop crash** → `<Redirect>` khai báo (`app/index.tsx`) + bỏ `useRootNavigationState`/redirect khỏi root layout; gỡ NativeWind unused |
| `43917cc4` | fix: **gỡ Sentry** (crash New-Arch TurboModule) |
| `7d875427` | fix: **re-include `mobile/assets/*` trong root `.gitignore`** (EAS rớt icon) |
| `83b068ca` | Pha 4.3 — restyle 15 màn student v2 |
| `43984387` | Pha 4.3 — restyle Home (pattern chuẩn) |
| `0901d118` | Pha 4.2 — AppHeader editorial |
| `9a0b8e51` | Pha 4.2 — Pill/Card/Caption/YellowSquare |
| `0e26f021` | Pha 4.1 — tokens + fonts (warm-paper/serif/sharp) |
| `a1f96655` | QA fix 14 HIGH correctness |
| `a87b741a` | Pha 3 — compliance (perms, privacy, Sentry*, ErrorBoundary) |
| `8340e3aa` | Pha 2 — push (projectId, aps-env, auth-gate) |
| `23148f10` | Pha 1 — Expo SDK 52→54 |
| `b0111217` | Pha 0 — audit + plan + baseline |
> *Sentry ở `a87b741a` đã bị gỡ ở `43917cc4`.

---

## ĐÃ LÀM

### Pha 1 — SDK 52→54 (`23148f10`)
expo 54.0.35 · RN 0.81.5 · React 19.1 · expo-router 6 · **Reanimated 4.1.7 + react-native-worklets 0.5.1**. Breaking đã xử lý: babel bỏ hack reanimated (để babel-preset-expo inject worklets), `expo-file-system/legacy` trong speaking, metro bỏ `unstable_enablePackageExports`, expo-notifications `shouldShowAlert`→`shouldShowBanner`+`shouldShowList`, bỏ `android.usesCleartextTraffic`. `.npmrc` `legacy-peer-deps=true`. **expo-av GIỮ** (bản 16) → nợ migrate Pha 4. Chi tiết: `UPGRADE_BASELINE.md`.

### Pha 2 — Push (`8340e3aa`)
`eas init` → projectId thật. `usePushNotifications`: log `__DEV__` + **gate token POST trên `isLoggedIn`** (tránh 401→logout). `aps-environment` sinh từ prebuild. Backend `POST /api/profile/me/push-token` đã verify khớp. KHÔNG thêm `UIBackgroundModes`.

### Pha 3 — Compliance (`a87b741a`)
Bỏ camera/speech permission (chỉ Microphone) · `supportsTablet=false` · suppress `NSFaceIDUsageDescription` (`["expo-secure-store",{faceIDPermission:false}]`) · `ios.privacyManifests` (PostHog) · ErrorBoundary (Expo Router, màn lỗi tiếng Việt) · `eas.json` submit placeholder. **Sentry đã gỡ** (xem trên).

### QA + fix (`a1f96655`)
QA toàn bộ 24 màn → **181 findings** (0 CRITICAL / 25 HIGH / 59 MEDIUM / 97 LOW), report `QA_SCREENS_AUDIT.md`. Đã fix **14 HIGH correctness**: error/empty states, notifications invalidate `['unread-count']`+onError, srs review onError, **exam-attempt back-guard**, speaking timer+safe-area, weekly mic-cleanup, edit-profile validate, KeyboardAvoidingView (node-practice/assignments/classes-join). **8 HIGH a11y + 59 MEDIUM** cố ý DỜI sang Pha 4 (làm trong shared components).

### Pha 4 — Reskin v2 "Galerie"
**Quyết định:** light-only warm-paper + faithful (Newsreader serif + Instrument Sans + sắc 4px). Design v2 ở `mobile/design/v2/native/na-*.jsx`.
- ✅ **4.1** (`0e26f021`): `lib/theme` remap (warm-paper light-only, fonts Newsreader/InstrumentSans, radius 4px, type serif) — **giữ nguyên mọi token KEY** nên không vỡ. Thêm `inkSurface/onInk/onInkMuted`.
- ✅ **4.2** (`9a0b8e51`,`0901d118`): Pill editorial (sharp uppercase +solid), Card 4px, MỚI `Caption`+`YellowSquare`, AppHeader chevron 44pt. **TabBar đã sẵn Liquid Glass** từ v1.
- 🔄 **4.3** — **16/24 màn restyle xong** (Home + 15): home·roadmap·vocabulary·srs·learn·grammar·node·node-practice·exam·exam-attempt·exam-review·notifications·profile·stats·upgrade·guide.

---

## ĐÃ XONG trong session này (2026-06-29)
- ✅ **Crash render-loop** (việc #1) — `660c753a`.
- ✅ **4.3 reskin 24/24** — 5 màn cosmetic cuối `95938161` (qua workflow restyle+adversarial-review, 5/5 approve, 0 render-loop risk).
- ✅ **expo-av → expo-audio** — `e9f935ff` (3 file, KHÔNG cần expo-video vì "video lesson" = ảnh + audio narration). Native rebuild compile + launch OK.

## CHƯA LÀM (còn nợ)

### Nợ Pha 4 khác
- **8 HIGH a11y** + 59 MEDIUM từ QA (làm trong shared components: extract Chip/IconButton/SelectableRow + 44pt + roles).
- `withAlpha()` helper thay hex-alpha string-concat, `TAB_BAR_CLEARANCE` chung.
- **Re-add Sentry** đúng cách (thử bản mới hơn / cấu hình New-Arch, test trên device trước khi tin).
- **Device QA cho audio** (👤): expo-audio record/playback CHƯA test runtime (cần đăng nhập + mic). Code đúng API + compile + launch OK; nhưng nên test thật: AI Speaking (record→transcribe + TTS playback), Weekly Speaking (record), Video Lesson (narration playback).

### Pha 5 — Build·TestFlight·Submit (chưa bắt đầu)
- 🔄 EAS **preview** đang chạy (`30ec9041`) — chờ xanh.
- Sau đó: EAS build **production** → eas submit → TestFlight → metadata → review. Cần 👤: APNs key, 3 giá trị `eas.json submit` (appleId/ascAppId/appleTeamId), Privacy Policy + Support URL.

---

## EAS / Build

- **Project:** `@cudinh3502/deutschflow` · **projectId** `26fa9e21-f563-4891-953e-e00c704c3c6b`.
- **Apple auth = ASC API Key** (KHÔNG cần password Apple):
  - file: `~/.appstoreconnect/private_keys/AuthKey_FADUS86X4V.p8` (perms 600)
  - **Key ID** `FADUS86X4V` · **Issuer ID** `c32647c2-006c-4e10-be92-0a3bfd5dab4f`
  - dùng qua env: `EXPO_ASC_API_KEY_PATH` / `EXPO_ASC_KEY_ID` / `EXPO_ASC_ISSUER_ID`
  - ⚠️ key role **Admin** + nội dung từng hiện trong transcript → cân nhắc **revoke + tạo lại role App Manager**.
- **Lịch sử build:**
  - `902ec94a` ERRORED — root `.gitignore` `*.png` rớt icon → **FIXED** `7d875427`.
  - `337ba379` FINISHED nhưng crash launch (Sentry SIGABRT) → **FIXED** `43917cc4`.
  - `7dfa3b3d` FINISHED nhưng crash launch (render loop) → **OPEN** (việc #1).
- **Đọc log EAS** (khi build lỗi): `npx eas-cli@latest build:view <id> --json` → field `logFiles[0]` là URL GCS (signed, hết hạn 15') → `curl` về rồi **`brotli -dc`** (log nén brotli, KHÔNG phải gzip).

### 👤 Việc tay của bạn (chưa làm)
- **APNs Key (.p8)** cho push trên TestFlight (EAS có thể tự tạo khi `eas build` lần đầu device-build; hoặc Apple Developer → Keys → APNs → `eas credentials`).
- Tạo **Sentry project** (nếu muốn re-add): DSN + org/project + `eas secret SENTRY_AUTH_TOKEN`.
- Điền 3 giá trị thật `eas.json` > submit.production.ios (appleId / ascAppId / appleTeamId).
- **Privacy Policy URL** + **Support URL** (App Store Connect).
- ASC privacy questionnaire: cân nhắc "linked to identity" vì PostHog `identify()`.

---

## Gotchas / bài học (quan trọng cho session sau)

1. **EAS build từ git SUBDIR:** repo ở `DeutschFlow/`, app ở `mobile/`. EAS upload cả repo, build trong `build/mobile/`. **EAS loại file khớp `.gitignore` kể cả file đã track** → root `.gitignore` có `*.png`/`*.jpg`/`*.jpeg` từng rớt mất icon. Negation `!mobile/assets/**` (commit `7d875427`) PHẢI giữ.
2. **Sentry `@7.2.0` + New Arch + SDK 54 = crash native** (TurboModule SIGABRT). Đã gỡ. Re-add phải test device.
3. **React 19 release/Hermes:** `Maximum update depth exceeded` là **FATAL** (dev chỉ red-box). Render-loop bug không bị bắt bởi tsc/jest/`expo export` (chúng không EVAL runtime).
4. EAS dùng **Node 20.19.4**; máy local Node 25.
5. Lockfile đã sync; `.npmrc legacy-peer-deps=true`. Đã hoist `promise@8.3.0` + `babel-preset-expo` (un-hoist sau upgrade).
6. `ios/` là gitignore → EAS tự prebuild. `expo export -p ios` để verify bundle (không EVAL).
7. Token KEY trong `lib/theme` giữ nguyên qua reskin → đừng đổi tên key, chỉ đổi value.

---

## Verify nhanh (mọi cổng đang xanh trước crash runtime)
```bash
cd mobile
npx tsc --noEmit        # 0
npm test                # jest 18/18
npx expo-doctor         # 18/18 (local)
npx expo export -p ios  # bundle OK (KHÔNG eval → không bắt được render loop)
```

## Tài liệu liên quan trong repo
`mobile/IOS_DEPLOY_PLAN.md` · `mobile/IOS_DEPLOY_AUDIT.md` · `mobile/UPGRADE_BASELINE.md` · `mobile/QA_SCREENS_AUDIT.md` · `mobile/design/v2/native/na-*.jsx` (design source).
