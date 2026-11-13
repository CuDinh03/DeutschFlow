# App Store Connect — sửa gì khi OTA / khi lên bản mới

> Dùng kèm `docs/QUY_TRINH_PHAT_HANH.md` §7 (luật OTA, tự đổi version) và runbook local `mobile/DEPLOYMENT.md` (không commit; §4 build/submit, §5.3 kỷ luật OTA).
> App: **MyDeutschFlow** · Apple ID `6785281013` · bundle `com.cudinh.mydeutschflow`.
> Bản đang phát hành: xem dòng "store" mới nhất ở §4 (nhật ký). Mốc lúc viết (12/11/2026): `1.0.2`.
> Cập nhật lần cuối: 12/11/2026.

Ký hiệu dùng trong tài liệu:
`X.Y.Z` = version đang trên App Store (= `app.json` `expo.version`) · `N` = số build EAS cấp ·
`X.Y.Z-ota.K` = bản OTA thứ K chạy trên `X.Y.Z`.

---

## Quy ước đánh số (áp cho mọi lần phát hành)

**1. Chỉ bản lên App Store mới tăng version.** OTA không bao giờ đổi `app.json`.

**2. Chọn số tăng theo câu hỏi đầu tiên trả lời "có":**

| Câu hỏi về bản sắp lên store | Tăng | Ví dụ từ `X.Y.Z` |
|---|---|---|
| Đổi mô hình sản phẩm, làm lại giao diện toàn bộ, hoặc bỏ hỗ trợ bản app cũ (backend ngừng tương thích)? | **MAJOR** | `X.Y.Z → (X+1).0.0` |
| Có tính năng / màn hình mới người dùng nhìn thấy, hoặc thêm gói mua trong app? | **MINOR** | `X.Y.Z → X.(Y+1).0` |
| Chỉ sửa lỗi, nâng thư viện/SDK, đổi quyền, icon, hiệu năng? | **PATCH** | `X.Y.Z → X.Y.(Z+1)` |

**3. OTA được đặt nhãn, không đổi số:** `X.Y.Z-ota.K`. K đếm từ 1 và quay về 1 khi lên version mới.
Nhãn chỉ dùng ở hai chỗ: `--message` của `eas update` và nhật ký §4.
```bash
npx eas-cli update --channel production --message "X.Y.Z-ota.K: <tóm tắt>"
```

**4. Gộp OTA khi lên store:** các thay đổi trong `X.Y.Z-ota.1…K` đi vào bản store kế tiếp.
Bản đó tính PATCH/MINOR/MAJOR theo **tổng** thay đổi kể từ `X.Y.Z`, không chỉ phần native.
(Có OTA thêm màn hình mới ⇒ bản store kế tiếp ít nhất là MINOR.)

**5. Số build `N` không có ý nghĩa với người dùng.** EAS tự tăng, có thể nhảy số. Chỉ ghi vào nhật ký để đối chiếu.

**6. Mốc dự kiến:** giai đoạn pilot giữ `1.Y.Z`. `2.0.0` dành cho lần đổi mô hình lớn đầu tiên sau pilot (nếu có), không tăng chỉ vì "đã lâu".

### Ví dụ một chuỗi phát hành (minh hoạ quy tắc, không phải lịch thật)

| Thứ tự | Thay đổi | Số |
|---|---|---|
| 1 | Bản đang trên store | `1.0.2` |
| 2 | Sửa chữ sai màn Lộ trình (JS) | OTA `1.0.2-ota.1` |
| 3 | Sửa lỗi chấm bài nói (JS) | OTA `1.0.2-ota.2` |
| 4 | Nâng `expo-av` (native), không có gì mới để thấy | store `1.0.3` |
| 5 | Thêm màn Luyện thi telc B1 (JS) | OTA `1.0.3-ota.1` |
| 6 | Bản store kế tiếp, gồm luôn màn Luyện thi | store `1.1.0` (MINOR vì bước 5) |

---

## 0. Chọn đường nào — một câu hỏi duy nhất

**Thay đổi có đụng native không?** (thư viện native mới/đổi bản, `package.json` deps,
`app.json`, `eas.json`, quyền/Info.plist, icon, splash, nâng Expo SDK)

| Trả lời | Đường | App Store Connect |
|---|---|---|
| Không — chỉ JS/TS/ảnh trong `app/`, `components/`, `lib/`, `stores/`… | **A. OTA** (`eas update`) | **Không sửa gì** (xem §1) |
| Có | **B. Bản mới** (build + submit + review) | Tạo version mới, điền đủ (xem §2) |

---

## 1. Đường A — OTA: App Store Connect giữ nguyên

OTA chỉ thay gói JS trong app đã cài. Apple không biết, không duyệt, không tạo version.
Vì vậy:

- **KHÔNG tạo version mới** trên ASC (nút ➕ cạnh "iOS App").
- **KHÔNG đổi** `version` trong `app.json`. Theo mặc định, fingerprint của `@expo/fingerprint`
  hash **cả** `version`/`buildNumber`. Đổi `X.Y.Z` (dù chỉ một số) làm runtimeVersion lệch build
  đang chạy, và OTA **chết im lặng** (không máy nào nhận). Trên máy người dùng, số version
  vẫn hiện `X.Y.Z`. Như vậy là đúng; nhãn `X.Y.Z-ota.K` chỉ nằm trong nhật ký.
- "Có gì mới" trên App Store **không đổi được** cho bản OTA. Muốn báo người dùng thì
  báo trong app.
- Listing (mô tả, ảnh chụp, từ khoá) thường **không cần sửa**. Ngoại lệ: OTA làm giao diện
  khác hẳn ảnh chụp đang đăng. Khi đó ghi lại vào mục "Nợ listing" ở §4, và sửa ở lần
  lên bản mới kế tiếp. Ảnh chụp/mô tả chỉ sửa được khi có version mới ở trạng thái chỉnh sửa
  (*Prepare for Submission*).

**Việc làm thật cho OTA:**
```bash
# worktree sạch, đúng commit main của build đang phát hành
cd mobile && npm ci
npx eas-cli update --channel production --message "X.Y.Z-ota.K: mô tả bản vá"
npx eas-cli update:list --branch production   # runtimeVersion PHẢI = fingerprint build đích
```
Ghi một dòng vào §4 (nhật ký) để lần lên bản mới biết đã vá gì.

---

## 2. Đường B — Bản mới: tuần tự trên App Store Connect

### 2.1 Trong repo (trước khi build)
1. Tính version mới theo **Quy ước đánh số** ở đầu tài liệu (PATCH / MINOR / MAJOR, tính trên
   tổng thay đổi kể từ `X.Y.Z`, gồm cả các OTA). Sửa `mobile/app.json` → `expo.version`.
   Apple bắt version mới **lớn hơn** bản đã Ready for Distribution.
2. **Không** đụng buildNumber (EAS tự tăng — `autoIncrement` + `appVersionSource: remote`).
3. Build từ `origin/main`, worktree sạch, rồi submit (DEPLOYMENT.md §4):
   ```bash
   npx eas-cli build  --platform ios --profile production
   npx eas-cli submit --platform ios --latest
   ```
4. Chờ build **Complete/VALID** ở tab **TestFlight** (đừng bỏ đi khi còn Processing).

### 2.2 Trên App Store Connect → MyDeutschFlow → Distribution

| # | Chỗ bấm (theo màn hình ASC) | Làm gì | Khớp với |
|---|---|---|---|
| 1 | Cột trái **iOS App ➕** | Tạo version mới, gõ **đúng** chuỗi `version` vừa đặt trong `app.json`, chỉ dạng `X.Y.Z` (không có hậu tố `-ota`) | `app.json` → `expo.version` |
| 2 | **What's New in This Version** (mỗi ngôn ngữ, Vietnamese trước) | Viết những gì người dùng thấy được, gồm cả các bản OTA đã ra từ version trước (lấy ở §4) | Nhật ký §4 |
| 3 | **Product Page Information → App Previews and Screenshots** | Thay ảnh nếu giao diện đã khác ảnh đang đăng (chỉ cần bộ iPhone 6.9"; `supportsTablet: false` nên không cần iPad) | Giao diện bản mới |
| 4 | **Header and Search Results** | Mới của Apple, **không bắt buộc**. Bỏ trống được ("0 of 1 Header Asset") | — |
| 5 | **Promotional Text** | Sửa được bất cứ lúc nào, không cần review | — |
| 6 | **Description / Keywords** | Chỉ sửa khi có tính năng đáng kể | — |
| 7 | **Build** | Bấm ➕ chọn build vừa VALID (số build EAS cấp) | `eas build:list` |
| 8 | **App Review Information** | Kiểm tra tài khoản demo cho reviewer còn đăng nhập được; ghi chú tính năng mới cần mic/AI | Prod |
| 9 | General → **App Privacy** | Chỉ sửa khi thu thập dữ liệu mới / thêm đối tác AI mới | `app.json` `privacyManifests` + `NSMicrophoneUsageDescription` |
| 10 | General → **App Information → Age Rating** | Chỉ sửa khi nội dung đổi tính chất | — |
| 11 | **Pricing and Availability / In-App Purchases** | Nếu thêm/đổi gói IAP thì gói phải được **gắn vào version này** trước khi gửi | Backend gói Pro |
| 12 | **Version Release** | Chọn *Manually release* (an toàn hơn: duyệt xong mới bấm phát hành) | — |
| 13 | **Add for Review → Submit for Review** | Gửi duyệt | — |

### 2.3 Sau khi Apple duyệt
- Bấm **Release This Version** (nếu chọn thủ công).
- Ghi fingerprint của build mới vào `DEPLOYMENT.md` §5.3 mục 5 (mốc fingerprint).
  Từ đây mọi OTA nhắm build mới này.
- Xoá các mục "Nợ listing" đã xử lý ở §4.

---

## 3. Bảng đối chiếu nhanh

| Thứ | OTA | Bản mới |
|---|---|---|
| `app.json` `version` | **giữ nguyên** | tăng |
| Build number | không có | EAS tự tăng |
| Version mới trên ASC | không | có — chuỗi = `app.json` |
| What's New | không | có — gom cả các OTA trước đó |
| Ảnh chụp / mô tả | không (ghi nợ) | sửa nếu UI đổi |
| Apple review | không | có (thường 1–3 ngày) |
| Người dùng nhận | lần mở app kế tiếp | khi cập nhật từ App Store |

---

## 4. Nhật ký phát hành (ghi mỗi lần OTA / bản mới)

Mỗi lần phát hành thêm **một dòng lên trên cùng**. Dòng "store" mới nhất = version đang trên App Store.
Cột "Số" theo quy ước: store `X.Y.Z` · OTA `X.Y.Z-ota.K`.

| Ngày | Loại | Số | Build `N` | Tóm tắt (viết được cho What's New) | Nợ listing |
|---|---|---|---|---|---|
| 15/09/2026 | store | `1.0.2` | 18 (commit `8bfdf176`) | (mốc — bản đang Ready for Distribution) | — |

---

## 5. Tài liệu local cũ

Trên máy owner có thể còn `mobile/docs/RELEASE_WHATS_NEW.md` (không commit). Tài liệu đó tả hệ thống
`CHANGELOG.md` + `store.config.js` + workflow `mobile-release.yml` chưa từng có trong repo, và bảo OTA chạy
`npm run version:patch`. Việc này **làm hỏng OTA** (§1). Tài liệu này và `docs/QUY_TRINH_PHAT_HANH.md` §7.1 thay thế nó.
