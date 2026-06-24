# QA thủ công 2 tài khoản trên prod — 2026-06-24

**Site:** https://mydeutschflow.com (FE Amplify) · API `https://api.mydeutschflow.com/api`
**Người chạy:** Claude (Chrome MCP, click thật như người dùng)
**Phạm vi:** test toàn bộ màn hình + chức năng của 2 tài khoản, ghi lại mọi lỗi.

## Tài khoản test

| Email | Tên | Role nền tảng | Org | Vai trò trong Org | Landing |
|-------|-----|---------------|-----|-------------------|---------|
| `vuhuyen@deutschflow.com` | Vũ Huyền | TEACHER (GV #57) | Org 6 ("ATB") | TEACHER | `/v2/teacher/` |
| `atb@deutschflow.com` | Đinh Huy Cự | — | Org 6 ("ATB") | **MANAGER** (Quản lý) | `/v2/org/` |

> **Quan hệ:** vuhuyen là **giáo viên thuộc org của atb**. Lớp `[QA] A1 Lớp tối 2-4-6` (mã `6566D485`) tôi tạo bằng vuhuyen hiện ra đúng trong console org của atb → luồng teacher↔org liên thông OK.
> **Lưu ý:** KHÔNG có tài khoản học viên (STUDENT) → các đường cần học-viên-nộp-bài chưa test sâu được (xem mục §5).

---

## 0. Bảng tổng hợp mức độ

| # | Mức | Khu vực | Tóm tắt | Trạng thái |
|---|-----|---------|---------|------------|
| H-1 | 🔴 HIGH | Teacher · AI | **Ngữ pháp AI** `POST /api/ai/grammar/correct` → **HTTP 500** (ERR-1) | Mở |
| H-2 | 🔴 HIGH | Teacher · AI | **Tạo ảnh AI** `POST /api/v2/ai-images/generate` → **HTTP 500** (ERR-2) | Mở |
| H-3 | 🔴 HIGH | Auth (mọi role) | `user.id` lưu thành chuỗi `"undefined"` cho **mọi user** | ✅ **Đã fix session này** (chờ deploy) |
| M-1 | 🟠 MEDIUM | Org · Overview | Dashboard org load lần đầu sau login hiện **0 lớp / 0 GV / 0/0 ghế / tiêu đề "Tổ chức"**; chỉ đúng sau khi điều hướng lại | Mở |
| M-2 | 🟠 MEDIUM | Analytics | PostHog `identify("undefined")` bắn 4× mỗi lần login | ✅ gốc đã fix (H-3) |
| L-1 | 🟡 LOW | Teacher + Org | Link **"Trợ giúp"** trỏ về trang chủ (`/v2/teacher/`, `/v2/org/`) thay vì trang help | Mở |
| L-2 | 🟡 LOW | Thông báo | Tiêu đề notification hiện key thô **"LEARNER PLAN UPDATED"** (chưa dịch) | Mở |
| L-3 | 🟡 LOW | A11y | Radix `DialogContent` thiếu `Description`/`aria-describedby` (cảnh báo console) | Mở |
| L-4 | 🟡 LOW | i18n | Chọn **DE** nhưng UI vẫn tiếng Việt (DE chưa dịch đủ); nhãn "LEKTION 1" lẫn trong UI Việt | Mở |
| L-5 | 🟡 LOW | Profile | Tài khoản Org-Manager vẫn thấy tab **"Học tập"** (của học viên) — empty, vô hại | Mở |
| I-1 | ⚪ INFO | Org | "Quản lý gói", "+ Mua thêm ghế", nút "Mời thành viên" ở overview = **"sắp ra mắt"** (stub) | Đã biết |
| I-2 | ⚪ INFO | Teacher · AI | "Tạo Tài liệu AI" = **UI-only**, backend "đang hoàn thiện" (báo rõ trên UI) | Đã biết |

---

## 1. 🔴 HIGH — 2 công cụ AI của giáo viên chết (HTTP 500)

### H-1 · Ngữ pháp AI
- **Đường đi:** `/v2/teacher/tools/grammar/` → nhập câu → "Kiểm tra ngay".
- **Hiện tượng:** UI báo *"Không phân tích được — An unexpected error occurred. Reference: ERR-1"* + nút "Thử lại".
- **Network:** `POST https://api.mydeutschflow.com/api/ai/grammar/correct` → **500**.
- Input test: `Ich habe gestern ins Kino gegangen.`

### H-2 · Tạo ảnh AI
- **Đường đi:** `/v2/teacher/tools/images/` → "Tạo 4 ảnh".
- **Hiện tượng:** *"Không tạo được ảnh — An unexpected error occurred. Reference: ERR-2"* + "Thử lại".
- **Network:** `POST https://api.mydeutschflow.com/api/v2/ai-images/generate` → **500**.

### Phân tích chung
- **Cả hai endpoint AI đều 500** → khả năng cao **cùng một gốc: cấu hình LLM/provider trên prod** (API key thiếu/sai, hết quota, hoặc Bedrock/Groq lỗi).
- Endpoint `grammar/correct` **KHÔNG bị đụng** bởi 10 PR audit vừa deploy → loại trừ khả năng do code mới; nghiêng về **env/provider**.
- Lưu ý kiểm tra chéo: thay đổi P-16 gần đây có sửa `AiImageGenerationService` (thêm `OrgPoolGuard`) — cần xác nhận happy-path không ném exception (org "ATB" có pool **không giới hạn** nên gate không phải nguyên nhân chặn, nhưng vẫn nên review NPE).
- **FE xử lý lỗi tốt** (hiện thông báo + retry, không crash trắng).

**Việc cần làm để fix:**
1. Đọc log backend tại 2 endpoint trên → lấy stacktrace thật.
2. Kiểm tra biến môi trường provider AI trên EC2 (`.env.production`): key Groq/Bedrock, region, model id, quota.
3. Đối chiếu lỗi với bug cũ *AI Grading JSON-mode* (Groq `response_format=json_object` yêu cầu chữ "json" trong prompt) — nếu grammar/image cũng ép JSON-mode thì có thể cùng class lỗi 400/500.
4. Review `AiImageGenerationService` (P-16) cho happy-path.

---

## 2. 🔴 HIGH — `user.id = "undefined"` cho mọi user (ĐÃ FIX)

### Hiện tượng
Đọc `localStorage["deutschflow-user-store"].state.user` cho **cả 2 tài khoản**:
```
user = { id: "undefined", email, roles:[...], displayName }   // id là CHUỖI "undefined"
```

### Gốc rễ
- BE `GET /api/auth/me` trả `AuthResponse` có trường tên **`userId`** (Long), **không phải `id`**.
- FE đọc nhầm `user.id` (undefined) → `String(undefined)` = `"undefined"` rồi lưu vào store.
- Hệ quả: PostHog `identify("undefined")` (M-2), và mọi logic FE dùng `user.id` (so khớp "của tôi", Sentry user, …) sai.

### Đã sửa (session này) — đổi `user.id` → `user.userId` tại:
- `frontend/src/app/v2/login/page.tsx` (setUser + identifyUser)
- `frontend/src/app/v2/register/page.tsx` (identifyUser)
- `frontend/src/app/login/LoginClient.tsx` (setUser + identifyUser)
- `frontend/src/app/register/page.tsx` (identifyUser)

> Phụ chú: `AuthResponse` cũng **không có `avatarUrl`** → `user.avatarUrl` luôn undefined (avatar sidebar không hiện). Chưa fix — cần BE bổ sung field hoặc lấy avatar từ `/profile`.

---

## 3. 🟠 MEDIUM

### M-1 · Org overview sai số liệu ở lần load đầu sau login
- Vừa login atb → `/v2/org/` hiện: **Ghế 0/0 · Lớp đang mở 0 · 0 giáo viên · tiêu đề "Tổ chức"**, danh sách lớp trống, "Không có việc cần xử lý".
- Sau khi bấm qua trang khác rồi quay lại → đúng: **Ghế 0/100 · Lớp đang mở 1 · 1 giáo viên · tiêu đề "ATB"** + lớp hiện ra + "100 ghế chưa phân bổ".
- Các trang con (Phân tích, Lớp học, Giáo viên, Phân quyền, Lời mời) **luôn đúng** (1 lớp, 1 GV, ghế 100) → lỗi chỉ ở **summary của overview lần đầu** → nghi **race hydration** (gọi `getOrgSummary` trước khi `orgId` hydrate xong, hoặc dữ liệu org/seat chưa load → render zero + tên generic).
- Ảnh hưởng: ấn tượng đầu tiên của Manager là "org rỗng".

### M-2 · PostHog `identify("undefined")` ×4 mỗi login
- Console (login): `[PostHog.js] The string "undefined" was set in posthog.identify`.
- Là hệ quả trực tiếp của H-3 → **đã fix gốc**. Nên bổ sung thêm guard trong `useTracking.identifyUser` (bỏ qua khi id rỗng/`"undefined"`) làm lớp phòng vệ.

---

## 4. 🟡 LOW

- **L-1 · "Trợ giúp" trỏ sai:** href = `/v2/teacher/` (teacher) và `/v2/org/` (org) → quay về trang chủ, không có trang help. Cần trang help thật hoặc ẩn link.
- **L-2 · Notification chưa dịch:** tiêu đề hiện `LEARNER PLAN UPDATED` (key enum thô, in hoa tiếng Anh) cho user locale VI.
- **L-3 · A11y:** cảnh báo `Missing Description or aria-describedby for DialogContent` (Radix Dialog) — thêm `aria-describedby`/`<Dialog.Description>`.
- **L-4 · DE chưa dịch đủ:** chọn DE nhưng nội dung vẫn tiếng Việt; nhãn "LEKTION 1" (Đức) lẫn trong UI Việt ở checklist.
- **L-5 · Tab thừa:** Org-Manager vẫn thấy tab "Học tập" (hồ sơ học viên) trong `/v2/profile/` — hiện empty, vô hại nhưng không liên quan vai trò.

---

## 5. Đường có-dữ-liệu CHƯA test được (thiếu tài khoản học viên)

Cần 1 học viên enrolled (hoặc chạy seed SQL) để test:
- **Chấm bài** (`/v2/teacher/grading/`): hàng đợi chấm trống vì chưa có bài nộp.
- Học viên nộp bài → AI chấm sơ bộ → GV xác nhận điểm.
- Tiến độ/điểm kỹ năng học viên trong lớp; roster học viên của org.
- Chấm bài qua ảnh (cần ảnh bài viết tay).

**Cách bù dữ liệu:** chạy `audit/seed_teacher_testdata.sql` trên prod (tạo lớp + 5 HV + bài tập + bài nộp trạng thái hỗn hợp + giáo án + điểm kỹ năng). Hoặc cấp 1 tài khoản STUDENT để test luồng học-viên thật + tự join org bằng mã **ATB**.

---

## 6. ✅ Đã verify CHẠY ĐÚNG

**Teacher (vuhuyen):**
- Trang chủ (đã đổi tên "Trang chủ" ✓) · Kế hoạch giảng dạy (lịch) · Nội dung giảng dạy · **Lịch sử giảng dạy** (thêm bài học + tick hoàn thành → tiến độ 100% ✓) · Chấm bài (empty) · Chấm bài qua ảnh · Thư viện tài liệu · Tin nhắn · **Phân tích** (số liệu đúng) · **Tạo lớp ✓** · **Thêm bài tập ✓** · Class detail.
- **"Phúc khảo" đã biến mất khỏi nav** → lỗi 404 quiz-exam đã được fix & deploy ✓.

**Org (atb):** Tổng quan (sau load) · Học viên · Lớp học + class-detail · Lịch trung tâm · Giáo viên · Phân tích · Lời mời (mã org "ATB", form mời render — **không bấm gửi để tránh email thật**) · Phân quyền · Hồ sơ (3 tab).

---

## 7. Ưu tiên xử lý đề xuất
1. **H-1/H-2** (AI 500) — chặn 2 tính năng lõi của giáo viên. Điều tra env/provider trước.
2. **H-3** — đã fix, **chờ Amplify deploy** rồi verify lại `user.id` là số thật + PostHog hết "undefined".
3. **M-1** — sửa race summary org overview.
4. **L-1..L-5** — gom 1 PR dọn UI/i18n/a11y.
