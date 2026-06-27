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
| react | 18.3.1 | (theo SDK 54) |
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

➡️ **Bước tiếp theo: PHA 1 trong `IOS_DEPLOY_PLAN.md`** (nâng Expo SDK 52 → 54). Chạy `npx expo-doctor` đầu tiên để xác nhận trạng thái cục bộ.
