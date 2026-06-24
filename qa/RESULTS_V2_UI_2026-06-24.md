# KẾT QUẢ TEST UI — Galerie 2.0 (`/v2`) — DeutschFlow

> Chạy: 2026-06-24 · Giao diện: **`/v2/*` (canonical, đã full cutover)** · Cách: đăng nhập thật qua `/v2/login` cho từng role, lái trình duyệt, chụp ảnh.
> Bổ sung cho `RESULTS_E2E_2026-06-24.md` (tầng API). Tổng quan: **login + định tuyến theo role hoạt động đúng; RBAC dữ liệu vững (backend 403); guard role ở tầng UID/UX còn "mềm" + lộ path API trong thông báo lỗi.**

---

## 1. Login + định tuyến theo role (middleware) — 5/5 ĐÚNG

| Role | Tài khoản | Đáp vào | Kỳ vọng | KQ |
|---|---|---|---|:--:|
| STUDENT | test01 | `/v2/student/dashboard` | `/v2/student/dashboard` | ✅ |
| TEACHER (df-center) | testgv03 | `/v2/teacher` | `/v2/teacher` | ✅ |
| MANAGER | testmn | `/v2/org` | `/v2/org` | ✅ |
| OWNER | deflow | `/v2/org` | `/v2/org` | ✅ |
| ADMIN | admin | `/v2/admin/users` | `/v2/admin/users` | ✅ |

Login form `/v2/login` chạy tốt (email/password, có Google SSO + "Ghi nhớ đăng nhập" + "Quên mật khẩu"). Đăng xuất sạch session (về `/v2/login`). TEACHER không-trung-tâm (testgv02) cùng role-home `/v2/teacher` (không test lại UI riêng).

Mỗi shell render đúng dữ liệu thật:
- **Student**: Tổng quan/Từ vựng/Ngữ pháp/SRS/Luyện nói AI/Lộ trình/Lớp của tôi; Lv 1, streak 0.
- **Teacher**: Quản lý lớp, Kế hoạch giảng dạy, Chấm bài (+Chấm bài qua ảnh), Công cụ AI; 0 lớp, nút "Tạo lớp".
- **Org (manager/owner)**: "Trung tâm Deutschflow", gói B2B; Ghế 0/0, Token AI tháng này, Mời thành viên, Phân quyền.
- **Admin**: Quản lý người dùng — 45 user (37 student/3 teacher/2 manager/2 owner/1 admin); menu Doanh thu, AI Token, Tổ chức, Cấu hình AI; trạng thái "Hệ thống ổn định".

---

## 2. RBAC ở tầng UI — phân biệt menu đúng

- **OWNER có thêm 2 menu mà MANAGER không có: "Tài chính" và "Gói & Giấy phép"** (billing/license owner-only). MANAGER chỉ thấy tới Phân tích/Lời mời/Phân quyền. → đúng kỳ vọng.
- Badge role hiển thị đúng: HỌC VIÊN / GIÁO VIÊN / TỔ CHỨC / ADMIN.

---

## 3. Cutover & guard sai-role

| Kịch bản | Kết quả | Đánh giá |
|---|---|---|
| Legacy `/student` (ADMIN) | → redirect `/v2/admin/users` | ✅ cutover redirect hoạt động |
| ADMIN → `/v2/org` | render shell TỔ CHỨC, lỗi **"Không tải được tổ chức — Bạn không thuộc tổ chức nào `GET /api/org`"** | ⚠ guard mềm |
| ADMIN → `/v2/teacher` | render shell GIÁO VIÊN, lỗi **"Không tải được lớp học — Forbidden `GET /api/v2/teacher/classes`"** | ⚠ guard mềm |

**Kết luận:** dữ liệu **không rò** (backend trả 403 đúng như test API), nhưng **middleware không bật user sai-role ra khỏi surface của role khác** — shell vẫn render, và **thông báo lỗi lộ nguyên path API** cho người dùng.

---

## 4. Phát hiện (UI)

| ID | Vấn đề | Bằng chứng | Mức độ |
|---|---|---|---|
| U-1 | **Guard sai-role "mềm" trên `/v2`.** ADMIN vào được `/v2/org` và `/v2/teacher` (render shell role khác) thay vì bị bật về `/v2/admin/users`. Dữ liệu an toàn (403) nhưng UX sai + lộ cấu trúc. | screenshot admin trên /v2/org, /v2/teacher | 🟡 TB |
| U-2 | **Thông báo lỗi lộ path/method API** ("Forbidden `GET /api/v2/teacher/classes`", "`GET /api/org`") ra người dùng cuối. | 2 màn lỗi ở §3 | 🟡 TB |
| U-3 | **Lệch hiển thị gói/quota AI giữa admin-panel và runtime.** Admin liệt kê `testgv03` = gói **INTERNAL / "Không giới hạn"**, nhưng tạo session AI cho chính account đó trả **429 `planCode=DEFAULT, remaining=0`** (xem RESULTS API §4). Org dashboard cũng ghi "pool không giới hạn" trong khi member bị 429. | admin /v2/admin/users vs API /api/ai-speaking/sessions | 🟠 Cao (cần xác minh) |
| U-4 | **Định tuyến bounce sai-role không nhất quán** (legacy `/student`→`/v2/admin/users` nhưng `/v2/org`/`/v2/teacher` không bounce). | §3 | ⚪ Thấp |

> U-3 đáng ưu tiên: nếu plan "INTERNAL/không giới hạn" không được honored ở chốt speaking (resolve về DEFAULT/0), thì hoặc (a) cấu hình gói chưa wire vào quota speaking, hoặc (b) admin-panel hiển thị sai gói. Cả hai đều ảnh hưởng tới monetization/độ tin cậy số liệu — cần đối chiếu code resolve plan ở `common/quota`.

---

## 5. Ảnh chụp (đã xem trong phiên)

Student dashboard · Teacher home · Org (manager) · Org (owner, có Tài chính/Giấy phép) · Admin users · Admin→/v2/org lỗi · Admin→/v2/teacher lỗi. (Lưu trong nhật ký phiên; có thể chụp lại để đính kèm nếu cần.)

---

## 6. Chưa chạy (UI)

Click sâu từng tính năng (tạo lớp, đổi lịch buổi, mời thành viên, chấm bài AI, luyện nói) — đều là **mutation/tốn AI** trên dữ liệu thật; nên chạy trên org/ lớp test dùng-một-lần hoặc môi trường staging. Premium gate interview cần tài khoản PRO. Google SSO không bấm (sẽ rời sang Google).
