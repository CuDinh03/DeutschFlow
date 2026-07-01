# UPGRADE BASELINE — trước khi nâng Expo SDK 52 → 54

**Ngày:** 2026-06-27 · **Nhánh:** `chore/ios-deploy-sdk54` (tách từ `main`)
**Mục đích:** điểm rollback + trạng thái "đang chạy được" để so sánh sau khi nâng SDK.

## Runtime
| | Giá trị | Ghi chú |
|---|---|---|
| Node | v22.22.3 | ✅ đạt yêu cầu SDK 54 (≥ 20.19.4) |
| Expo CLI | 0.22.28 | |

## Phiên bản gói hiện tại (đọc từ node_modules)
| Gói | Hiện tại | Mục tiêu SDK 54 |
|---|---|---|
| expo | 52.0.49 | ^54 |
| react-native | 0.76.9 | 0.81.x |
| react | 18.3.1 | **19.1.x** (SDK 54) ⚠️ React 19 — bump `@types/react`→19, sửa lỗi type |
| expo-router | 4.0.22 | ~6 (theo SDK 54) |
| **react-native-reanimated** | **3.16.7** | **4.x** (worklets, chỉ New Arch) ⚠️ breaking |
| moti | 0.30.0 | kiểm tra bản hợp Reanimated 4 ⚠️ |
| @gorhom/bottom-sheet | 5.2.14 | kiểm tra bản hợp Reanimated 4 ⚠️ |
| nativewind | 4.1.23 | giữ v4, `expo install --fix` |
| react-native-mmkv | 3.3.3 | hợp New Arch, kiểm tra |
| posthog-react-native | 4.46.12 | `expo install --fix` |
| react-native-safe-area-context | 4.12.0 | theo SDK 54 |

## Kết quả kiểm tra baseline
| Lệnh | Kết quả |
|---|---|
| `npx tsc --noEmit` | ✅ **sạch** (exit 0, không lỗi type) |
| `npm test` (jest) | ✅ **18/18 pass**, 5 suite (~5.5s) |
| `npx expo-doctor` | ⏳ **chưa chạy** trong môi trường này (cần mạng tải CLI). **Claude Code chạy lại cục bộ** đầu Pha 1. |

New Architecture: **đã bật** (`newArchEnabled: true`) — thuận lợi vì Reanimated 4 yêu cầu New Arch.

## Việc migration riêng của repo (đã soi trước — xử lý ở PHA 1)
1. **`babel.config.js`** đang hack `reanimated: false` + thêm tay `'react-native-reanimated/plugin'`. Reanimated 4 → **bỏ cả hai**, để `babel-preset-expo` tự inject (dùng `react-native-worklets/plugin`). Tránh khai trùng.
2. **`app/(student)/speaking.tsx`** dùng `expo-file-system` API cũ (`cacheDirectory`, `writeAsStringAsync`, `EncodingType`). SDK 54 đổi default export → đổi import sang `expo-file-system/legacy` (cách nhanh) hoặc migrate API mới.
3. **`metro.config.js`** có `unstable_enablePackageExports = true` — mặc định bật từ SDK 53+, dòng này thừa (có thể bỏ, giữ `withNativeWind`).
4. **moti / @gorhom/bottom-sheet** không phải gói Expo → `expo install --fix` không tự nâng; kiểm tra/nâng tương thích Reanimated 4 thủ công.

## Trạng thái Pha 0
- [x] Tạo nhánh `chore/ios-deploy-sdk54`
- [x] Thu phiên bản + chạy tsc + jest
- [x] Viết file baseline này
- [x] Commit (chỉ các file tài liệu deploy của đợt này)

➡️ Pha 0 xong → Pha 1 bên dưới.

---

# KẾT QUẢ PHA 1 — Nâng Expo SDK 52 → 54 (2026-06-27)

**Nhánh:** `chore/ios-deploy-sdk54` · **Trạng thái:** ✅ Phần tự động hoá XONG, 3 cổng kiểm chứng xanh. Chưa native build (đợi Pha 2 + máy thật).

## Phiên bản đã nâng (sau → trước)
| Gói | Trước (SDK 52) | Sau (SDK 54) |
|---|---|---|
| expo | 52.0.49 | **54.0.35** |
| react | 18.3.1 | **19.1.0** |
| react-native | 0.76.9 | **0.81.5** |
| expo-router | 4.0.22 | **6.0.24** |
| react-native-reanimated | 3.16.7 | **4.1.7** |
| react-native-worklets | (chưa có) | **0.5.1** (mới — peer của Reanimated 4) |
| expo-file-system | 18.0.x | **19.0.23** (dùng `/legacy` import) |
| expo-av | 15.0.x | **16.0.8** (GIỮ — deprecated, nợ migrate sang Pha 4) |
| expo-notifications | 0.29.x | **0.32.17** |
| react-native-safe-area-context | 4.12.0 | 5.6.0 |
| react-native-screens | 4.4.0 | 4.16.0 |
| react-native-gesture-handler | 2.20.2 | 2.28.0 |
| react-native-svg | 15.8.0 | 15.12.1 |
| @types/react | 18.3.x | 19.1.17 |
| jest-expo | 52.0.6 | 54.0.17 |
| babel-preset-expo | (transitive) | **54.0.11 (thêm devDep tường minh)** |
| moti / @gorhom/bottom-sheet / mmkv | giữ | giữ (tương thích Reanimated 4) |

## Breaking change đã xử lý
1. **babel.config.js** — bỏ hack `reanimated: false` + plugin tay `react-native-reanimated/plugin`. Reanimated 4 để `babel-preset-expo` tự inject `react-native-worklets/plugin`.
2. **react-native-worklets** — cài tường minh `0.5.1` (peer của Reanimated 4, không tự kéo vì `legacy-peer-deps`).
3. **babel-preset-expo** — thêm vào devDependencies (`~54.0.11`). Sau upgrade nó bị nest dưới `node_modules/expo/` → Metro/Babel không resolve được từ root (lỗi "Cannot find module 'babel-preset-expo'"). Khai trực tiếp để hoist.
4. **expo-file-system** — `speaking.tsx` đổi import sang `expo-file-system/legacy` (giữ API `cacheDirectory`/`writeAsStringAsync`/`EncodingType`).
5. **metro.config.js** — bỏ dòng thừa `unstable_enablePackageExports` (mặc định bật từ SDK 53+).
6. **expo-notifications** — `setNotificationHandler`: `shouldShowAlert` bị tách thành `shouldShowBanner` + `shouldShowList` (`hooks/usePushNotifications.ts`).
7. **app.json** — bỏ field `android.usesCleartextTraffic` (không hợp schema SDK 54; mặc định đã false + app ép HTTPS).
8. **.npmrc** — thêm `legacy-peer-deps=true` (workaround chuẩn cho Expo + npm khi nâng major qua thời React 19; giữ install ổn định cả trên EAS).

## Kiểm chứng (đều xanh)
| Cổng | Kết quả |
|---|---|
| `npx expo-doctor` | ✅ **18/18 pass** (cảnh báo expo-av "unmaintained" đã tự hết với expo-av@16) |
| `npx tsc --noEmit` | ✅ exit 0 |
| `npm test` (jest) | ✅ **18/18 pass** |
| `npx expo export -p ios` (Metro bundle) | ✅ ra bundle Hermes 9.37 MB — xác nhận babel/Reanimated 4/worklets + expo-file-system/legacy + expo-av bundle sạch |

## Chưa làm (đúng phạm vi — đợi bước sau)
- **Native build** (`expo prebuild` + pod install + xcodebuild): KHÔNG cần chạy tay vì `ios/` đang **gitignore** → EAS tự prebuild SDK 54 khi build (Pha 2, cần `projectId`).
- **Runtime QA máy thật:** animation (Reanimated 4), ghi âm + phát TTS (expo-av), push token — chỉ kiểm được trên thiết bị thật qua TestFlight.
- **Nợ kỹ thuật:** migrate `expo-av` → `expo-audio`/`expo-video` (3 màn) dời vào **Pha 4**, bắt buộc trước SDK 55.

➡️ **Bước tiếp theo: PHA 2** (`eas init` lấy projectId thật + push/APNs) trong `IOS_DEPLOY_PLAN.md`.
