# DEUTSCHFLOW — RUNBOOK TEST E2E TOÀN HỆ THỐNG (mọi role, full chức năng)

> Dán file này cho Claude (agent lái được trình duyệt + gọi HTTP) chạy tuần tự.
> Kiểu test: **kép UI + API** — mỗi luồng làm trên giao diện rồi đối chiếu kết quả ở tầng API.
> Môi trường: **live** — Frontend `https://mydeutschflow.com` · API `https://api.mydeutschflow.com` (prefix `/api`).

> **GIAO DIỆN CANONICAL = `/v2/*` (Galerie 2.0 — đã full cutover, là default surface).**
> `middleware.ts` tự đẩy user đã đăng nhập vào trang `/v2` theo role. UI root cũ (`/login`, `/student`, `/teacher`, `/org`, `/admin`) chỉ còn là **fallback rollback** (bật/tắt bằng env `GALERIE_V2_DISABLED`). Mọi bước UI bên dưới chạy trên `/v2/*`. Phần API không đổi (cùng backend).
>
> Map trang chủ theo role (đăng nhập xong phải đáp đúng vào đây):
> - ADMIN → `/v2/admin/users`
> - OWNER / MANAGER → `/v2/org`
> - TEACHER → `/v2/teacher`
> - STUDENT → `/v2/student/dashboard`
> - Đăng nhập: `/v2/login` (có Google SSO + "Ghi nhớ đăng nhập" + "Quên mật khẩu"). Auth dùng cookie `auth_access` / `auth_role` (+ `refresh_token`) — không chỉ localStorage.
>
> **Kiểm tra cutover (đáng test):** root cũ vẫn resolve song song (`/login` không 404). Xác nhận middleware đẩy `/student` → `/v2/student/dashboard`, và sai-role vào `/v2/admin/*` thì bị bounce về home đúng role.

---

## 0. AN TOÀN KHI CHẠY TRÊN LIVE (đọc trước, bắt buộc)

- **Chỉ dùng tài khoản test** (§1). Không đụng dữ liệu khách thật.
- **Không thực hiện thanh toán thật.** Payment chỉ chạy ở **sandbox/test mode**; dừng trước bước "capture/confirm" tiền thật. Claude KHÔNG được tự xác nhận giao dịch tiền.
- **Hành động phá hủy** (`DELETE`, đổi role, xoá member/class, đổi trạng thái invoice) chỉ làm trên **entity test dùng-một-lần**, không trên org/class thật. Mỗi DELETE ghi rõ object id trước khi gọi.
- **Negative test** (kỳ vọng 403/401/402/409) là phần quan trọng nhất — đừng bỏ qua. Lỗi "được phép cái đáng lẽ phải cấm" = 🔴.
- Ghi **evidence** mỗi case: HTTP status + đoạn JSON/UI screenshot. Không suy đoán "chắc là pass".

---

## 1. CHUẨN BỊ — tài khoản & biến môi trường

Cần 6 nhóm danh tính (xin từ chủ dự án trước khi chạy):

| Vai trò | Mô tả | Biến |
|---|---|---|
| STUDENT (org) | học viên thuộc 1 tổ chức test | `S_EMAIL/S_PW` |
| STUDENT (B2C) | học viên tự đăng ký, không org | `B2C_EMAIL/B2C_PW` |
| TEACHER | giáo viên trong org test | `T_EMAIL/T_PW` |
| MANAGER | quản lý org test | `M_EMAIL/M_PW` |
| OWNER | chủ org test | `O_EMAIL/O_PW` |
| ADMIN | quản trị nền tảng | `A_EMAIL/A_PW` |
| (PUBLIC) | không đăng nhập | — |

Cần thêm **2 org test khác nhau** (`ORG_A`, `ORG_B`) để test cross-tenant.

### Helper lấy JWT (API side)

```bash
API="https://api.mydeutschflow.com"
login() {  # login <email> <password> -> in ra accessToken
  curl -s -X POST "$API/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin).get("accessToken",""))'
}
S=$(login "$S_EMAIL" "$S_PW"); T=$(login "$T_EMAIL" "$T_PW")
M=$(login "$M_EMAIL" "$M_PW"); O=$(login "$O_EMAIL" "$O_PW"); A=$(login "$A_EMAIL" "$A_PW")
auth(){ echo "-H 'Authorization: Bearer '$1; }   # dùng: curl $(auth $S) ...
```

> Refresh token nằm ở **httpOnly cookie** (login cũng set cookie). UI tự gửi cookie; API muốn test refresh thì giữ cookie jar (`curl -c jar -b jar`).

---

## 2. MA TRẬN ROLE × CHỨC NĂNG (đây cũng là spec test phân quyền)

Ký hiệu: ✅ được phép · ⛔ phải bị chặn (401/403 — **negative test**) · — không áp dụng.
Mỗi ô ⛔ là một test bắt buộc: gọi đúng endpoint bằng token sai-vai-trò và xác nhận bị từ chối.

| Nhóm chức năng (endpoint gốc) | PUBLIC | STUDENT | TEACHER | MANAGER | OWNER | ADMIN |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Auth: register/login/refresh/logout (`/api/auth/*`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Public lead magnet (`/api/public/free-grade`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Public org invite (`/api/public/org-invitations/{token}`) | ✅ | ✅ | — | — | — | — |
| Onboarding/Profile/Roadmap (`/api/onboarding`,`/api/profile`,`/api/roadmap`) | ⛔ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI Speaking session (`/api/ai-speaking/*`) | ⛔ | ✅ | ✅ | ⛔? | ⛔? | ✅ |
| SRS / Assessment / Mock-exam (`/api/srs`,`/api/assessment`,`/api/mock-exams`) | ⛔ | ✅ | ✅ | — | — | ✅ |
| Interview (`/api/interviews/*`) | ⛔ | ✅ | ✅ | — | — | ✅ |
| Join class (`/api/classes/join`) | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | — |
| Teacher classes & students (`/api/v2/teacher/*`) | ⛔ | ⛔ | ✅ | ✅? | ✅? | ✅ |
| Class schedule patterns/sessions (`/api/v2/teacher/class-schedule/*`) | ⛔ | ⛔ | ✅ | ✅? | ✅? | ✅ |
| Grading + AI grade (`/api/v2/teacher/grading/*`) | ⛔ | ⛔ | ✅ | ⛔? | ⛔? | ✅ |
| Org admin: seats/members/invite (`/api/org/*`) | ⛔ | ⛔ | ⛔ | ✅(hạn chế) | ✅ | ✅ |
| Org: tạo teacher (`POST /api/org/teachers`) | ⛔ | ⛔ | ⛔ | ✅ (chỉ tạo TEACHER) | ✅ | ✅ |
| Org: đổi role member (`PATCH /api/org/members/{id}/role`) | ⛔ | ⛔ | ⛔ | ⛔ (OWNER-only) | ✅ | ✅ |
| Admin org/invoice/entitlement (`/api/admin/organizations/*`) | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ |
| Admin analytics/ai-config/marketing/broadcast (`/api/admin/*`) | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ |
| Payment checkout (`/api/payments/stripe|momo|apple`) | ⛔ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Payment webhook (`/api/payments/sepay/webhook`,`momo/ipn`,`apple/notifications`) | ✅ (chữ ký) | — | — | — | — | — |

> Các ô đánh `?` (MANAGER/OWNER với teacher-tools, AI) là **chỗ chưa chắc** → xác minh thực tế bằng code/`@PreAuthorize` và ghi kết quả; nếu khác kỳ vọng, đưa vào báo cáo.

---

## 3. KỊCH BẢN CHI TIẾT (Given–When–Then, kép UI + API)

> Mỗi case: **Tiền đề → Bước UI → Lệnh API tương ứng → Kỳ vọng → Đối chiếu UI↔API**. ID dùng để ghi kết quả ở §5.

### A. AUTH & PHIÊN

**A1 — Login đúng (mỗi role).**
UI: vào `/login`, nhập email/PW → vào đúng dashboard theo role (student→`/student`, teacher→`/teacher`, org→`/org`, admin→`/admin`).
API: `POST /api/auth/login` → `200` + `accessToken`; `GET /api/auth/me $(auth $TOKEN)` → đúng `role`/`orgId`.
Đối chiếu: role trên UI = role trong `/me`.

**A2 — Login sai mật khẩu / email lạ hoa-thường.** API → `401`, không lộ "email tồn tại hay không". Thử email viết HOA (vd `User@x.com`) phải vào được như thường (case-insensitive — đã có fix gần đây, xác minh).

**A3 — `/me` không token / token hỏng** → `401`.

**A4 — Refresh + reuse detection.** `POST /api/auth/refresh` (kèm cookie jar) → token mới. Dùng **lại** refresh cũ lần 2 → phải bị **từ chối** (reuse detection) và thu hồi session.

**A5 — Logout.** UI bấm logout → quay `/login`, localStorage sạch. API `POST /api/auth/logout` → refresh bị revoke (gọi `/refresh` sau đó → `401`).

**A6 — Forgot/Reset password** (`/api/auth/forgot-password` → email; `/reset-password` token). Chạy với tài khoản test; xác nhận token cũ không tái dùng.

### B. PUBLIC / ẨN DANH

**B1 — Landing + SEO** `/`, `/robots.txt`, `/sitemap.xml` → `200`.
**B2 — Lead magnet free-grade** (`/giao-vien-mien-phi`, `/free-grade`): nộp bài → `/api/public/free-grade` chấm và trả report; không cần auth.
**B3 — Public org invitation**: mở `/api/public/org-invitations/{token}` hợp lệ → `200` chi tiết lời mời; token rác → `404/410`. `POST /{token}/accept` gắn người dùng vào org.
**B4 — Public certificate** tra cứu chứng chỉ bằng mã.
**B5 — Truy cập trang nội bộ khi chưa login** (`/student`, `/admin`) → middleware đẩy về `/login` (kiểm tra chặn **server-side**, không chỉ ẩn UI).

### C. STUDENT — full hành trình học

**C1 — Onboarding.** UI `/onboarding` chọn mục tiêu/level. API `POST /api/onboarding/profile` → `GET /api/onboarding/route` trả bước kế; `GET /api/onboarding/status` phản ánh tiến độ.
**C2 — Roadmap & Today.** `GET /api/roadmap/me`, `/api/roadmap/me/meta`; `GET /api/ai-speaking`…`/today` (TodayController) hiển thị nhiệm vụ hôm nay.
**C3 — AI Speaking (luồng tốn tiền — test kỹ).**
  1. `GET /api/ai-speaking/quota` → còn quota.
  2. `POST /api/ai-speaking/sessions` → `sessionId`.
  3. `POST /api/ai-speaking/sessions/{id}/chat` (1 lượt) → phản hồi AI; **rồi gọi lại `/quota`** → token **đã giảm** (ledger ghi nhận).
  4. `POST /api/ai-speaking/sessions/{id}/chat/stream` → nhận SSE (UI hiển thị streaming).
  5. `POST /api/ai-speaking/transcribe` (file audio mẫu) → text.
  6. `PATCH /api/ai-speaking/sessions/{id}/end` → `GET /sessions/{id}/report` có điểm.
  Đối chiếu: số lượt/Điểm trên UI = dữ liệu `/messages` + `/report`.
**C4 — Quota cạn (negative tiền).** Lặp C3 tới khi hết pool → phải `402/429` (chặn), **không** cho gọi LLM tiếp. Ghi rõ ngưỡng.
**C5 — TTS** `POST /api/ai-speaking/tts` (text ngắn) → audio; text quá dài → bị giới hạn (cap length). `GET /tts/status`.
**C6 — SRS.** `GET /api/srs/due` + `/count` → thẻ tới hạn; `POST /api/srs/review` (rating) → lịch cập nhật theo FSRS; `/stats` phản ánh.
**C7 — Assessment B1 + Mock exam.** `GET /api/assessment/b1/readiness` (0–100); `POST /api/assessment/b1/mock-exam`. Mock-exam pack: `POST /api/mock-exams/{examId}/start` → `/questions` → `/attempts/{id}/finish` → `/result` + `/review`.
**C8 — Interview + premium gate.** `GET /api/interviews/personas`; persona **ADVANCED** với user FREE → bị khoá (nudge `/student/pricing`); đếm "X/3 tuần này". Sau khi (sandbox) nâng PRO → mở khoá.
**C9 — Grammar/Vocabulary/Beginner.** `/api/grammar/cases`, `/api/beginner/journey`, `/api/beginner/speaking/day-one`.
**C10 — Gamification.** XP (`/api/...xp`), achievement, coin earn/spend phản ánh đúng sau khi hoàn thành nhiệm vụ.
**C11 — Notifications & Messages.** `GET /api/notifications/unread-count`, `POST /{id}/read`; `GET /api/messages/conversations`, nhắn với giáo viên.
**C12 — Profile.** `PATCH /api/profile/me`, đổi mật khẩu `/me/password`, push-token; **`DELETE /api/profile/me`** chỉ trên tài khoản test dùng-một-lần.
**C13 — Nâng cấp gói (sandbox).** UI `/payment` hoặc `/student/pricing` → `POST /api/payments/stripe/create-session` (hoặc momo `create-order`) → tới trang cổng test; **dừng trước khi trả tiền thật**.
**C14 — Join class.** `POST /api/classes/join` bằng mã lớp → tạo join-request (xem duyệt ở D4).

### D. TEACHER — công cụ giảng dạy

**D1 — Lớp.** `GET/POST /api/v2/teacher/classes`; `GET /classes/{id}/students`, `/analytics`.
**D2 — Co-teacher.** `POST /classes/{id}/teachers` (thêm bằng email; email rỗng → chặn), `GET /classes/{id}/teachers`, `DELETE /.../teachers/{coId}`.
**D3 — Thêm student.** `POST /classes/{id}/students` (theo email).
**D4 — Duyệt join-request.** `GET /classes/{id}/join-requests` → `POST /.../approve` | `/reject`; sau approve, student C14 thấy mình trong lớp.
**D5 — Lịch lớp (khớp model ClassSchedulePattern/ClassSession).** `GET /api/v2/teacher/class-schedule/week`; `GET/PUT /classes/{classId}/pattern` (lịch cố định); `POST /classes/{classId}/sessions` + `PATCH /sessions/{id}` **đổi giờ/phòng một buổi** mà không phá pattern. Đối chiếu lịch tuần hiển thị đúng buổi đã đổi.
**D6 — Chấm bài + AI grade.** `GET /api/v2/teacher/grading/queue` + `/stats`; `GET /classes/{c}/assignments/{a}/submissions`; `POST /submissions/{id}/ai-grade` → có điểm/nhận xét (kiểm AI grade có trừ org pool/ledger không).
**D7 — Đánh giá học viên / lesson log / báo cáo / availability / materials** (StudentEvaluation, LessonLog, TeacherReport, TeacherAvailability, TeacherMaterial).
**D8 — Announce.** `POST /api/notifications/teacher/announce` → student trong lớp nhận.
**D9 — Negative.** Teacher gọi `/api/admin/*` → `403`; gọi `/api/org/members/{id}/role` → `403`; đọc lớp của teacher khác/ORG_B → `403/404`.

### E. MANAGER — quản lý org (quyền hạn chế)

**E1 — Tạo giáo viên.** `POST /api/org/teachers` → tạo **TEACHER** (created_via=MANAGER). Thử ép tạo MANAGER → **không được** (endpoint chỉ sinh TEACHER).
**E2 — Xem seats/members/schedule.** `GET /api/org/seats`, `/members`, `/api/org/schedule/week`.
**E3 — Negative (OWNER-only).** `PATCH /api/org/members/{id}/role` → **403** (chỉ OWNER). Xoá OWNER/đổi role OWNER → cấm.

### F. OWNER — toàn quyền org

**F1 — Mời/Tạo teacher.** `POST /api/org/teachers/invite` (+ `GET/DELETE /invitations`), `POST /api/org/teachers`.
**F2 — Đổi role staff.** `PATCH /api/org/members/{id}/role` MANAGER↔TEACHER → `200`. Đổi lên OWNER → ngoài phạm vi (phải cấm/khác luồng).
**F3 — Gỡ member.** `DELETE /api/org/members/{userId}` (test entity) → nếu member đang là TEACHER thì **auto-demote** (kiểm regression I cũ).
**F4 — Lớp & lịch toàn org.** `GET/POST /api/org/classes`, `/classes/{id}`.
**F5 — Rời org.** `POST /api/org/membership/leave` (chỉ trên tài khoản test).
**F6 — Seat limit.** Thêm member vượt seat → chặn (kiểm race nếu thêm song song).

### G. ADMIN — quản trị nền tảng

**G1 — Tổ chức.** `GET /api/admin/organizations/{id}`, `PATCH /{id}`, `GET/POST /{id}/members`.
**G2 — Entitlement & Invoice.** `POST /{id}/activate-entitlements`; `POST /{id}/invoices` → `GET /{id}/invoices` → `PATCH /{id}/invoices/{invId}/status` (trên org test).
**G3 — Analytics / AI config / Grading-eval** (`AdminAnalytics`,`AdminAiConfig`,`AdminGradingEval`,`WeeklySpeakingAdmin`).
**G4 — Marketing leads** (`/api/...marketing` AdminMarketingLead) + **broadcast** notification.
**G5 — Mock-exam packs** (`AdminMockExamPack`), interview admin (`/api/interviews` admin: rubric/experiment).
**G6 — IDOR check.** Admin endpoint có re-verify `orgId` từ path không? (defense-in-depth) — ghi nhận.

### H. CROSS-TENANT & NEGATIVE (trục bảo mật — quan trọng nhất)

**H1 — Đọc chéo tenant.** Token STUDENT của ORG_A gọi tài nguyên ORG_B (class id, member id, invoice id của B) → phải `403/404`, **tuyệt đối không trả data B**. Lặp cho TEACHER/MANAGER.
**H2 — Leo quyền dọc.** STUDENT→teacher endpoint, TEACHER→admin endpoint, MANAGER→owner endpoint: tất cả `403`.
**H3 — IDOR id tuần tự.** Đổi `{id}` trong `/sessions/{id}/report`, `/classes/{id}`, `/invoices/{id}` sang id của người khác → từ chối.
**H4 — JWT giả/het hạn/đổi alg** → `401`. `orgRole` trong JWT chỉ là display-hint (có thể lệch tới ~15') — xác nhận server không tin claim này để phân quyền thật.
**H5 — Quota bypass.** Tìm đường AI không qua chốt (so với bảng call-site ở audit): mọi endpoint LLM/TTS/STT phải hoặc pre-check hoặc ghi ledger. Ghi đường nào "ungated".
**H6 — Rate limit.** Gọi dồn `/api/auth/login` sai + endpoint AI → bị rate-limit (`429`).

### I. PAYMENT (chỉ sandbox/test mode)

**I1 — Stripe** `POST /api/payments/stripe/create-session` → session test; webhook (`POST value`/stripe webhook) với chữ ký hợp lệ → cập nhật subscription; chữ ký sai → từ chối.
**I2 — MoMo** `create-order` → `ipn` (sandbox) → `sync-order`. Replay cùng `ipn` 2 lần → **idempotent** (không cộng tiền/seat 2 lần).
**I3 — Apple IAP** `POST /api/payments/apple/verify` (receipt sandbox), `/notifications` server-to-server, `/products`, `/account-token`.
**I4 — SePay** `POST /api/payments/sepay/webhook` chữ ký hợp lệ → ghi nhận; sai/replay → từ chối/idempotent.
> Sau thanh toán sandbox: subscription→plan mapping đúng, quota/entitlement mở đúng mức (đối chiếu `/api/auth/me` + `/quota`).

### J. SMOKE SCALE/RESILIENCE (tuỳ chọn)

**J1 — SSE** trên `/chat/stream` và job SSE (`SseTicketController`) hoạt động qua reverse proxy (ticket cấp đúng, stream không đứt).
**J2 — Concurrency quota.** Bắn N request AI song song khi pool gần cạn → tổng tiêu **không vượt** pool (kiểm race check-then-debit).
**J3 — Health** `GET /actuator/health` → `UP`; xác nhận `/actuator` nhạy cảm không phơi ra public.

---

## 4. CHECKLIST PHỦ CHỨC NĂNG (đảm bảo "full") — domain → case

| Domain (backend) | Case phủ |
|---|---|
| user/auth, onboarding, profile, learning-plan, ability-score | A1–A6, C1, C12 |
| roadmap, curriculum (practice-node, skill-tree, roadmap-tree, setup) | C2 |
| speaking (ai-speaking, ai, tts, pronunciation, beginner-speaking, weekly, today, review-tasks, error-skills) | C3–C5, J1–J2 |
| srs | C6 |
| assessment, grammar (mock-exam, cases, syllabus, certificate, progress), mock-exam-pack | C7 |
| interview (+admin) | C8, G5 |
| beginner, vocabulary, phoneme, grammar-ai | C9 |
| gamification (xp, achievement, coin) | C10 |
| notification, messaging, news | C11, D8, G4 |
| payment (stripe, momo, apple, sepay) | C13, I1–I4 |
| classes/join, teacher (class, class-lesson, class-schedule, grading, evaluation, lesson-log, report, availability, material, center, marketplace, session, free-tier) | C14, D1–D9 |
| organization (org, org-teaching, admin-org, admin-teacher, public-invitation) | B3, E1–E3, F1–F6, G1–G2 |
| admin (management, analytics, ai-config, grading-eval, weekly-speaking) | G1–G6 |
| material, media, aiimage, video, training | D7, (admin) — smoke |
| common (sse-ticket, async-job, diagnostics), system | J1, J3 |
| marketing (lead, public-grade-report, lead-magnet) | B2, G4 |

> Mọi controller không có case riêng ở trên → chạy **smoke** (gọi endpoint chính bằng role hợp lệ, kỳ vọng `200`; bằng role sai, kỳ vọng `403`) và ghi vào bảng kết quả.

---

## 5. MẪU GHI KẾT QUẢ

Với mỗi case: `ID | Role | Endpoint/Route | Kỳ vọng | Thực tế (HTTP+bằng chứng) | PASS/FAIL | Mức độ nếu FAIL`.

```
| A1 | STUDENT | POST /api/auth/login | 200 + role=STUDENT | 200, role=STUDENT | PASS | — |
| H1 | STUDENT(A) | GET /api/org/classes/{B} | 403/404 | 200 trả data B | FAIL | 🔴 |
```

Cuối runbook tổng hợp: bảng FAIL theo mức độ 🔴🟠🟡⚪, danh sách "ungated/cross-tenant" (nếu có), và các ô `?` trong ma trận §2 đã chốt thành ✅/⛔.

---

## 6. THỨ TỰ CHẠY ĐỀ XUẤT

1. §1 chuẩn bị token → 2. §3.A auth → 3. §2 ma trận (negative nhanh, phát hiện lỗ phân quyền sớm) → 4. luồng theo role C→D→E→F→G → 5. H cross-tenant/negative → 6. I payment sandbox → 7. J smoke scale → 8. điền §4 checklist còn thiếu → 9. tổng hợp §5.

> Nếu một case 🔴 (đọc chéo tenant / quota bypass / leo quyền) → ghi ngay, tiếp tục phần còn lại, không tự "sửa".
