# Teacher nav cleanup + viết lại docs nav.ts

**Ngày:** 2026-06-23
**File chạm tới:** `frontend/src/components/ui-v2/nav.ts` (duy nhất)
**Loại:** chore (config điều hướng + documentation), không đổi behavior render.

---

## Yêu cầu

1. Đổi/chuẩn hóa tên một số thanh trong teacher nav:
   Trang chủ · Kế hoạch giảng dạy · Nội dung giảng dạy · Lịch sử giảng dạy · Chấm bài · Phúc khảo.
2. "Bỏ lịch hẹn 1:1" (Buổi học 1:1) khỏi teacher nav.
3. Viết lại docs cho phần nav.

## Phát hiện khi rà file

- 6 nhãn người dùng liệt kê **đã khớp sẵn** với label trên disk → không cần đổi tên.
- Mục "Quản lý lớp" thực tế có **8** thanh; 2 thanh ngoài danh sách: **Chấm bài qua ảnh**, **Thư viện tài liệu**.
- Thanh **Buổi học 1:1** (`sessions`) đã bị comment dở dang kèm chữ "bỏ" ở cuối dòng 54.

## Quyết định

- **2 thanh thừa (Chấm bài qua ảnh, Thư viện tài liệu): GIỮ NGUYÊN** — theo lựa chọn của người dùng (hỏi xác nhận trước khi sửa).
- Hoàn tất việc bỏ 1:1 bằng cách xóa hẳn dòng comment chết, không để lại rác.

## Thay đổi đã thực hiện

### 1. Bỏ "Buổi học 1:1" gọn gàng
- Xóa dòng comment chết `// { id: 'sessions', label: 'Buổi học 1:1', ... }, bỏ` trong nhóm **Giảng dạy**.
  → Nhóm này giờ chỉ còn `Tin nhắn học viên`.
- Cập nhật comment đầu `teacherNav` (vốn vẫn mô tả tab 1:1 đã gỡ) → ghi rõ "Buổi học 1:1 đã bỏ, teacher chỉ tập trung lớp trung tâm (B2B)".

### 2. Viết lại docs (comment co-located trong nav.ts)
Phạm vi: **cả 4 role**, không chỉ teacher.
- **Header file:** mô tả mô hình `RoleNav → sections → items`, cách suy ra trạng thái active từ `href`, quy ước `id`/`label`/`href`/`icon`.
- **Doc từng field** của `NavItem` / `NavSection` / `RoleNav` (gồm `ownerOnly`, `rootHref`).
- **Doc block 4 role:**
  - `teacherNav` — liệt kê 5 nhóm; ghi chú "Thông báo ở top bar", "đã bỏ 1:1".
  - `adminNav` — bề mặt quản trị nền tảng.
  - `orgNav` — nêu rõ luật `ownerOnly` (OWNER thấy tài chính/giấy phép; MANAGER bị ẩn).
  - `studentNav` — 4 nhóm; làm rõ "Gia sư 1:1" phía học viên VẪN giữ (khác với teacher).
- **`ROLE_NAV`** — chú thích là entry point cho sidebar.

## Không đổi (giữ nguyên behavior)
- Toàn bộ item của teacher: Trang chủ, Kế hoạch giảng dạy, Nội dung giảng dạy, Lịch sử giảng dạy,
  Chấm bài, Chấm bài qua ảnh, Thư viện tài liệu, Phúc khảo.
- 3 role còn lại (admin/org/student) chỉ thêm comment, không sửa item.

## Vấn đề còn tồn (chưa sửa — ngoài phạm vi "docs")
- Trong `teacherNav`, hai item **"Thư viện tài liệu"** và **"Phúc khảo"** đang dùng **trùng `id: 'materials'`**.
  Active-state khớp theo `href` nên hiện không lỗi rõ, nhưng rủi ro nếu chỗ nào key theo `id`.
  Đề xuất: đổi id "Phúc khảo" → `'quiz-exam'`. Chờ người dùng xác nhận.

## Verify
- Tất cả thay đổi là **comment / xóa dòng comment chết** → không ảnh hưởng type/build, render không đổi.
- Không dựng preview vì kết quả render giống hệt trước (dòng 1:1 vốn đã bị comment, không hiển thị).
- Chưa chạy lint/tsc; có thể chạy nếu cần chắc cú.

## Ghi chú phạm vi
Session này CHỈ chạm `nav.ts`. Các thay đổi uncommitted khác trong cây làm việc
(org classes: `CreateClassModal.tsx`, `CreateClassRequest.java`, `OrgController/OrgService`, ...)
là công việc riêng có từ trước, **không thuộc** session này.
