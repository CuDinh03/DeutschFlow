-- Q-09 (owner chốt 14/09/2026): mail "kích hoạt tài khoản" gửi ngay sau khi trung tâm nhập CSV
-- roster, để học viên tự đặt mật khẩu lần đầu.
--
-- VÌ SAO CẦN BẢNG RIÊNG, KHÔNG TÁI DÙNG `password_reset_tokens`:
--
--   1. Cột `code` bên đó là VARCHAR(6) — chứa đúng một OTP 6 chữ số. Một liên kết kích hoạt sống
--      nhiều ngày thì 6 chữ số là quá yếu (10^6 khả năng), nên dù tái dùng cũng phải nới cột, tức
--      vẫn là một migration.
--   2. `PasswordResetService.requestReset` mở đầu bằng
--      `UPDATE password_reset_tokens SET used = TRUE WHERE email = ? AND NOT used`. Nghĩa là mỗi lần
--      học viên bấm "Quên mật khẩu" sẽ GIẾT luôn token kích hoạt của chính mình — hai thứ khác nhau
--      dùng chung một sổ thì cái này vô hiệu hoá cái kia một cách vô hình.
--   3. Hai vòng đời khác hẳn: OTP đặt lại mật khẩu sống 15 phút và do CHÍNH người dùng xin; token
--      kích hoạt sống nhiều ngày và do TRUNG TÂM sinh ra thay mặt họ.
--
-- LƯU HASH, KHÔNG LƯU TOKEN THÔ. `password_reset_tokens` lưu OTP dạng thô và nói rõ lý do chấp nhận
-- được (TTL 15 phút, entropy thấp). Ở đây thì không: bảng này chứa chìa khoá vào tài khoản của những
-- em CHƯA từng đăng nhập, sống nhiều ngày, và cả lớp cùng lúc. Một bản dump DB (hay một lượt đọc
-- trái phép) sẽ là chiếm được toàn bộ danh sách lớp. Chỉ SHA-256 của token nằm lại; bản thô tồn tại
-- đúng một lần, trong email gửi đi.

CREATE TABLE IF NOT EXISTS account_activation_tokens (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Trung tâm phát ra token. Giữ để trả lời "ai gửi lời mời này" khi có khiếu nại; ON DELETE SET
    -- NULL vì token vẫn phải dùng được nếu trung tâm bị xoá khỏi hệ thống giữa chừng.
    org_id      BIGINT       REFERENCES organizations(id) ON DELETE SET NULL,
    token_hash  VARCHAR(64)  NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ  NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Đường tra duy nhất lúc kích hoạt: hash → dòng. UNIQUE ở trên đã tạo index cho nó.
-- Index này phục vụ đường còn lại: "học viên X còn token nào chưa dùng không" (chống gửi đôi).
CREATE INDEX IF NOT EXISTS idx_aat_user_unused
    ON account_activation_tokens (user_id)
    WHERE used_at IS NULL;
