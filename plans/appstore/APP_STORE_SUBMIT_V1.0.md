# 🚀 Nộp DeutschFlow v1.0 lên App Store — Tài liệu chính thức (FREE-ONLY)

**Trạng thái: SẴN SÀNG NỘP sau các bước owner — KHÔNG còn blocker code/backend.**
Toàn bộ backend đã deploy + healthy, legal đã live free-only, delete-account đã vá + CI-verified, build-config `app.json`/`eas.json` sẵn sàng. Việc còn lại **100% là thao tác tay của chủ app** (chạy EAS build, tạo demo account mới, dán metadata, điền form ASC). Bản này nộp **FREE-ONLY**: không quảng cáo, không mua trong app — monetization để dành **v1.1**. **Deadline nộp ~6–7/7/2026.**

**Tọa độ chốt (dán thẳng, không đoán lại):**

| Khóa | Giá trị |
|---|---|
| Apple ID (ascAppId) | `6785281013` |
| Bundle ID | `com.cudinh.mydeutschflow` |
| Apple Team ID | `4M3CU3X9SS` |
| EAS projectId | `26fa9e21-f563-4891-953e-e00c704c3c6b` |
| EAS owner | `cudinh3502` |
| Privacy Policy | `https://mydeutschflow.com/privacy` |
| Terms of Use | `https://mydeutschflow.com/terms` |
| Support URL | `https://mydeutschflow.com/support` |
| Backend health | `https://api.mydeutschflow.com/actuator/health` → `{"status":"UP"}` |
| Data controller (legal) | `Cu Dinh` |
| Agreement | **Free Apps Agreement = ACTIVE** (không cần Paid Apps Agreement) |

---

## 📊 Trạng thái một-dòng

> **~90% XONG.** Mọi thứ code/backend/legal/metadata đã sẵn sàng và verify. **Hành động kế tiếp DUY NHẤT: chạy `eas build --platform ios --profile production` trong `mobile/`.** Trong lúc build chạy (~20–40'), điền song song metadata trong App Store Connect; còn 2 việc tay bắt buộc trước Submit: (1) **tạo mới tài khoản demo** (trial 7 ngày), (2) **sửa lại khối reviewer-notes** cho đúng cơ chế AI.

---

## ✅ 1. ĐÃ XONG (đã verify)

Tất cả các mục dưới đây đã được **xác minh độc lập** — curl endpoint thật + đọc code/file thật (không dựa vào audit/memory cũ). Ngày kiểm chứng: **2026-07-03**.

| # | Hạng mục | Trạng thái | Bằng chứng (đã verify) |
|---|----------|:---------:|----------------------------------|
| 1 | **Legal LIVE, free-only** | ✅ XONG | `curl` `/privacy` = **200**, `/terms` = **200**. `grep -i admob` trên `/privacy` = **rỗng**. Trang ghi rõ **"does not show advertising"**. `/terms` chỉ có phủ định: *"App contains no in-app purchases and no subscriptions"* — KHÔNG có auto-renew/gói trả phí. |
| 2 | **Backend deployed + healthy** | ✅ XONG | `curl https://api.mydeutschflow.com/actuator/health` → `{"status":"UP"}` HTTP **200**. |
| 3 | **Flyway V243 applied** | ✅ XONG | Migration `backend/src/main/resources/db/migration/V243__fix_dayofweek_check_iso.sql` (sửa CHECK `day_of_week` → ISO 1-7, cho phép tạo lịch Chủ Nhật). Backend prod đang UP với schema này. |
| 4 | **Delete-account FIXED + CI-verified** | ✅ XONG | `AccountDeletionService.java` xử lý đúng 2 FK không-cascade: `DELETE FROM messages WHERE sender_id = ? OR recipient_id = ?` + `DELETE FROM class_channel_messages WHERE sender_id = ?` và `UPDATE ... SET deleted_by = NULL`. Test DB thật `AccountDeletionServiceDbTest.java` chạy vs Postgres thật trong CI (2/2 pass). **KHÔNG còn broken.** |
| 5 | **Web pricing free-only LIVE** | ✅ XONG | `/terms` khẳng định *"free with no in-app purchases and no subscriptions in this version"* — không ULTRA/MoMo/Stripe lộ ra. |
| 6 | **Mobile build-config READY** (`app.json`) | ✅ XONG | `version 1.0.0`, `bundleIdentifier com.cudinh.mydeutschflow`, `supportsTablet:false`, `ITSAppUsesNonExemptEncryption:false`, `NSPrivacyTracking:false`, `privacyManifests` đầy đủ, icon `./assets/icon.png`. |
| 7 | **EAS production config** (`eas.json`) | ✅ XONG | `cli.appVersionSource:"remote"` + `build.production.autoIncrement:true` + `submit.production.ios.appleTeamId:"4M3CU3X9SS"`. buildNumber tự tăng khi build. |
| 8 | **Không có gói ads/IAP/ATT** | ✅ XONG | `grep` `mobile/package.json` cho admob / expo-iap / react-native-iap / revenuecat / tracking-transparency → **rỗng**. Sạch, đúng free-only. |
| 9 | **Paywall iOS-disabled** | ✅ XONG | `mobile/lib/paywall.ts`: `export const PAYWALL_ENABLED = Platform.OS !== 'ios'` — tuân thủ Guideline 3.1.1 (không paywall khi chưa có StoreKit IAP). |
| 10 | **Branch protection ON (main)** | ✅ XONG | `gh api .../branches/main/protection` → required contexts = **`["Compile","Unit Tests"]`**. |
| 11 | **Icon sẵn sàng** | ✅ XONG | `mobile/assets/icon.png` = **1024×1024**, `hasAlpha=no`. Store lấy icon từ build (không upload riêng). |
| 12 | **Metadata sources (paste-ready)** | ✅ XONG | Cả 4 file tồn tại: `plans/appstore/STORE_COPY.md`, `APP_PRIVACY_LABELS.md`, `SCREENSHOTS_ICON_SPEC.md`, `MONETIZATION_V1.1_SPEC.md`. |

### 3 mục "CRITICAL" mà audit cũ gắn cờ — KHÔNG phải blocker

Một audit trước đây báo động 3 lỗi build mobile. Cả 3 đã bị **bác bỏ (adversarially refuted)** là **stale gitignored `ios/` artifacts** mà EAS **tự sinh lại từ `app.json`** khi build cloud — **KHÔNG chặn nộp**:

| "Critical" cũ (SAI) | Vì sao KHÔNG phải blocker |
|---------------------|---------------------------|
| `DeutschFlow.entitlements` rỗng | File `ios/` là artifact gitignored; EAS regenerate từ `app.json` lúc build. |
| `EXUpdatesEnabled=false` | Cấu hình thật ở `app.json` → `updates.url` (`u.expo.dev/26fa9e21…`) + `runtimeVersion.policy:"fingerprint"`; EAS ghi đè Info.plist. |
| Thiếu `ascAppId` | `ascAppId` **6785281013** đã biết và truyền lúc `eas submit`; không cần nằm trong `ios/` artifact. |

**Kết luận:** phần "ĐÃ XONG" đứng vững. Legal live free-only, backend deployed + healthy (V243), delete-account đã vá + CI-verified vs Postgres thật, web pricing free-only, build-config sẵn sàng, branch protection bật, toàn bộ nguồn metadata paste-ready. Không có blocker code/backend nào ẩn.

**File paths liên quan (tuyệt đối):**
- `/Users/dinhcu/Developer/DeutschFlow/mobile/app.json`
- `/Users/dinhcu/Developer/DeutschFlow/mobile/eas.json`
- `/Users/dinhcu/Developer/DeutschFlow/mobile/lib/paywall.ts`
- `/Users/dinhcu/Developer/DeutschFlow/mobile/assets/icon.png`
- `/Users/dinhcu/Developer/DeutschFlow/backend/src/main/java/com/deutschflow/user/service/AccountDeletionService.java`
- `/Users/dinhcu/Developer/DeutschFlow/backend/src/test/java/com/deutschflow/user/service/AccountDeletionServiceDbTest.java`
- `/Users/dinhcu/Developer/DeutschFlow/backend/src/main/resources/db/migration/V243__fix_dayofweek_check_iso.sql`
- `/Users/dinhcu/Developer/DeutschFlow/plans/appstore/STORE_COPY.md`
- `/Users/dinhcu/Developer/DeutschFlow/plans/appstore/APP_PRIVACY_LABELS.md`
- `/Users/dinhcu/Developer/DeutschFlow/plans/appstore/SCREENSHOTS_ICON_SPEC.md`
- `/Users/dinhcu/Developer/DeutschFlow/plans/appstore/MONETIZATION_V1.1_SPEC.md`

---

## ⚠️ 2. CẦN CHỈNH SỬA / LÀM TRƯỚC KHI NỘP

> Danh sách **bắt buộc xử lý trước khi bấm Submit for Review**. Mỗi mục ghi rõ: **sai ở đâu → sửa thế nào → loại việc** (📄 *sửa file/doc* hay 🌐 *thao tác ASC*). Sắp theo mức độ chặn nộp.

### Bảng tổng quan

| # | Việc | Loại | Chặn nộp? | ☐ |
|---|------|------|-----------|---|
| 2.1 | Viết lại **Reviewer Notes** cho đúng cơ chế trial 7 ngày (bản hiện tại SAI) | 📄 Doc → 🌐 dán ASC | 🔴 CAO — dễ bị reject vì "app broken" | ☐ |
| 2.2 | **Tạo mới demo account** (fresh, < 7 ngày) ngay sát giờ nộp | 🌐 App + ASC | 🔴 CAO — account cũ làm AI trông như hỏng | ☐ |
| 2.3 | **Điền placeholder** `[[demo-email]]`… vào ASC lúc nộp | 🌐 ASC | 🔴 CAO — thiếu demo login = reject ngay | ☐ |
| 2.4 | **Xác nhận tên seller hợp pháp** (`LEGAL_NAME` = "Cu Dinh" tạm) khớp CCCD/Apple | 📄 Doc + 🌐 ASC | 🟡 TRUNG BÌNH | ☐ |
| 2.5 | Chốt **1 số điện thoại** cho ô App Review contact | 🌐 ASC | 🟡 TRUNG BÌNH | ☐ |
| 2.6 | (Đề phòng) Rà lại **Description** không hứa "unlimited"/"ad-free" | 📄 Đọc lại | 🟢 THẤP | ☐ |

---

### 2.1 🔴 Reviewer Notes đang MÔ TẢ SAI — phải viết lại

**Sai ở đâu.** `plans/appstore/STORE_COPY.md` §*App Review Information* nói với Apple rằng khi mở AI Speaking sẽ thấy *"an intentional 'Tính năng PRO' lock card … NOT an error"*. **KHÔNG đúng với code.** Sự thật đã kiểm chứng:

| Điều notes nói | Thực tế trong code |
|---|---|
| "AI Speaking bị Pro-gate hoàn toàn, chỉ thấy lock card" | Tài khoản mới có **PRO trial 7 ngày** (`AuthService.register` → `provisionSevenDayTrial(...)`). Trong 7 ngày này **AI Speaking chat CHỮ CHẠY BÌNH THƯỜNG** (persona Emma/Anna free). `usePlanStore` đọc `/auth/me/plan` → `isPro = true` suốt trial. |
| "Không có purchase path nên chỉ hiện lock" | Chỉ **2 thứ** bị chặn khi chưa Pro: (a) **trả lời bằng giọng nói** → `speaking.tsx` `Alert.alert('Tính năng PRO', 'Trả lời bằng giọng nói cần PRO...')`; (b) **persona nâng cao (difficulty)** khoá trong `CompanionSelect.tsx` (Emma/Anna vẫn mở). |
| "Hết trial hiện lock card, không phải lỗi" | Hết 7 ngày, backend ném `QuotaExceededException("Gói dùng thử 7 ngày đã hết hạn. Hãy nâng cấp để tiếp tục.")` (`QuotaService.java`) → app hiện **Alert dialog** tiêu đề **"Lỗi"** (`speaking.tsx` `Alert.alert('Lỗi', apiMessage(e))`). Có chủ đích, **không crash** — nhưng KHÔNG phải "lock card" như notes mô tả. |

**Rủi ro:** nếu reviewer đăng nhập bằng account **đã quá 7 ngày** và kỳ vọng "lock card đẹp", họ sẽ thấy **dialog tiêu đề "Lỗi"** → hiểu nhầm app hỏng → **reject** (Guideline 2.1). Notes phải mô tả đúng, VÀ mục 2.2 phải đảm bảo account còn trong trial.

**Cách sửa.** 📄 Sửa `plans/appstore/STORE_COPY.md` — thay nguyên khối "Notes to reviewer" bằng bản dưới đây (đã viết đúng thực tế, sẵn để dán vào ASC → *Version → App Review Information → Notes*):

```
DeutschFlow is a German-learning app (A1–B1 Goethe/ÖSD prep). Sign in with the primary demo
account above. This version is FREE-ONLY: there are NO ads and NO in-app purchases anywhere
in the app — there is no purchase button, StoreKit is not wired in this build.

FREE 7-DAY AI TRIAL (this is by design, not a bug)
• Every new account automatically starts a 7-day full-access trial. The demo accounts we
  provided were created fresh right before submission, so they are inside this trial window.
• During the trial, AI Speaking works: open Luyện nói (Speaking), pick Emma or Anna, and hold
  a German text conversation — you'll get real AI replies and feedback. This is the core free
  experience.
• Two things are reserved for the paid Pro plan even during/after trial: (a) answering by VOICE
  (tapping the mic shows a short "Tính năng PRO — trả lời bằng giọng nói cần PRO; bạn vẫn có thể
  gõ" notice, and typing still works), and (b) a few advanced (harder) speaking personas, which
  appear with a small lock icon. Emma and Anna are always free.

AFTER THE TRIAL (only relevant if you test with an aged account)
• Once the 7-day trial ends, AI requests return an intentional notice reading "Gói dùng thử 7
  ngày đã hết hạn. Hãy nâng cấp để tiếp tục." (7-day trial ended — please upgrade to continue).
  This is a deliberate, handled message — NOT a crash. Because v1.0 has no in-app purchase,
  there is intentionally no upgrade button; monetization ships in a later version.

WHAT WORKS FOR FREE (no trial needed, no purchase)
• Lessons & practice under the Học (Learn) tab: vocabulary, grammar, listening, reading.
• Streaks, spaced-repetition review queue, and the full learning path.

ACCOUNT DELETION (Guideline 5.1.1(v))
• In-app deletion: Hồ sơ (Profile) → Xóa tài khoản (Delete account). This permanently deletes
  the account and its data. PLEASE USE THE SECONDARY demo account below for this test, so the
  primary demo login is preserved for the rest of your review.

Privacy Policy: https://mydeutschflow.com/privacy
```

> Sau khi sửa doc, ➜ **🌐 copy khối này dán vào ASC** ô *Notes*. Đồng thời cập nhật ghi chú kiểm chứng cuối file STORE_COPY (bản cũ viết "opening them shows an intentional lock card" là **sai**).

---

### 2.2 🔴 Demo account phải được tạo MỚI ngay trước khi nộp

**Sai ở đâu.** Vì trial = PRO 7 ngày (mục 2.1), một account đã **quá 7 ngày** sẽ khiến AI trả về "hết hạn dùng thử" → reviewer tưởng app hỏng. Lưu ý: `AuthService.login` **tự cấp lại** 7 ngày cho student có 0 subscription, nhưng account demo đã dùng sẽ có sẵn 1 subscription hết hạn → **không** được top-up lại. Vậy **không thể tái dùng account demo cũ** — phải tạo mới.

**Cách sửa.** 🌐 Thao tác (làm **cùng ngày nộp**, chậm nhất T-1):

1. Tạo **2 tài khoản student mới** qua đăng ký app/web:
   - **Primary demo** — đăng nhập, học ~15–20 phút (vài bài Học, 1 phiên AI Speaking với Emma/Anna) để có dữ liệu thật khi reviewer xem.
   - **Secondary demo** — tạo xong **để trống, không đụng vào** — dành riêng cho test *Xóa tài khoản* (để không xoá mất primary).
2. 🌐 Điền cả 2 cặp email/password vào ASC → *App Review Information* (đè placeholder ở mục 2.3).
3. ⏱️ **Đừng tạo sớm.** Tạo T-6/T-7 ngày là rủi ro — nếu review kéo dài, account rơi khỏi trial giữa chừng. Tạo càng sát giờ nộp càng an toàn (còn full 7 ngày đệm).

---

### 2.3 🔴 Điền các placeholder `[[…]]` trong STORE_COPY (tại thời điểm nộp)

**Sai ở đâu.** `STORE_COPY.md` §App Review Information còn để trống dạng placeholder — **KHÔNG bao giờ để nguyên trong ASC**:

| Placeholder | Điền bằng | Nguồn |
|---|---|---|
| `[[demo-email]]` / `[[demo-password]]` | Primary demo (mục 2.2) | Account tạo mới |
| `[[delete-demo-email]]` / `[[delete-demo-password]]` | Secondary demo (mục 2.2) | Account tạo mới |
| `[[support-contact-name]]` | Tên liên hệ (vd "Cu Dinh") | — |
| `[[phone]]` | Số điện thoại review (mục 2.5) | — |

**Cách sửa.** 🌐 Đây là **thao tác điền trực tiếp vào ASC**, không bắt buộc sửa file repo (repo giữ template có placeholder là đúng ý đồ). Khi ở màn *Submit for Review*, điền 4 dòng trên vào ô *App Review Information*. **Đừng commit mật khẩu demo vào git.**

---

### 2.4 🟡 Xác nhận tên seller hợp pháp (`LEGAL_NAME`)

**Sai ở đâu.** `frontend/scripts/gen-legal.mjs` đang đặt `LEGAL_NAME_EN/VI = 'Cu Dinh'` — comment ghi rõ đây là **giá trị tạm** ("interim identifier"), phải khớp tên Apple hiển thị là seller + tên trên CCCD. Tên này đã render vào `/privacy` `/terms` **đang LIVE** (data controller = "Cu Dinh"), nên nếu sai thì cả trang pháp lý công khai lẫn App Privacy đều lệch tên.

**Cách sửa.**
1. 🌐 Mở **ASC → Business / Agreements** xem tên seller Apple đã đăng ký (đối chiếu tên đầy đủ trên CCCD).
2. **Nếu trùng "Cu Dinh"** → không cần làm gì, chỉ tick xác nhận.
3. **Nếu khác** → 📄 sửa `LEGAL_NAME_EN` và `LEGAL_NAME_VI` trong `gen-legal.mjs`, rồi:
   ```bash
   cd frontend && node scripts/gen-legal.mjs   # regenerate src/content/legal/{privacy,terms}.ts
   ```
   → commit → **redeploy web** (Amplify) để `/privacy` `/terms` hiển thị đúng tên **trước khi** khai App Privacy trong ASC.

> v1.0 free-only **không cần Paid Apps Agreement**, nên tên seller chỉ ràng buộc với trang pháp lý + App Privacy, chưa ràng W-8BEN/thuế ở version này. Nhưng khớp tên ngay từ đầu tránh phải sửa lại legal ở v1.1.

---

### 2.5 🟡 Chốt số điện thoại cho ô App Review contact

**Sai ở đâu.** ASC bắt buộc *App Review Information → Contact* có **first name, last name, phone, email**. Email đã có (`dinhhuycu0305@gmail.com`); còn thiếu **số điện thoại** (`[[phone]]`). Trang `/privacy` live đã "discloses phone number" → dùng **cùng số đó** cho nhất quán.

**Cách sửa.** 🌐 Điền số điện thoại (định dạng quốc tế, vd `+84…`) vào ô Contact trong ASC. Không cần sửa repo.

---

### 2.6 🟢 (Đề phòng) Đọc lại Description — không hứa hẹn sai

**Sai ở đâu.** Trước 2026-07-03, Description EN+VI từng ghi "ad-supported"/"ad-free"/subscription disclosure — **đã gỡ**. Đây chỉ là **đọc lại lần cuối**.

**Cách kiểm.** 📄 Xác nhận Description hiện tại **không** chứa: "unlimited", "ad-free", "auto-renewable", "subscription". Câu về AI đúng phải là *"some advanced AI features (such as AI Speaking) are marked Pro; in-app purchasing will arrive in a future update"* → khớp build free-only (tránh Guideline 2.3.1 metadata-mismatch). Nếu đúng → không cần làm gì.

### Ghi chú kiểm chứng (mục 2)

- Trial 7 ngày: `backend/.../user/service/StudentTrialSubscriptionProvisioner.java` + `AuthService.java` (register & login top-up khi 0 sub).
- `isPro` = tier PRO từ `/auth/me/plan`: `mobile/stores/usePlanStore.ts`.
- Voice = PRO: `mobile/app/(student)/speaking.tsx`. Persona nâng cao khoá: `mobile/components/speaking/CompanionSelect.tsx` (Emma/Anna free: `mobile/lib/personas.ts`).
- Thông báo hết trial: `backend/.../common/quota/QuotaService.java` → app hiện qua `Alert.alert('Lỗi', apiMessage(e))` — có chủ đích, không crash.
- Tên seller tạm: `frontend/scripts/gen-legal.mjs` (`'Cu Dinh'`, comment "interim").

---

## ▶️ 3. CÁC BƯỚC LÊN STORE (từng bước)

> Các bước gắn 🏗️ **cần build EAS**; các bước 🖥️ **làm song song** trong ASC lúc build chạy (~20–40'). Làm **đúng thứ tự dưới đây**.

### Sơ đồ luồng (thứ tự thực tế)

```
E0 tiền-điều-kiện ─┐
                   ├─► E1 eas build (chạy nền ~20–40') ──────────────┐
D1 tạo app record ─┘                                                 │
D2 App Information ─► D3 Pricing ─► D4 App Privacy ─► D5 Version    │
   metadata ─► D6 screenshots  (làm SONG SONG lúc build chạy)        │
                                                                     ▼
                          E2 eas submit ──► (build lên ASC ~10–30')  │
                                                                     ▼
                          D7 gắn build ► App Review Info ► Submit ◄──┘
                                                                     │
                                                                     ▼
                                              F (tùy chọn) DSA / EU
```

---

### E0 — Tiền điều kiện (làm 1 lần, trước tất cả)

| # | Việc | Cách kiểm | Trạng thái |
|---|---|---|---|
| E0.1 | Đăng nhập EAS đúng owner | `cd mobile && npx eas whoami` → phải là `cudinh3502` | owner trong app.json = `cudinh3502` |
| E0.2 | Có quyền Apple Developer + đã ký **Free Apps Agreement** | ASC → **Business** → Agreements = *Active* | ✅ Free Apps = ACTIVE |
| E0.3 | Xác nhận legal URL sống | `curl -sL -o /dev/null -w "%{http_code}" https://mydeutschflow.com/privacy` | ✅ `/privacy` `/terms` `/support` đều **200** |
| E0.4 | Xác nhận backend prod UP | `curl -s https://api.mydeutschflow.com/actuator/health` | ✅ `{"status":"UP"}` |
| E0.5 | Icon + config sẵn sàng | `sips -g pixelWidth -g pixelHeight -g hasAlpha mobile/assets/icon.png` | ✅ 1024×1024, hasAlpha=no; app.json v1.0.0, bundle/team/`supportsTablet:false`/`ITSAppUsesNonExemptEncryption:false` OK |

> 💡 **KHÔNG cần đụng vào `ios/`** (entitlements/EXUpdatesEnabled/ascAppId). Đó là artifact gitignored — EAS **sinh lại** từ `app.json` + `eas.json` mỗi lần build.

---

### 🏗️ E1 — Build production trên EAS *(chạy TRƯỚC — vì E2/D7 cần nó)*

```bash
cd mobile
eas build --platform ios --profile production
```

**Lần đầu chạy, EAS sẽ hỏi — chọn để EAS tự quản (Expo-managed credentials):**

| Prompt | Chọn | Ghi chú |
|---|---|---|
| *Generate a new Apple Distribution Certificate?* | **Yes** (Let EAS manage) | EAS tạo & lưu cert phân phối |
| *Generate a new Provisioning Profile?* | **Yes** (Let EAS manage) | gắn bundle `com.cudinh.mydeutschflow` |
| *Set up Push Notifications (APNs key)?* | **Yes** | app có `expo-notifications` → cần APNs key; EAS tạo & lưu |
| *Log in to your Apple account* | Apple ID chủ app (Team `4M3CU3X9SS`) | dùng app-specific password nếu bật 2FA |

- `eas.json` production đã đặt `appVersionSource: remote` + `autoIncrement: true` → **buildNumber tự tăng**, không sửa tay. `version` marketing = `1.0.0` (từ app.json).
- Build ~20–40'. **Trong lúc chờ, làm ngay D1→D6.** Theo dõi: link EAS in terminal, hoặc `eas build:list`.
- Xong build phải **XANH (finished)**. Nếu đỏ → đọc log, sửa, build lại (không sang E2).

---

### 🖥️ D1 — Tạo / hoàn tất App record trong ASC *(song song E1)*

1. Vào **appstoreconnect.apple.com** → **My Apps**.
2. Nếu app đã tồn tại (Apple ID `6785281013`) → mở nó. Nếu chưa → **➕ → New App**:
   - **Platform:** iOS
   - **Name:** `DeutschFlow` *(STORE_COPY.md → App name)*
   - **Primary language:** *Vietnamese (vi)* hoặc *English (U.S.)* — chọn 1 làm primary; nộp cả 2 locale ở D5.
   - **Bundle ID:** `com.cudinh.mydeutschflow` *(nếu chưa có, tạo App ID này ở developer.apple.com → Identifiers trước)*
   - **SKU:** ví dụ `deutschflow-ios-1` (nội bộ)
   - **User Access:** Full Access
3. Đối chiếu **App Information → General → Apple ID** = `6785281013`.

---

### 🖥️ D2 — App Information

| Ô | Giá trị | Nguồn |
|---|---|---|
| **Subtitle** | EN `Learn German, pass Goethe` · VI `Học tiếng Đức & luyện thi` | STORE_COPY.md |
| **Category → Primary** | **Education** | — |
| **Category → Secondary** | *(để trống hoặc "Reference")* | — |
| **Age Rating → Edit** | trả lời tất cả **None/No** → ra **4+** | app không có nội dung nhạy cảm |
| **Privacy Policy URL** | `https://mydeutschflow.com/privacy` | ✅ live 200 |
| **License Agreement** | Apple's standard EULA (mặc định) | — |

> ⚠️ **Age Rating = 4+**: mọi mục (bạo lực, cờ bạc, nội dung người lớn, unrestricted web…) chọn **None/No**. App có AI chat nhưng phạm vi học tiếng Đức — 4+ hợp lệ.

---

### 🖥️ D3 — Pricing and Availability = **Free, KHÔNG có IAP**

1. **Pricing and Availability** → **Price Schedule** → **Free** (0.00).
2. **Availability:** All countries/regions (tối thiểu VN + Đức).
3. **KHÔNG** vào tab **In-App Purchases / Subscriptions** — **v1.0 không tạo bất kỳ IAP product nào.**

> Free + không IAP → chỉ cần **Free Apps Agreement (đã Active)**, KHÔNG cần Paid Apps Agreement.

---

### 🖥️ D4 — App Privacy *(theo `APP_PRIVACY_LABELS.md`)*

**App Privacy → Edit.** Câu hỏi tổng *"Do you or your partners collect data?"* → **YES**. Với **mọi** loại: *Tracking = **No***; *Linked to user = **Yes***; transport HTTPS.

**Khai (SELECT) các loại sau:**

| Nhóm | Data type | Purpose | Linked | Track |
|---|---|---|---|---|
| **Contact Info** | Email Address | App Functionality | Yes | No |
| | Name | App Functionality | Yes | No |
| | Phone Number | App Functionality | Yes | No |
| **User Content** | Audio Data | App Functionality | Yes | No |
| | Photos or Videos | App Functionality | Yes | No |
| | Other User Content | App Functionality | Yes | No |
| **Identifiers** | User ID | App Functionality, **Analytics** | Yes | No |
| | Device ID | App Functionality | Yes | No |
| **Usage Data** | Product Interaction | Analytics | Yes | No |
| | Other Usage Data | Analytics | Yes | No |

**KHÔNG khai** (đã verify không thu): Diagnostics/Crash (Sentry tắt), Purchases/Payment (no IAP), Advertising Data/IDFA (no ad SDK), Location, Contacts, Calendar, Health, Financial, Browsing History.

- **Tracking toàn cục = No** → giữ `NSPrivacyTracking:false`, không ATT, không `NSUserTrackingUsageDescription`.
- 💡 *(polish, không blocker)*: privacy manifest trong `app.json` hiện chỉ liệt 2 loại analytics & `Linked:false`. Bảng ASC ở trên mới là disclosure bắt buộc. Có thể bổ sung manifest cho khớp ở build sau — không chặn nộp.

---

### 🖥️ D5 — Version metadata *(theo `STORE_COPY.md`, mỗi locale)*

Vào **App Store** tab → chọn version **1.0** → điền cho **cả `vi` và `en-US`**:

| Ô ASC | Giá trị | Nguồn (STORE_COPY.md) |
|---|---|---|
| **Promotional text** | EN 149/170 · VI 152/170 | mục Promotional text |
| **Keywords** | EN 97/100 · VI 99/100 (phẩy, **không space**) | mục Keywords |
| **Description** | EN ~1432 · VI ~1431 (bản **free-only**) | mục Description |
| **Support URL** | `https://mydeutschflow.com/support` | ✅ 200 |
| **Marketing URL** | `https://mydeutschflow.com` *(tùy chọn)* | — |
| **What's New** | EN 178 · VI 168 | mục What's New — v1.0 |
| **Copyright** | `2026 Cu Dinh` | — |

> ⚠️ Description đã là bản free-only ("FREE TO LEARN", "in-app purchasing arrives in a future update"). **Đừng dán bản cũ** có "ad-supported"/"auto-renewable subscription" — vướng Guideline 2.3.1 (metadata lệch build).

---

### 🖥️ D6 — Screenshots *(theo `SCREENSHOTS_ICON_SPEC.md`)*

**Yêu cầu cứng:** 6.9″ = **`1320×2868` px**, portrait, thiết bị **iPhone 16 Pro Max** (lệch 1px là bị reject).

1. Chụp 6 màn cốt lõi (thứ tự = thứ tự hiển thị Store):

   | # | Màn | Route |
   |---|---|---|
   | 1 | Cây học tập / Home | `index.tsx` / `roadmap.tsx` |
   | 2 | **AI Speaking** | `speaking.tsx` |
   | 3 | Thi thử Goethe | `exam.tsx` / `exam-attempt.tsx` |
   | 4 | Bài học | `learn.tsx` / `node.tsx` |
   | 5 | SRS / Từ vựng | `srs.tsx` / `vocabulary.tsx` |
   | 6 | Tiến độ / Stats | `stats.tsx` |

2. **Ảnh #2 (AI Speaking) PHẢI chụp từ tài khoản CÓ PRO/trong-trial** — trên tài khoản đã hết trial nó hiện thông báo "hết hạn", không đẹp. Dùng tài khoản demo mới (còn trial) hoặc cấp PRO tạm qua admin rồi hạ lại; App Review chấp nhận vì tính năng có thật.
3. Chụp bằng simulator:
   ```bash
   xcrun simctl io booted screenshot ~/Desktop/deutschflow-ss-01.png
   # ... -02 ... -06
   ```
4. **Verify bắt buộc:**
   ```bash
   for f in ~/Desktop/deutschflow-ss-*.png; do sips -g pixelWidth -g pixelHeight "$f"; done
   # phải: 1320 × 2868 mỗi ảnh
   ```
5. Upload lên ASC ở khối **iPhone 6.9″** (mỗi locale một bộ). **KHÔNG upload iPad** (`supportsTablet:false`). **KHÔNG** chụp paywall/ads. Ẩn PII.

> ✅ **Icon**: không upload riêng — Store lấy icon từ build (`mobile/assets/icon.png` đã trong build).

---

### 🏗️ E2 — Submit build lên ASC *(sau khi E1 XANH)*

```bash
cd mobile
eas submit --platform ios --latest
```

- Prompt **App Store Connect app** → nhập **ascAppId `6785281013`** (hoặc chọn app khớp bundle `com.cudinh.mydeutschflow`).
- Đăng nhập Apple (Team `4M3CU3X9SS`, app-specific password nếu 2FA).
- EAS đẩy build lên; ASC **xử lý ~10–30'** (tab **TestFlight → Builds** hiện "Processing" → xong). Đã set `ITSAppUsesNonExemptEncryption:false` nên thường **không** hỏi export compliance.

---

### 🏗️ D7 — Gắn build → App Review Information → Submit for Review

*(cần build đã Processing xong ở E2)*

1. Về **App Store** tab → version **1.0** → mục **Build** → **➕ Select a build** → chọn build vừa lên.
2. **App Review Information** *(theo `STORE_COPY.md`)*:

   | Ô | Giá trị |
   |---|---|
   | **Sign-in required** | **Yes** |
   | **Demo account (primary)** | `[[demo-email]]` / `[[demo-password]]` — **STUDENT tạo mới, đã dùng ~20' có dữ liệu học thật** |
   | **Demo account (secondary, test xóa TK)** | `[[delete-demo-email]]` / `[[delete-demo-password]]` — fresh, dành riêng test delete |
   | **Contact** | `Cu Dinh` · `dinhhuycu0305@gmail.com` · `[[phone]]` |
   | **Notes** | dán khối "Notes to reviewer" **đã sửa ở mục 2.1** |

   > ⚠️ **2 điều bắt buộc (vì "free" thực chất là trial 7 ngày PRO-lite):**
   > 1. **Demo PRIMARY phải TẠO MỚI ngay trước khi nộp** (mục 2.2) — trong 7 ngày đầu account DEFAULT được PRO-lite: AI Speaking chat TEXT chạy được (Emma/Anna); chỉ voice-input + persona nâng cao là Pro. Account quá 7 ngày → reviewer gặp "trial expired" tưởng app hỏng.
   > 2. **Dùng khối review-notes ĐÃ SỬA ở mục 2.1** — KHÔNG dán bản cũ "AI shows an intentional PRO lock card".

3. **Version Release:** *Automatically release* (hoặc *Manually*).
4. Kéo lên đầu trang → **Add for Review** → **Submit for Review**.
5. Popup **Export Compliance** nếu hiện: *Does your app use encryption?* → **No** (đã khai `ITSAppUsesNonExemptEncryption:false`; chỉ HTTPS chuẩn).
6. Trạng thái chuyển **Waiting for Review**. ✅ Xong phần nộp.

---

### F — (Tùy chọn) DSA / EU Trader compliance

- Trong **App Information** / **App Availability**, ASC có thể hỏi **Digital Services Act (DSA) — Trader status** cho phân phối EU (gồm **Đức** — thị trường chính).
- Khai **Trader** = *No* (nếu cá nhân không thương mại) hoặc *Yes* + tên/địa chỉ/email/điện thoại liên hệ công khai. **Chưa khai DSA có thể chặn phân phối tại EU** dù app đã duyệt.
- Data controller privacy = **"Cu Dinh"** — dùng đồng nhất tên/email liên hệ này nếu khai Trader.
- v1.0 free-only không đổi bản chất DSA; điền khi ASC nhắc.

---

### ✅ Checklist nộp nhanh (Section 3)

- [ ] E0: `eas whoami`=cudinh3502, Free Agreement Active, /privacy·/terms·/support = 200, health UP, icon 1024/no-alpha
- [ ] 🏗️ E1: `eas build … production` XANH (accept EAS cert + provisioning + APNs)
- [ ] D1: app record, Apple ID `6785281013`, bundle `com.cudinh.mydeutschflow`
- [ ] D2: Subtitle · Category=Education · Age 4+ · Privacy URL = mydeutschflow.com/privacy
- [ ] D3: **Free**, **không tạo IAP**
- [ ] D4: App Privacy đủ 4 nhóm (Contact/User Content/Identifiers/Usage), Tracking=No
- [ ] D5: Promo/Keywords/Description(free-only)/What's New cho `vi` + `en-US`
- [ ] D6: 6 ảnh `1320×2868` verify bằng `sips`; AI Speaking chụp từ account còn trial; không iPad/paywall/ads
- [ ] 🏗️ E2: `eas submit … --latest` (nhập ascAppId `6785281013`), build Processing xong
- [ ] 🏗️ D7: gắn build · demo PRIMARY **tạo mới** · review-notes **bản đã sửa (2.1)** · Submit
- [ ] F: DSA/EU Trader nếu ASC nhắc (thị trường Đức)

---

## 🔵 4. ĐỂ DÀNH CHO v1.1 — Monetization

> **v1.0 nộp FREE-ONLY.** Toàn bộ lớp kiếm tiền **cố ý** để lại cho **v1.1** (~2 tuần sau khi v1.0 duyệt), gói trong **MỘT** production build mới. Spec đầy đủ (economics, margin, SQL migration, code mobile):
>
> 📄 **`plans/appstore/MONETIZATION_V1.1_SPEC.md`** (9 mục: tier model → ad mechanics → economics → backend → mobile → IAP → legal → build sequencing → calibration)
> 🔧 Kèm: **`plans/appstore/MONETIZATION_TECH_PLAN.md`** (chi tiết `expo-iap`, prebuild, SKAdNetwork)

### Cái gì KHÔNG có trong v1.0, và sẽ thêm ở v1.1

| Hạng mục | v1.0 (nộp lần này) | v1.1 (để dành) | Nền tảng sẵn? |
|---|---|---|---|
| **Rewarded ads** (AdMob) | ❌ Không có package quảng cáo | ✅ 1 ad = **2 lượt nói**, mic **cap 15s/lượt**, credit **tiêu hao** (consumable), ~5 ads/ngày | Chưa — code mới |
| **Paid PRO** (Apple IAP) | ❌ Không IAP; paywall **tắt trên iOS** | ✅ Bán PRO (tháng + năm) qua StoreKit `expo-iap` | ✅ **Backend V189 đã build xong** |
| **ULTRA tier** | ❌ Ẩn | ⏸️ Vẫn **inactive** (v1.1 = PRO-only) | Seed sẵn `is_active=FALSE` |
| **Legal / App Privacy** | Free-only: **không** khai AdMob/subscription | ⚠️ Phải **RE-ADD** AdMob + subscription | Cần sửa lại privacy/terms + ASC labels |

### 4.1 Rewarded ads (chỉ cho user FREE đã hết trial)

- **Loop:** user FREE hết trial (plan `DEFAULT`, 0 token/ngày) tap mic khi hết credit → xem 1 rewarded ad → nhận **2 lượt nói**, mỗi lượt mic **auto-stop cứng ở 15.000 ms**.
- **Denominated theo audio-giây**, KHÔNG theo câu/token — chi phí biến đổi duy nhất là **Whisper STT ≈ 2,54đ/giây**; cap 15s đảm bảo 1 ad không tốn quá ~76đ STT.
- **AdMob non-personalized** (`requestNonPersonalizedAdsOnly: true`) → **không ATT prompt**, `NSPrivacyTracking` giữ `false`.
- **Chống gian lận = AdMob SSV backend** (Server-Side Verification, callback ký ECDSA), **không tin client**. Code mới: `AdMobSsvVerifier` + `AdCreditService` + migration `user_ad_speaking_credits` / `ad_reward_events`.
- **Guideline 3.1.1-safe:** reward là **credit tiêu hao**, không mở khóa tier vĩnh viễn, không thay nút mua — PRO thật vẫn chỉ bán qua IAP.

### 4.2 Paid PRO qua Apple IAP — backend đã sẵn, chỉ còn config

Backend IAP **đã build & trưởng thành (V189)**: verify JWS StoreKit2, replay-guard, idempotency, ASSN V2 notifications — **net-new backend ≈ 0**. Client dùng **`expo-iap`** (KHÔNG RevenueCat). Còn lại đúng **3 việc**:

| # | Việc | Trạng thái trong repo | Sửa ở đâu |
|---|---|---|---|
| 1 | **`APPLE_BUNDLE_ID` sai default** | `AppleJwsVerifier.java` default `com.deutschflow.app`, bundle thật = `com.cudinh.mydeutschflow` (`app.json`) → mọi verify **reject** | Set env `APPLE_BUNDLE_ID=com.cudinh.mydeutschflow` + `APPLE_APP_APPLE_ID` + `APPLE_ROOT_CERT_DIR` + `APPLE_IAP_ENVIRONMENT` |
| 2 | **Product IDs là placeholder** | `V189__apple_iap.sql` seed `com.deutschflow.app.pro.*` (hiện sẽ "Unrecognized product") | Migration **V244** đổi sang `com.cudinh.mydeutschflow.pro.{monthly,yearly}` |
| 3 | **Paywall iOS đang TẮT** | `mobile/lib/paywall.ts` = `Platform.OS !== 'ios'` | Đổi thành `PAYWALL_ENABLED = true` |

> ✅ Slot migration **V244 còn trống** (cao nhất trong repo hiện là V243) — không đụng.
> ⚠️ Nhớ **đăng ký URL ASSN V2** trong ASC (`.../api/payments/apple/notifications`), nếu không renew/refund/expire không chảy về → sub hết hạn vẫn hiện PRO server-side.

### 4.3 ULTRA tier — vẫn inactive

Đã seed trong V189/V73 nhưng **giữ inactive** theo lock 2026-07-03 (v1.1 = PRO-only). Migration v1.1 nên set `is_active=FALSE` cho các row `plan_code='ULTRA'`.

### 4.4 Legal & App Privacy — phải RE-ADD ở v1.1

v1.0 legal đang **free-only, cố ý sạch**. Khi lên v1.1:
- ➕ Re-add **AdMob** vào privacy policy + **App Privacy labels** (ASC) — non-personalized nên vẫn giữ được "no tracking".
- ➕ Re-add **subscription / auto-renew disclosure** vào terms of use (bắt buộc cho IAP).
- ➕ Vì thêm native SDK (AdMob) → **KHÔNG OTA được**, phải `eas build` production build mới (fingerprint đổi); gói **AdMob + expo-iap chung 1 prebuild** để fingerprint chỉ đổi 1 lần.

**Tóm lại:** v1.1 = bật lớp tiền mà không đụng trải nghiệm free của v1.0. Backend IAP đã xong (chỉ config), rewarded-ad + SSV là code mới, ULTRA vẫn ngủ, legal/App-Privacy phải khai lại AdMob + subscription.

---

## ✅ Điều kiện coi như XONG (Definition of Done)

App được coi là **đã nộp thành công v1.0** khi tất cả các mục sau đúng:

- [ ] **Build XANH:** `eas build --platform ios --profile production` finished; `eas submit --latest` đẩy lên ASC và build ở trạng thái **Processing → hết** (thấy trong TestFlight → Builds).
- [ ] **App record đúng tọa độ:** Apple ID = `6785281013`, bundle = `com.cudinh.mydeutschflow`, Team = `4M3CU3X9SS`.
- [ ] **Pricing = Free, KHÔNG có IAP product nào** trong ASC.
- [ ] **App Privacy khai đủ 4 nhóm** (Contact / User Content / Identifiers / Usage), **Tracking = No** toàn bộ.
- [ ] **Metadata free-only cho cả `vi` + `en-US`:** Subtitle, Keywords, Description (không "unlimited/ad-free/subscription"), What's New, Support URL.
- [ ] **6 screenshots `1320×2868`** (verify bằng `sips`), ảnh AI Speaking chụp từ account **còn trial**, không iPad/paywall/ads.
- [ ] **Demo account PRIMARY + SECONDARY tạo MỚI** (< 7 ngày, còn trial), điền vào ASC — không để placeholder `[[…]]`.
- [ ] **Reviewer Notes = bản ĐÃ SỬA ở mục 2.1** (mô tả đúng: AI text chạy với account mới; voice + persona nâng cao là Pro; hết trial hiện thông báo có chủ đích, không crash; không có nút mua trong app).
- [ ] **App Review Contact đầy đủ:** tên, email `dinhhuycu0305@gmail.com`, **số điện thoại**.
- [ ] **Tên seller (`LEGAL_NAME`) khớp** tên Apple + CCCD; nếu đổi → đã regenerate legal + redeploy web.
- [ ] **Export Compliance = No** (đã khai `ITSAppUsesNonExemptEncryption:false`).
- [ ] **(EU) DSA / Trader status** đã trả lời nếu ASC nhắc (thị trường Đức).
- [ ] **Trạng thái cuối = "Waiting for Review".**

> Khi ô cuối tick, v1.0 đã nằm trong hàng đợi duyệt của Apple. Monetization đợi v1.1 (Section 4).
