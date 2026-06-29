# DeutschFlow Mobile — Session Handoff & Trạng thái deploy iOS

> Tài liệu bàn giao đầy đủ: **ĐÃ LÀM** và **CHƯA LÀM** cho việc đưa app Expo (`mobile/`) lên App Store.
> Cập nhật: **2026-06-29**. App = Expo React Native ở `mobile/` (KHÁC app SwiftUI native ở `ios/`).
> Nhánh: **`chore/ios-deploy-sdk54`** — 24 commit, đứng trên `main`, **CHƯA merge, CHƯA push**. `main` nguyên vẹn.
> HEAD hiện tại: `d066a41a` (a11y screen-reader: student 24/24 + auth = 0 Pressable thiếu role trong app/).

---

## 1. TL;DR — đang ở đâu

App đã **sẵn sàng về mặt kỹ thuật** để build production. Tất cả blocker kỹ thuật đã xử lý xong + verify:

- ✅ **SDK 52 → 54** (expo 54, RN 0.81.5, React 19.1, New Architecture ON, Reanimated 4).
- ✅ **Push + Compliance + QA-fix** (Pha 1–3).
- ✅ **Reskin v2 "Galerie" — XONG 24/24 màn** (toàn bộ app editorial: warm-paper + Newsreader serif + sharp 4px).
- ✅ **3 crash launch đã fix hết** (icon gitignore, Sentry New-Arch, render-loop).
- ✅ **expo-av → expo-audio** (bỏ dep deprecated, bắt buộc trước SDK 55).
- ✅ **EAS preview build XANH + verify** trên Simulator (bản release mở sạch, không crash).

**Việc còn lại để LÊN STORE đều cần bạn (👤)** vì cần tài khoản/quyết định Apple: APNs key, 3 giá trị `eas.json` submit, Privacy/Support URL. Sau đó là Pha 5 (production build → TestFlight → submit) — tôi chạy được khi có các giá trị này.

---

## 2. ĐÃ LÀM (chi tiết theo pha)

### Pha 0 — Audit + plan (`b0111217`)
Audit + kế hoạch 5 pha. Tài liệu: `IOS_DEPLOY_PLAN.md`, `IOS_DEPLOY_AUDIT.md`, `UPGRADE_BASELINE.md`.

### Pha 1 — Expo SDK 52 → 54 (`23148f10`)
- expo `54` · RN `0.81.5` · React `19.1` · expo-router `6` · **Reanimated `4.1.7` + react-native-worklets `0.5.1`** · **New Architecture ON**.
- Breaking đã xử lý: babel bỏ hack reanimated (để `babel-preset-expo` tự inject worklets); thêm `react-native-worklets` + `babel-preset-expo` thành dep tường minh; `speaking.tsx` dùng `expo-file-system/legacy`; expo-notifications `shouldShowAlert`→`shouldShowBanner`+`shouldShowList`; bỏ `android.usesCleartextTraffic`; `.npmrc` `legacy-peer-deps=true`.

### Pha 2 — Push plumbing (`8340e3aa`)
- `eas init` → project `@cudinh3502/deutschflow`, **projectId `26fa9e21-f563-4891-953e-e00c704c3c6b`**.
- `usePushNotifications`: gate POST `/profile/me/push-token` trên `isLoggedIn` (tránh 401→logout) + log `__DEV__`.
- `aps-environment` sinh từ prebuild. Backend `POST /api/profile/me/push-token` khớp `{token,platform}`. KHÔNG thêm `UIBackgroundModes`.

### Pha 3 — Compliance (`a87b741a`)
- Bỏ camera/speech permission (chỉ Microphone) · `supportsTablet=false` · suppress `NSFaceIDUsageDescription` · `ios.privacyManifests` (PostHog) · ErrorBoundary Expo Router (màn lỗi tiếng Việt) · `eas.json` submit placeholder.
- ⚠️ Sentry thêm ở pha này nhưng **đã gỡ sau** (`43917cc4`) vì crash.

### QA + fix correctness (`a1f96655`)
QA toàn bộ 24 màn → 181 findings (0 CRITICAL / 25 HIGH / 59 MEDIUM / 97 LOW), report `QA_SCREENS_AUDIT.md`. Đã fix **14 HIGH correctness**: error/empty states, notifications invalidate `['unread-count']`+onError, srs review onError, exam-attempt back-guard, speaking timer+safe-area, weekly mic-cleanup, edit-profile validate, KeyboardAvoidingView.

### Pha 4 — Reskin v2 "Galerie" — **XONG 24/24 màn**
**Hướng (user chốt):** light-only warm-paper + faithful editorial (Newsreader serif + Instrument Sans + sắc 4px + ô vuông vàng + iOS26 Liquid Glass tab bar). Brand gold `#FFCD00` + red `#DA291C`. Design nguồn: `mobile/design/v2/native/na-*.jsx`.

- ✅ **4.1** (`0e26f021`): remap `lib/theme` (warm-paper light-only, fonts Newsreader/InstrumentSans, radius 4px). **Giữ nguyên mọi token KEY** → 24 màn không vỡ. Thêm `inkSurface/onInk/onInkMuted`.
- ✅ **4.2** (`9a0b8e51`, `0901d118`): Pill editorial, Card 4px, MỚI `Caption`+`YellowSquare`, AppHeader chevron 44pt. TabBar đã sẵn Liquid Glass.
- ✅ **4.3** (`43984387` Home reference + `83b068ca` 15 màn + `95938161` 5 màn cosmetic cuối): **TẤT CẢ 24 màn restyle editorial**. 5 màn cuối (classes/index, classes/[id], settings/profile, weekly-detail, assignments/[id]) làm qua **workflow restyle→adversarial-review** (5/5 approve, 0 render-loop risk, tsc 0, presentation-only). Vocabulary: `Caption` eyebrow + serif title + sharp Card + ink hero card + token `lib/theme`.

### 🔴→✅ Fix 3 crash launch
| Build | Triệu chứng | Fix |
|---|---|---|
| `902ec94a` ERRORED | root `.gitignore` `*.png` rớt icon (EAS loại file khớp gitignore kể cả đã track) | `7d875427` — negation `!mobile/assets/**` (PHẢI giữ) |
| `337ba379` crash launch | SIGABRT `com.meta.react.turbomodulemanager.queue` = **Sentry@7.2 crash native TurboModule trên New Arch** | `43917cc4` — gỡ Sentry (observability no-op) |
| `7dfa3b3d` crash launch | **render-loop `Maximum update depth exceeded`** (fatal React 19 release/Hermes) | `660c753a` — xem mục dưới |

#### ⭐ Render-loop crash (`660c753a`) — việc lớn nhất session này
- **Root cause** (bisect trên dev build `npx expo run:ios`): `app/_layout.tsx` redirect imperative — `useEffect` gọi `router.replace('/(auth)/login')` với dep `rootNavState?.key` (từ `useRootNavigationState()`). `router.replace` đổi nav-state → `useRootNavigationState` re-render root layout → re-render navigator → re-sync nav-state → **lặp vô hạn** → `@react-navigation/core` useSyncState ném `Maximum update depth exceeded`.
- **Vì sao khó tìm:** componentStack TOÀN framework wrapper (ExpoRoot `Content`/`SafeAreaProvider`), KHÔNG có tên màn nào → đọc code màn không ra. tsc/jest/`expo export` không EVAL nên không bắt.
- **Bisect chứng minh:** bỏ redirect (giữ hook) → hết loop; thêm lại redirect kể cả ref-guard fire-once → loop lại ⇒ cặp **hook-subscribe-navstate + redirect-perturb-navstate** = feedback loop.
- **Fix:** MỚI `app/index.tsx` = gate auth **khai báo** (`<Redirect href={isLoggedIn ? '/(student)' : '/(auth)/login'} />`); root layout BỎ `useRootNavigationState` + bỏ redirect effect (`appReady = fontsReady && !isLoading`). Root layout không còn subscribe nav-state → hết amplifier. Tiện thể **gỡ NativeWind** (unused, 0 `className`).
- **Verify:** dev build Simulator → mở tới login, 0 loop. (Và sau cùng: EAS release build cũng mở sạch — mục 6.)

### ✅ expo-av → expo-audio (`e9f935ff`)
- **KHÔNG cần expo-video** — "video lesson" thực ra là ảnh + audio narration (`VideoLessonPlayer` chỉ dùng `Audio.Sound`).
- 3 file: `speaking.tsx`, `weekly-speaking.tsx`, `components/video/VideoLessonPlayer.tsx`.
- Playback: `Audio.Sound.createAsync` → `createAudioPlayer()` + `player.play()`; `setOnPlaybackStatusUpdate` → `addListener('playbackStatusUpdate')` (`didJustFinish`); `unloadAsync` → `player.remove()`.
- Recording (hook-only): `Audio.Recording.createAsync` → `useAudioRecorder(RecordingPresets.HIGH_QUALITY)` + `prepareToRecordAsync()`/`record()`/`stop()`, `recorder.uri`.
- `setAudioModeAsync({allowsRecording, playsInSilentMode})` (bỏ suffix IOS); `AudioModule.requestRecordingPermissionsAsync`.
- `app.json`: bỏ plugin `expo-av`, `expo-audio` nhận micPermission. Gỡ dep `expo-av`.
- **Verify:** tsc 0 + jest 18/18 + native rebuild compile + launch OK + semantic check khớp docs chính thức. ⚠️ behavior record/play CHƯA QA runtime (cần login + mic + device).

---

## 3. CHƯA LÀM

### 👤 Việc của bạn (cần tài khoản/quyết định Apple — tôi KHÔNG làm được)
- [ ] **APNs Key (.p8)** cho push trên TestFlight (Apple Developer → Keys → APNs, hoặc `eas credentials`).
- [ ] **3 giá trị thật `eas.json` > submit.production.ios**: `appleId`, `ascAppId`, `appleTeamId` (đang là placeholder).
- [ ] **Privacy Policy URL** + **Support URL** (App Store Connect).
- [ ] ASC privacy questionnaire (cân nhắc "linked to identity" vì PostHog `identify()`).
- [ ] **Device QA cho audio**: expo-audio record/playback đúng API + compile + launch, nhưng I/O mic/loa cần test thật trên thiết bị đăng nhập (AI Speaking, Weekly Speaking, Video Lesson narration).

### 🤖 Việc tôi làm được (chờ bạn ra hiệu)
- [ ] **Pha 5 — production build/submit**: EAS build production → `eas submit` → TestFlight → metadata → review. (Chạy được khi có các giá trị 👤 ở trên.)
- [ ] **Re-add Sentry** đúng cách (bản mới hơn / cấu hình New-Arch, **test device trước khi tin**). Cần: Sentry project (DSN + org/project) + `eas secret SENTRY_AUTH_TOKEN` + bỏ `SENTRY_DISABLE_AUTO_UPLOAD` trong `eas.json`.
- [x] **Nợ a11y screen-reader từ QA — XONG** (`b11b76b4` HIGH + `aa042b2f` MEDIUM): tất cả 24 màn student giờ có `accessibilityRole` + `Label` (+ `selected/disabled/expanded` state) trên mọi control tương tác. HIGH a11y (H3 roadmap, H8 speaking ×6, H11 exam-attempt, H15/H16 video-lesson + hitSlop 44pt, H19 profile delete, H20 guide FAQ) + sweep 11 màn còn lại. **Additive only — 0 thay đổi visual**, không đụng reskin. Verify tsc 0 + jest 18/18 + grep xác nhận 0 Pressable thiếu role trên student screens. (Dùng `IconButton`/`Card` a11y sẵn có thay vì extract primitive mới — tránh rủi ro vỡ reskin.)
  - ✅ **Màn `(auth)` cũng XONG** (`d066a41a`): 6 Pressable login/register/onboarding (forgot-password/free-trial/register links + onboarding type-select & quick-win options). → **0 Pressable thiếu role trong toàn bộ `app/`** (student + auth).
  - ✅ **KeyboardAvoidingView HIGH (H12/H22/H23/H25) — ĐÃ XONG TỪ TRƯỚC ở `a1f96655`** (correctness pass, KHÔNG phải session này). Verified 2026-06-29: cả 4 màn (node-practice, classes join-sheet, settings/profile, assignments) đều có KAV `behavior` padding/height đúng pattern auth; sheet dùng `justifyContent:'flex-end'`. Audit liệt kê "open" vì snapshot TRƯỚC pass đó → stale. Sweep xác nhận mọi màn text-entry-ở-dưới có KAV; `vocabulary` chỉ có search field ở ĐẦU màn → đúng là không cần KAV.
  - **Còn lại (a11y mở rộng, chưa làm):** (a) color-only-meaning cho sighted color-blind (state đã announce cho VoiceOver, nhưng chưa thêm cue phi-màu cho người nhìn); (b) extract `SelectableChip`/`SelectableRow` shared (DRY, hoãn); (c) `maxFontSizeMultiplier` policy trên `ThemedText` (Dynamic Type).
- [ ] **Gỡ hẳn NativeWind** (đã gỡ wiring; còn dep `nativewind`/`tailwindcss` + file `global.css`/`tailwind.config.js` mồ côi). Đã flag thành background task.
- [ ] Tiện ích nhỏ: `withAlpha()` helper thay hex-alpha string-concat, `TAB_BAR_CLEARANCE` chung.

---

## 4. Toàn bộ commit trên nhánh (cũ → mới)

| Commit | Nội dung |
|---|---|
| `b0111217` | Pha 0 — audit + plan + baseline |
| `23148f10` | Pha 1 — Expo SDK 52→54 (RN 0.81, React 19, Reanimated 4) |
| `8340e3aa` | Pha 2 — push (projectId, aps-env, auth-gate) |
| `a87b741a` | Pha 3 — compliance (perms, privacy, Sentry*, ErrorBoundary) |
| `a1f96655` | QA fix 14 HIGH correctness |
| `0e26f021` | Pha 4.1 — tokens + fonts (warm-paper/serif/sharp) |
| `9a0b8e51` | Pha 4.2 — Pill/Card/Caption/YellowSquare |
| `0901d118` | Pha 4.2 — AppHeader editorial |
| `43984387` | Pha 4.3 — restyle Home (reference) |
| `83b068ca` | Pha 4.3 — restyle 15 màn student |
| `7d875427` | fix — re-include `mobile/assets/*` trong root `.gitignore` |
| `43917cc4` | fix — **gỡ Sentry** (crash New-Arch TurboModule) |
| `80f818fa` | docs — handoff (chẩn đoán crash) |
| `660c753a` | fix — **render-loop crash** → `<Redirect>` khai báo + bỏ `useRootNavigationState`; gỡ NativeWind |
| `8f624b02` | docs — handoff (crash fixed) |
| `95938161` | Pha 4.3 — restyle 5 màn cosmetic cuối → **24/24 xong** |
| `e9f935ff` | feat — **migrate expo-av → expo-audio** |
| `06cf4df7` | docs — handoff (reskin 24/24 + audio + EAS building) |
| `ae96e2b7` | docs — handoff (EAS preview xanh + verify) |
| `0e9913b8` | docs — rewrite full handoff (done/not-done) |
| `b11b76b4` | fix — **a11y HIGH cluster** (role/label/state + 44pt) |
| `aa042b2f` | fix — **a11y MEDIUM sweep** (label remaining Pressables, 24/24 màn) |
| `0c2ba6b4` | docs — handoff (a11y screen-reader pass) |
| `d066a41a` | fix — **a11y auth screens** (login/register/onboarding → 0 role-less Pressable trong app/) |

> `*` Sentry ở `a87b741a` đã bị gỡ ở `43917cc4`.

---

## 5. Facts / cấu hình quan trọng

- **Stack:** expo `^54` · RN `0.81.5` · React `19.1` · **New Architecture ON** · expo-router `6` · Reanimated `4.1.7` · zustand `5` · @react-navigation `7` · **expo-audio `~1.1.1`** (expo-av đã gỡ).
- **EAS project:** `@cudinh3502/deutschflow` · **projectId** `26fa9e21-f563-4891-953e-e00c704c3c6b`.
- **Apple auth = ASC API Key** (KHÔNG cần password Apple):
  - file `~/.appstoreconnect/private_keys/AuthKey_FADUS86X4V.p8` (perms 600, ngoài iCloud)
  - **Key ID** `FADUS86X4V` · **Issuer ID** `c32647c2-006c-4e10-be92-0a3bfd5dab4f`
  - env: `EXPO_ASC_API_KEY_PATH` / `EXPO_ASC_KEY_ID` / `EXPO_ASC_ISSUER_ID`
  - ⚠️ key role **Admin** + nội dung từng hiện trong transcript → cân nhắc **revoke + tạo lại role App Manager**.
- **EAS preview build verify:** `30ec9041-7b63-4fb3-9908-3dc4ef46c46a` (simulator) FINISHED ~8' → `eas build:run` cài bản release standalone → mở sạch tới login, 0 crash. Artifact: https://expo.dev/accounts/cudinh3502/projects/deutschflow/builds/30ec9041-7b63-4fb3-9908-3dc4ef46c46a
- **Bundle id:** `com.deutschflow.app`. Scheme: `deutschflow`. App mobile-only STUDENT role.

---

## 6. Gotchas / bài học (QUAN TRỌNG cho session sau)

1. **Render loop fatal ở React 19 release/Hermes** nhưng chỉ red-box ở dev → tsc/jest/`expo export` KHÔNG bắt được (không EVAL). Muốn tìm: **dev build (`npx expo run:ios`) → red-box trỏ source `file:line`**, rồi bisect.
2. **Tránh redirect imperative trong root layout.** `router.replace` trong `useEffect` phụ thuộc `useRootNavigationState()` = vòng lặp re-render. Dùng `<Redirect>` khai báo trong `app/index.tsx`.
3. **pod install / `expo run:ios` FAIL `Encoding::CompatibilityError ... ASCII-8BIT`** = shell non-interactive thiếu UTF-8 locale (Ruby 4 + CocoaPods 1.16). **FIX: `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`** trước khi chạy. (Đây là lý do "chạy tay trong terminal thì ổn".)
4. **Build local FAIL `[CP] Copy Pods Resources` `Sandbox: bash deny file-write-create resources-to-copy-*.txt`** = Xcode 16 user-script-sandboxing. **FIX local:** `sed -i '' 's/ENABLE_USER_SCRIPT_SANDBOXING = YES;/ENABLE_USER_SCRIPT_SANDBOXING = NO;/g' ios/DeutschFlow.xcodeproj/project.pbxproj` (mất sau mỗi prebuild → sed lại). **EAS KHÔNG bị** (toolchain cloud OK).
5. **Reload dev khi app kẹt loop:** app kẹt → HMR/cold-relaunch KHÔNG nhận code mới (serve bundle cũ). Mỗi lần đổi code phải **restart Metro `--clear`** (`npx expo start --dev-client --clear`) rồi cold-launch (`xcrun simctl openurl <udid> "exp+deutschflow://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"`). Thêm `console.log` marker để xác nhận bundle fresh.
6. **EAS build từ git SUBDIR:** repo ở `DeutschFlow/`, app ở `mobile/` → chạy `eas build` **từ trong `mobile/`**. EAS loại file khớp `.gitignore` kể cả file đã track → negation `!mobile/assets/**` PHẢI giữ.
7. **Sentry `@7.2` + New Arch = crash native** (TurboModule SIGABRT). Re-add phải test device.
8. **expo-av deprecated**, mất ở SDK 55 → đã migrate expo-audio. Recording là **hook-only** (`useAudioRecorder`).
9. Token KEY trong `lib/theme` giữ nguyên qua reskin → đừng đổi tên key, chỉ đổi value. App dùng **0 `className`** (inline style + token, KHÔNG NativeWind).
10. `ios/` là gitignore → EAS tự prebuild. EAS dùng Node 20.19.4; máy local Node 25.

---

## 7. Recipe / lệnh hay dùng

**Verify nhanh (gate xanh):**
```bash
cd mobile
npx tsc --noEmit        # 0
npm test                # jest 18/18
npx expo-doctor         # local
```

**Dev build local (lấy red-box / debug runtime):**
```bash
cd mobile
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
sed -i '' 's/ENABLE_USER_SCRIPT_SANDBOXING = YES;/ENABLE_USER_SCRIPT_SANDBOXING = NO;/g' ios/DeutschFlow.xcodeproj/project.pbxproj  # nếu đã prebuild
npx expo run:ios --device "iPhone 16 Pro"
```

**EAS build + cài Simulator:**
```bash
cd mobile
export EXPO_ASC_API_KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_FADUS86X4V.p8"
export EXPO_ASC_KEY_ID="FADUS86X4V"
export EXPO_ASC_ISSUER_ID="c32647c2-006c-4e10-be92-0a3bfd5dab4f"
npx eas-cli@latest build -p ios --profile preview --no-wait     # simulator
npx eas-cli@latest build:run -p ios --latest                    # download + cài + launch
npx eas-cli@latest build:view <id> --json                       # status/artifact
```

**Đọc log EAS build lỗi:** `build:view <id> --json` → `logFiles[0]` (GCS URL, hết hạn 15') → `curl` → **`brotli -dc`** (nén brotli, KHÔNG gzip).

---

## 8. Tài liệu liên quan trong repo
`mobile/IOS_DEPLOY_PLAN.md` · `mobile/IOS_DEPLOY_AUDIT.md` · `mobile/UPGRADE_BASELINE.md` · `mobile/QA_SCREENS_AUDIT.md` · `mobile/A11Y_PASS.md` (a11y screen-reader pass) · `mobile/design/v2/native/na-*.jsx` (design source).
