# BẢN ĐỒ ĐỘ PHỦ TEST — đã test vs CHƯA test (2026-06-24)

> Live `api.mydeutschflow.com` · 6 tài khoản test · 1 org (df-center, id 7).

## ĐÃ TEST (tóm tắt)
- Auth 6 role, ma trận phân quyền đọc (19 nhóm), negative/leo-quyền/cross-tenant cơ bản.
- v2 UI: định tuyến theo role + cutover + guard sai-role.
- Gate token AI (429) ở speaking + ai-grade.
- **Giáo viên: gần trọn** — tạo lớp, pattern lịch + đổi giờ/phòng buổi, add student, join-request approve/reject, chấm bài tay, co-teacher add/remove, lessons CRUD+reorder, lesson-log CRUD+điểm danh, sweep mọi GET.

---

## CHƯA TEST — nhóm theo điều kiện

### A. Bị chặn bởi điều kiện (cần cấp thêm để chạy)

| Luồng | Vì sao chưa chạy | Cần |
|---|---|---|
| **AI Speaking hội thoại thật** (session→chat→stream→transcribe→report) | account hết quota (DEFAULT=0 / org budget hết) → 429 | 1 account có quota/PRO |
| **TTS, Ngữ pháp AI, Tạo tài liệu PPTX, chấm bài qua ảnh, AI-grade thành công** | cùng lý do token | quota/PRO |
| **Vòng tiêu token → ghi ledger → trừ** (lõi monetization) | không account nào còn token | quota |
| **Interview + premium gate (ADVANCED khoá FREE)** | cần PRO để mở khoá | 1 account PRO |
| **Cross-tenant thật** (org A đọc lớp/invoice/member org B) | chỉ có 1 org test | org thứ 2 + user của nó |
| **Payment** (Stripe/MoMo/Apple/SePay: checkout, webhook, idempotency/replay, sub→plan) | chỉ chạy sandbox, không tiền thật | bật sandbox / khoá test |

### B. Cần BẠN cho phép (mutation có tác dụng phụ thật)

| Luồng | Tác dụng phụ |
|---|---|
| **Org: mời/ tạo giáo viên** (`POST /org/teachers/invite`, `/teachers`) | gửi email thật / tạo account |
| **Owner: đổi role member, gỡ member (auto-demote), tạo lớp org, rời org** | đổi dữ liệu nhân sự org thật |
| **Admin: tạo/sửa org, activate-entitlements, tạo/đổi-trạng-thái invoice** | đổi dữ liệu tổ chức/hoá đơn |
| **Admin: đổi gói/quota user** (chỗ set INTERNAL/unlimited — liên quan TF-1) | đổi cấu hình tính tiền |
| **Admin: AI config, broadcast notification** | đổi cấu hình hệ thống / gửi cho mọi user |
| **Register account mới, forgot/reset password** | tạo/đổi credential |
| **Student/Teacher: gửi tin nhắn, đổi mật khẩu, xoá tài khoản, push-token** | gửi message / đổi account |
| **Certificate: cấp/thu hồi** (`/certificates/{id}/revoke`, issue) | phát hành chứng chỉ thật |

### C. CHẠY ĐƯỢC NGAY trên dữ liệu test (an toàn, chỉ chờ bạn ok)

| Luồng | Endpoint chính |
|---|---|
| **Student onboarding** (tạo learning profile) | `POST /api/onboarding/profile` (test01 chưa có) |
| **SRS** học/ôn | `POST /api/srs/schedule`, `/review` |
| **Mock exam đầy đủ** | `POST /mock-exams/{id}/start`→`/questions`→`/finish`→`/result`→`/review` |
| **Assessment B1** | `POST /assessment/b1/evaluate`, `/b1/mock-exam` |
| **Gamification** XP/coin/achievement | earn qua hoàn thành nhiệm vụ |
| **Notifications** đánh dấu đã đọc | `POST /notifications/{id}/read`, `/read-all` |
| **Teacher: student-evaluation PUT, availability PUT, teacher-session review/status** | `PUT .../evaluations/{sid}`, `PUT /availability`, `PATCH /teacher-sessions/{id}/status` |
| **Public: lead-magnet free-grade, public org-invite accept (theo token), public certificate** | `/api/public/*` |
| **Owner happy-path** đổi role MANAGER↔TEACHER, tạo lớp org | `/api/org/*` (trên member test) |

### D. Kỹ thuật / cross-cutting CHƯA test

- **Refresh-token reuse detection** (mới thấy gián tiếp qua "session compromised") — chưa test có chủ đích.
- **Rate limiting** (login spam, AI) → 429.
- **SSE streams**: AI speaking stream, job SSE, notification stream.
- **Upload S3 presigned** (bài nộp có file, material).
- **WebSocket**.
- **Idempotency webhook** thanh toán (gửi 2 lần không cộng đôi).

---

## ĐỀ XUẤT GÓI TIẾP THEO
1. **Cấp 1 account STUDENT có quota + 1 org thứ 2 + bật payment sandbox** → tôi đóng phần đắt nhất: vòng ledger token, cross-tenant thật, payment idempotency, interview premium.
2. **Cho phép mutation org/admin** → tôi chạy owner/admin happy-path (đổi role, invoice, entitlement) trên dữ liệu test.
3. **Nhóm C** tôi chạy được ngay nếu bạn ok (student learning, mock exam, SRS, notifications, owner role-change).
