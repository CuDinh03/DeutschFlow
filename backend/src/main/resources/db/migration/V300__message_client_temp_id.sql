-- ============================================================
-- V300: Idempotency key cho tin nhắn (DM + kênh lớp) — fix gốc F-13 "tin nhắn đôi"
-- ============================================================
-- Bối cảnh: client mobile gửi tin qua outbox local-first. Khi POST timeout nhưng server ĐÃ lưu,
-- lần flush retry kế tiếp tạo THÊM một bản ghi — người nhận thấy tin đôi. Client đã có lớp chống
-- đỡ (echo-dedupe khi poll), nhưng bản ghi trùng vẫn nằm trong DB và mọi client khác (web, máy
-- thứ hai) vẫn thấy hai tin. Chốt chặn triệt để phải nằm ở server: client gửi kèm key ổn định
-- (tempId sẵn có của outbox), server thấy key đã dùng thì trả lại đúng bản ghi cũ thay vì tạo mới.
--
-- Cột NULLABLE vì key là TUỲ CHỌN: web và các client cũ không gửi key vẫn hoạt động y nguyên
-- (mỗi POST một bản ghi như trước). UNIQUE index bộ phận (WHERE client_temp_id IS NOT NULL) vì
-- Postgres coi mọi NULL là khác nhau — không lọc thì index vẫn đúng nhưng phình vô ích theo số
-- tin không có key; lọc NULL giữ index nhỏ đúng bằng số tin gửi từ client có key.
--
-- Phạm vi unique theo (sender_id, client_temp_id) chứ không toàn cục: key do client tự sinh
-- (tmp-<epoch>-<seq>-<rand>), hai NGƯỜI khác nhau trùng key không được phép làm hỏng nhau.
-- Tầng service tra (sender_id, key) trước khi lưu; index này là ràng buộc cuối cùng cho cửa sổ
-- đua hai request cùng key đến đồng thời (request thua lỗi, lần retry sau replay sạch).

ALTER TABLE messages ADD COLUMN client_temp_id VARCHAR(64);
ALTER TABLE class_channel_messages ADD COLUMN client_temp_id VARCHAR(64);

CREATE UNIQUE INDEX uq_messages_sender_client_temp_id
    ON messages (sender_id, client_temp_id)
    WHERE client_temp_id IS NOT NULL;

CREATE UNIQUE INDEX uq_class_channel_messages_sender_client_temp_id
    ON class_channel_messages (sender_id, client_temp_id)
    WHERE client_temp_id IS NOT NULL;

COMMENT ON COLUMN messages.client_temp_id IS
    'Idempotency key do client gửi kèm (tempId của outbox mobile). NULL = client không dùng key. Retry cùng key không tạo bản ghi mới.';
COMMENT ON COLUMN class_channel_messages.client_temp_id IS
    'Idempotency key do client gửi kèm (tempId của outbox mobile). NULL = client không dùng key. Retry cùng key không tạo bản ghi mới.';
