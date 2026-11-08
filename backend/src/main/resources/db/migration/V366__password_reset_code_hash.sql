-- Mã quên mật khẩu: lưu HASH thay mã thô, đếm số lần nhập sai theo từng mã (09/11/2026, audit 28/10 #2).
--
-- V186 lưu mã 6 số dạng thô và không đếm lần sai: rò DB là đọc được mã còn hạn, còn dò mã chỉ bị chặn
-- bởi rate-limit theo IP + email. Từ bản này `PasswordResetService` dùng lõi `RegistrationCodes` của
-- luồng đăng ký: HMAC-SHA256(pepper, id + ":" + mã), so hằng thời gian, sai đủ N lần thì huỷ mã.
--
-- TƯƠNG THÍCH NGƯỢC (QUY_TRINH_PHAT_HANH §6.2 — màu cũ vẫn phục vụ lúc màu mới chạy migration):
--   - chỉ THÊM cột và nới NOT NULL của `code`; màu cũ vẫn INSERT `code` như trước, không lỗi;
--   - KHÔNG xoá `code` ở lần này. Mã thô cũ hết hạn sau 15 phút. Xoá cột `code` và chỉ mục
--     `idx_prt_email_code` ở một migration sau, khi bản này đã lên prod.
--   - Mã do màu cũ phát (chỉ có `code`, không có `code_hash`) bị màu mới coi là không dùng được: người
--     dùng gửi lại mã mới. Chỉ ảnh hưởng ai đang đặt lại mật khẩu đúng lúc đổi màu.

ALTER TABLE password_reset_tokens ALTER COLUMN code DROP NOT NULL;

-- Hex 64 ký tự của HMAC-SHA256.
ALTER TABLE password_reset_tokens ADD COLUMN code_hash VARCHAR(64);

-- Số lần nhập sai với mã này; đủ ngưỡng (app.auth.registration-verification.max-attempts-per-code) thì mã bị huỷ.
ALTER TABLE password_reset_tokens ADD COLUMN attempts INT NOT NULL DEFAULT 0;
