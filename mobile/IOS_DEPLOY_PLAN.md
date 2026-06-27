# DeutschFlow Mobile — Plan thực thi deploy iOS + bộ prompt Claude Code

**Hướng đã chọn: B — restyle giao diện v2 TRƯỚC, rồi submit App Store.**
Tham chiếu phát hiện: xem `mobile/IOS_DEPLOY_AUDIT.md`. Plan này biến audit thành các bước chạy được, mỗi bước có 1 prompt copy-paste cho **Claude Code**.

---

## ▶️ TRẠNG THÁI HIỆN TẠI — Claude Code bắt đầu từ đây
- ✅ **PHA 0 đã xong** (2026-06-27): nhánh `chore/ios-deploy-sdk54` đã tạo từ `main`; baseline **xanh** — `tsc --noEmit` sạch, `jest` 18/18 pass. Chi tiết: [`mobile/UPGRADE_BASELINE.md`](./UPGRADE_BASELINE.md).
- 👉 **BẮT ĐẦU TỪ: PHA 1 — Nâng Expo SDK 52 → 54.** Trình tự: `git checkout chore/ios-deploy-sdk54` → `cd mobile` → `npx expo-doctor` (xác nhận trạng thái cục bộ, lệnh này chưa chạy được ở môi trường chuẩn bị) → dùng prompt PHA 1 bên dưới.
- ⚠️ 4 điểm migration riêng của repo đã được chốt sẵn (babel reanimated hack, `expo-file-system/legacy` trong `speaking.tsx`, dòng metro `unstable_enablePackageExports` thừa, kiểm tra `moti`/`@gorhom/bottom-sheet` với Reanimated 4) — đã nhúng trong prompt PHA 1 + `UPGRADE_BASELINE.md`.
- ⏳ Pha 2 → 5: chưa bắt đầu.

---

## Cách dùng tài liệu này
1. Mở terminal tại thư mục `mobile/`, chạy Claude Code ở đó.
2. Làm **tuần tự theo pha**. Mỗi prompt nằm trong khối ``` để copy nguyên văn.
3. Sau mỗi pha, **review diff + chạy tiêu chí kiểm chứng**, chỉ qua pha sau khi pha trước xanh.
4. Việc gắn nhãn 👤 là **bạn tự làm** (cần đăng nhập tài khoản EAS/Apple, thao tác trên web Apple) — Claude Code không tự làm thay được.

## Bản đồ pha & thứ tự (vì sao thứ tự này)
| Pha | Nội dung | Vì sao trước/sau | Ước tính |
|----|----------|------------------|----------|
| 0 | Branch + baseline | Có điểm rollback, biết trạng thái sạch trước khi đụng | 0.5 ngày |
| 1 | **Nâng Expo SDK 52 → 54** (P0-1) | Nền tảng bắt buộc; restyle v2 phải nằm trên Reanimated 4 đã ổn định | 3–5 ngày |
| 2 | Plumbing deploy: projectId + push/APNs (P0-2, P0-3) | Cần build chạy được trên device thật để test v2 | 0.5–1 ngày |
| 3 | Dọn compliance P1/P2 (camera, privacy manifest, Sentry, ErrorBoundary, eas submit, iPad) | Gọn, làm sớm để TestFlight sạch | 1–2 ngày |
| 4 | **Restyle giao diện v2** (15 màn) | Làm sau khi nền 54 ổn để không phí công | 2–4 tuần |
| 5 | Build · TestFlight · metadata · submit | Khâu cuối | 2–4 ngày |

> Lý do SDK 54 đứng trước v2: SDK 54 đổi **Reanimated 3 → 4** (worklets) và **expo-file-system** sang API mới — đụng đúng phần animation + speaking mà v2 sẽ restyle. Làm 54 trước để chỉ QA animation một lần.

---

# PHA 0 — Branch & baseline

**Mục tiêu:** có nhánh riêng + ảnh chụp trạng thái "đang chạy được" để so sánh và rollback.

```
Bối cảnh: đây là app Expo (React Native) trong thư mục mobile/. Tôi chuẩn bị nâng Expo SDK 52 → 54 và restyle UI, nên cần một baseline an toàn.

Nhiệm vụ:
1. Tạo nhánh git mới "chore/ios-deploy-sdk54" từ nhánh hiện tại.
2. Chạy và ghi lại kết quả (tạo file mobile/UPGRADE_BASELINE.md) cho: `node -v`, `npx expo --version`, `npx expo-doctor`, `npm test`, và `npx tsc --noEmit`.
3. Liệt kê trong file đó: phiên bản hiện tại của expo, react-native, react-native-reanimated, moti, @gorhom/bottom-sheet, nativewind, react-native-mmkv, posthog-react-native (đọc từ package.json + node_modules).
4. KHÔNG sửa code gì khác. Chỉ tạo nhánh + file baseline + commit.

Kiểm chứng: in ra nội dung mobile/UPGRADE_BASELINE.md và xác nhận đang ở nhánh mới.
```

---

# PHA 1 — Nâng Expo SDK 52 → 54 (P0-1, blocker lớn nhất)

**Mục tiêu:** app chạy được trên Expo SDK 54 / RN 0.81 / Reanimated 4, build EAS thành công.
**Gotcha riêng của repo này (đã soi trước):**
- `babel.config.js` đang hack `reanimated: false` + thêm tay `'react-native-reanimated/plugin'`. **Reanimated 4 phải bỏ hack này**, để `babel-preset-expo` tự xử lý (nó dùng `react-native-worklets/plugin`). Để 2 nơi cùng khai = lỗi "duplicate plugin".
- `app/(student)/speaking.tsx` dùng `expo-file-system` API cũ (`cacheDirectory`, `writeAsStringAsync`, `EncodingType`). SDK 54 đổi default export → phải đổi import sang `expo-file-system/legacy` hoặc migrate sang API mới.
- `metro.config.js` set `unstable_enablePackageExports = true` — từ SDK 53+ đã mặc định bật, dòng này thừa (vô hại, có thể bỏ).
- `moti` và `@gorhom/bottom-sheet` không phải gói Expo nên `expo install --fix` không tự nâng — phải kiểm tra tương thích Reanimated 4 thủ công. (Đã soi npm: `@gorhom/bottom-sheet@5.2.14` đã hỗ trợ Reanimated `>=4.0.0-`; `moti@0.30` peer wildcard → cài được, chỉ cần QA runtime.)
- **`expo-av` (mới phát hiện 2026-06-27):** dùng ở 3 file lõi — `app/(student)/speaking.tsx`, `app/(student)/weekly-speaking.tsx`, `components/video/VideoLessonPlayer.tsx` (ghi âm + phát TTS/audio). SDK 54 **deprecate** expo-av (tách khỏi SDK), **SDK 55 mới xóa hẳn**. **Quyết định: GIỮ expo-av ở Pha 1** — pin `expo-av@^16` (bản SDK 54, vẫn cài + chạy được, dev-client riêng nên không vướng Expo Go). Apple không quan tâm lib nội bộ → submit lần này không cần bỏ. ➡️ **Nợ kỹ thuật: migrate expo-av → `expo-audio`/`expo-video` dời vào PHA 4** (lúc restyle 3 màn đó, sửa + QA một lần). Phải trả trước khi lên SDK 55.
- **React 18 → 19.1 (mới phát hiện):** SDK 54 đi kèm React 19.1 (baseline ghi nhầm target 18.3.1). Cần bump `@types/react`→19 và sửa lỗi type do React 19.

```
Bối cảnh: app Expo trong mobile/, hiện Expo SDK 52 / RN 0.76 / Reanimated 3.16, New Architecture ĐÃ bật. Cần nâng lên Expo SDK 54 (RN 0.81, Reanimated 4) để đáp ứng yêu cầu Apple (build bằng Xcode 26 / iOS 26 SDK). Bám theo hướng dẫn chính thức "How to upgrade to Expo SDK 54" của Expo; tra changelog SDK 53 và 54 trước khi sửa.

Nhiệm vụ (làm từng bước, dừng lại báo cáo nếu gặp lỗi không chắc):
1. Nâng core: `npx expo install expo@^54.0.0` rồi `npx expo install --fix`. Đảm bảo Node >= 20.19.4.
2. babel.config.js: BỎ hack reanimated — bỏ `reanimated: false` trong babel-preset-expo và XÓA dòng plugin tay `'react-native-reanimated/plugin'`. Giữ nativewind preset + module-resolver alias '@'. (Reanimated 4 được babel-preset-expo tự inject qua react-native-worklets.)
3. expo-file-system: trong app/(student)/speaking.tsx, sửa để dùng API tương thích SDK 54 — cách nhanh: đổi `import * as FileSystem from 'expo-file-system'` thành `import * as FileSystem from 'expo-file-system/legacy'`. Giữ nguyên hành vi ghi/xóa file TTS.
4. metro.config.js: bỏ dòng `unstable_enablePackageExports = true` nếu đã mặc định ở 54 (giữ withNativeWind).
5. Kiểm tra tương thích & nâng các lib không-Expo: moti, @gorhom/bottom-sheet, react-native-mmkv với Reanimated 4 / RN 0.81. Nâng lên bản tương thích mới nhất nếu cần. react-native-svg, lucide-react-native, posthog-react-native, @tanstack/react-query, zustand, date-fns: dùng `expo install --fix` hoặc bản phù hợp.
6. Regenerate native iOS: `npx expo prebuild --clean -p ios` rồi `cd ios && pod install`.
7. Sửa hết lỗi TypeScript do nâng version (`npx tsc --noEmit`) và cập nhật mock trong test/ nếu API đổi.

Ràng buộc:
- KHÔNG đổi logic nghiệp vụ, chỉ sửa do nâng SDK.
- Giữ New Architecture bật. Giữ nguyên design system hiện tại (chưa restyle v2 ở pha này).
- Không commit node_modules, ios/Pods.

Kiểm chứng (phải pass hết):
- `npx expo-doctor` không còn lỗi chặn.
- `npx tsc --noEmit` sạch.
- `npm test` xanh.
- Liệt kê các breaking change đã xử lý + lib đã nâng vào mobile/UPGRADE_BASELINE.md.
Báo cáo: tóm tắt diff theo nhóm file và mọi điểm còn rủi ro cần tôi quyết.
```

👤 **Sau prompt trên — bạn build thử trên EAS** (cần đăng nhập EAS, làm ở Pha 2 vì cần projectId). Hoặc chạy `npx expo run:ios` trên máy có Xcode 26 để test cục bộ trước.

---

# PHA 2 — Plumbing deploy: projectId + push/APNs (P0-2, P0-3)

**Mục tiêu:** EAS link đúng project, push notification sống lại.

### 2.1 — 👤 Bạn chạy thủ công (cần đăng nhập EAS, 1 lần)
```
eas login
eas init          # tạo/link project trên EAS, tự ghi projectId vào app.json
```
Sau đó dùng Claude Code để dọn lại config:
```
Bối cảnh: vừa chạy `eas init`, projectId thật đã được ghi vào app.json (trước đó là "YOUR_EAS_PROJECT_ID").

Nhiệm vụ:
1. Xác nhận app.json > extra.eas.projectId KHÔNG còn là placeholder; in giá trị ra.
2. Trong hooks/usePushNotifications.ts, xác nhận luồng lấy Expo push token giờ chạy được (không còn return null vì placeholder). Thêm log rõ ràng khi token gửi lên /profile/me/push-token thành công/thất bại (chỉ ở __DEV__).
3. Đảm bảo plugin expo-notifications trong app.json cấu hình đúng (icon, color).
Kiểm chứng: in app.json (phần extra.eas + plugins) và đoạn code push đã chỉnh.
```

### 2.2 — Entitlement push (aps-environment)
```
Bối cảnh: ios/DeutschFlow/DeutschFlow.entitlements đang RỖNG (<dict/>) nhưng app đăng ký remote push. Cần capability Push Notifications.

Nhiệm vụ:
1. Sau khi đã có plugin expo-notifications, chạy `npx expo prebuild --clean -p ios` và kiểm tra ios/DeutschFlow/DeutschFlow.entitlements ĐÃ có key `aps-environment`.
2. Nếu chưa có, thêm config để prebuild sinh ra `aps-environment` (development cho dev build, production cho release) — qua plugin expo-notifications hoặc app.json. KHÔNG hard-code thủ công nếu prebuild lo được.
3. Thêm vào app.json > ios: `"infoPlist": { "UIBackgroundModes": ["remote-notification"] }` chỉ khi app cần xử lý push nền (kiểm tra usePushNotifications; nếu chỉ hiện foreground thì bỏ qua).
Kiểm chứng: in nội dung entitlements sau prebuild, xác nhận có aps-environment.
```
👤 **Tạo APNs Key**: trên Apple Developer → Keys → tạo key có Apple Push Notifications service (.p8), rồi `eas credentials` (chọn iOS → Push Key) để nạp. EAS cũng có thể tự tạo khi `eas build` lần đầu.

---

# PHA 3 — Dọn compliance P1 + P2 (gộp 1 lượt)

**Mục tiêu:** loại các lý do Apple hay reject + thêm an toàn vận hành.

```
Bối cảnh: app Expo trong mobile/ (đã ở SDK 54). Dọn các vấn đề tuân thủ App Store theo audit. Camera KHÔNG được dùng ở đâu (không có expo-camera/image-picker). PostHog đang chạy (captureScreens: true). Chưa có crash reporting và chưa có Error Boundary.

Nhiệm vụ:
1. Quyền thừa:
   - Xóa NSCameraUsageDescription khỏi app.json > ios.infoPlist (và để prebuild dọn khỏi Info.plist).
   - Xóa NSSpeechRecognitionUsageDescription (chỉ dùng expo-speech = TTS, không dùng Speech recognition).
   - NSFaceIDUsageDescription: nếu không thực sự dùng Face ID thì xóa; nếu giữ (SecureStore), đổi chuỗi mặc định tiếng Anh sang tiếng Việt nhất quán: "DeutschFlow dùng Face ID để bảo vệ phiên đăng nhập của bạn."
2. iPad: đặt app.json > ios.supportsTablet = false (v1 chỉ iPhone) để tránh Apple test layout iPad.
3. Privacy manifest: khai dữ liệu PostHog thu thập. Dùng app.json > ios.privacyManifests (để KHÔNG bị prebuild ghi đè) khai NSPrivacyCollectedDataTypes phù hợp PostHog: Product Interaction, Crash Data (nếu thêm Sentry), Device ID / Other Usage Data — linked=false, tracking=false, purpose Analytics/AppFunctionality. Giữ NSPrivacyTracking=false. Đồng thời cập nhật ios/DeutschFlow/PrivacyInfo.xcprivacy cho khớp.
4. Crash reporting: cài Sentry cho Expo (`npx expo install @sentry/react-native`), thêm config plugin của Sentry vào app.json, khởi tạo trong lib/observability.ts (đọc DSN từ app.json > extra.sentryDsn), và bọc app bằng Sentry.wrap ở app/_layout.tsx. Để DSN trống thì no-op như hiện tại.
5. Error Boundary: thêm `export function ErrorBoundary` (Expo Router) trong app/_layout.tsx — màn lỗi thân thiện dùng design system hiện có (ThemedText/Button), có nút "Thử lại" (retry) và gửi lỗi về Sentry.
6. (P2) screenProtection.ts: wire vào các màn nhạy cảm (profile, settings/profile, exam-attempt) đúng như mô tả trong file, nếu chi phí thấp.

Ràng buộc: không đổi hành vi nghiệp vụ; mọi thay đổi permission phải đi qua app.json rồi prebuild, không sửa tay Info.plist rồi để prebuild ghi đè.
Kiểm chứng: `npx expo prebuild --clean -p ios` rồi grep Info.plist xác nhận KHÔNG còn NSCameraUsageDescription/NSSpeechRecognitionUsageDescription; in privacyManifests; `npm test` + `npx tsc --noEmit` xanh; mô tả màn ErrorBoundary.
```

### 3.x — Cấu hình `eas submit`
```
Bối cảnh: eas.json > submit.production đang rỗng {}.

Nhiệm vụ: thêm khối submit.production cho iOS với các trường sau (để placeholder + comment chỉ chỗ lấy):
  - appleId: email Apple ID của tài khoản dev
  - ascAppId: Apple ID dạng số của app trong App Store Connect (App Information → General → Apple ID)
  - appleTeamId: Team ID (Apple Developer → Membership)
Giữ nguyên build profiles. In lại eas.json sau khi sửa.
```
👤 Điền giá trị thật vào 3 trường trên.

---

# PHA 4 — Restyle giao diện v2 (15 màn)

**Mục tiêu:** đưa thiết kế "Native Student – Galerie" vào app RN, giữ nguyên logic/route hiện có.

> 💳 **Nợ kỹ thuật chuyển từ Pha 1:** migrate `expo-av` → `expo-audio` + `expo-video` ở đúng 3 màn sẽ restyle (`speaking.tsx`, `weekly-speaking.tsx`, `VideoLessonPlayer.tsx`). Làm cùng lúc restyle để chỉ QA ghi-âm/phát-audio một lần. **Bắt buộc xong trước khi nâng SDK 55.**

### 4.0 — 👤 Đưa thiết kế v2 vào repo (bắt buộc, vì Claude Code không mở được link claude.ai)
Trong trang design (claude.ai/design) bấm **Export** từng trang (hoặc copy file HTML/JSX: `Native Student - Galerie.html`, `na-intro.jsx`) và lưu vào `mobile/design/v2/`. Mỗi màn 1 file (đặt tên theo route: `home.html`, `roadmap.html`, `vocabulary.html`, `srs.html`, `speaking-select.html`, `speaking-interview.html`, `speaking-result.html`, `classes.html`, `class-detail.html`, `profile.html`, `upgrade.html`, `notifications.html`...). Có ảnh chụp kèm thì càng tốt.

### 4.1 — Trích design tokens trước (làm 1 lần, ảnh hưởng mọi màn)
```
Bối cảnh: tôi đã đặt bản thiết kế v2 (HTML) trong mobile/design/v2/. App dùng design system ở mobile/components/ui/ và token ở mobile/lib/theme/. Mục tiêu: cập nhật TOKEN + component dùng chung trước, để các màn tự kế thừa diện mạo v2.

Nhiệm vụ:
1. Đọc các file trong mobile/design/v2/ và trích: bảng màu (bg, surface, accent #F5C842/vàng, text, border, danger...), thang spacing, bo góc, đổ bóng, typography (Sora / Plus Jakarta / JetBrains Mono — đã có), kích thước icon, style của tab bar.
2. So sánh với lib/theme/ hiện tại; cập nhật token cho khớp v2 (giữ cấu trúc theme + dark/light tự động).
3. Cập nhật các component dùng chung trong components/ui/ (Button, Card, Pill, ProgressBar, ProgressRing, TabBar, AppHeader, ListRow, SectionHeader, StatTile, EmptyState, ErrorState, Skeleton) cho đúng v2 — CHỈ đổi style/diện mạo, KHÔNG đổi props/API để các màn không phải sửa.
Ràng buộc: không phá props công khai của component; giữ safe-area; không hardcode màu — dùng token.
Kiểm chứng: build chạy, chụp/được mô tả 3 component tiêu biểu trước–sau; `npx tsc --noEmit` xanh. Liệt kê token đã đổi.
```

### 4.2 — Restyle theo từng màn (lặp lại template này cho mỗi route)
Làm theo nhóm để dễ QA: **(a)** Hôm nay + Lộ trình → **(b)** Từ vựng + Ôn tập SRS → **(c)** luồng Luyện nói (Chọn HR / Phỏng vấn / Kết quả) → **(d)** Lớp học + chi tiết/thông báo → **(e)** Hồ sơ + Nâng cấp Pro + Thông báo.

```
Bối cảnh: restyle màn <TÊN MÀN> theo thiết kế v2 ở mobile/design/v2/<file>.html. File route: app/(student)/<file>.tsx. Dùng token + component đã cập nhật ở 4.1.

Nhiệm vụ:
1. Đọc thiết kế v2 của màn này; liệt kê khác biệt so với màn RN hiện tại (layout, thứ tự khối, copy, card, trạng thái).
2. Restyle màn RN để khớp v2: dùng component trong components/ui/ + token theme; KHÔNG gọi API mới, KHÔNG đổi data flow / React Query keys / navigation.
3. Giữ đủ 4 trạng thái: loading (Skeleton), error (ErrorState), empty (EmptyState), success — đúng như app đang có.
4. Tôn trọng safe-area qua component Screen; kiểm tra trên iPhone nhỏ (SE) và lớn (Pro Max) + Dynamic Island.

Ràng buộc: chỉ thay đổi tầng trình bày. Nếu thiết kế v2 đòi dữ liệu mà API chưa trả, DỪNG và báo, đừng bịa.
Kiểm chứng: `npx tsc --noEmit` xanh; mô tả/much ảnh trước–sau; xác nhận 4 trạng thái còn nguyên.
```

> Lặp template trên cho đủ 15 màn. Sau mỗi nhóm, build TestFlight nội bộ để bạn xem thật trên máy.

---

# PHA 5 — Build · TestFlight · Metadata · Submit

### 5.1 Build & lên TestFlight
```
Bối cảnh: đã xong SDK 54 + compliance + v2. Chuẩn bị build production iOS qua EAS.

Nhiệm vụ:
1. Rà soát app.json: version "1.0.0", buildNumber/ios.buildNumber hợp lệ; bundleIdentifier com.deutschflow.app; supportsTablet=false; quyền chỉ còn Microphone (+FaceID nếu giữ).
2. Chạy `eas build -p ios --profile production`, theo dõi log, sửa nếu fail.
3. Khi build xong: `eas submit -p ios` (dùng submit.production đã cấu hình).
Kiểm chứng: in link build EAS + trạng thái submit. Liệt kê mọi cảnh báo trong log.
```
👤 **Test trên thiết bị thật qua TestFlight:** đăng nhập tài khoản học viên, luyện nói (mic), nhận push, xóa tài khoản, refresh token, offline SRS. Xác nhận không crash (xem Sentry).

### 5.2 — 👤 App Store Connect (metadata, làm trên web Apple)
- [ ] Tạo app, Bundle ID `com.deutschflow.app`, đúng Team.
- [ ] **Privacy Policy URL** + **Support URL** (trang phải sống).
- [ ] **App Privacy / Data Collection** khớp PostHog (+ Sentry nếu thêm).
- [ ] Mô tả, từ khóa, **ảnh chụp 6.7" + 6.1"** (chụp từ bản v2), icon 1024 (đã có).
- [ ] Age rating + Category = Education.
- [ ] **Tài khoản học viên demo** + ghi chú reviewer: "App chỉ dành cho học viên; giáo viên/admin dùng web. Trên iOS không bán gói trong app."
- [ ] Export compliance: chọn No (đã set ITSAppUsesNonExemptEncryption=false).
- [ ] Submit for Review.

---

## Checklist tổng (rút gọn)
- [ ] Pha 0: nhánh + baseline
- [ ] Pha 1: SDK 54 (babel reanimated, expo-file-system/legacy, moti/bottom-sheet) — doctor/tsc/test xanh
- [ ] Pha 2: `eas init` projectId thật · entitlements có aps-environment · APNs key
- [ ] Pha 3: bỏ camera/speech · privacyManifests PostHog · Sentry + ErrorBoundary · supportsTablet=false · eas submit
- [ ] Pha 4: tokens v2 → components → 15 màn
- [ ] Pha 5: EAS build → submit → TestFlight thật → metadata → review

## Nguồn (tra 2026-06-27)
- [How to upgrade to Expo SDK 54](https://expo.dev/blog/expo-sdk-upgrade-guide)
- [Expo SDK 54 changelog (RN 0.81, Reanimated 4, iOS 26)](https://expo.dev/changelog/sdk-54)
- [Apple — Upcoming Requirements (Xcode 26 / iOS 26 SDK)](https://developer.apple.com/news/upcoming-requirements/)
- [Expo — App Store Connect minimum SDK 26](https://expo.dev/blog/app-store-connect-minimum-sdk-26)
