-- V322 — Đuôi của V321, tách thành transaction Flyway RIÊNG (vòng review độc lập 10/09/2026, verdict BLOCK).
--
-- Vì sao tách khỏi V321:
--   · Flyway chạy mỗi tệp trong MỘT transaction, khoá DDL lấy ở đầu tệp giữ tới COMMIT cuối tệp. Bản
--     V321 trước review có ADD CONSTRAINT (không NOT VALID) + các CREATE INDEX trên content_reports — khoá
--     chặn ghi — rồi kết bằng câu UPDATE user_notifications bên dưới, vốn Seq Scan (bảng không có index
--     theo notification_type). Hệ quả: content_reports bị chặn ghi lâu bằng thời gian quét một bảng
--     KHÔNG liên quan, và con số ấy lớn dần theo hộp thư admin.
--   · Nay V321 chỉ còn DDL trên content_reports (FK khai NOT VALID — không quét, không giữ khoá dài), còn
--     tệp này làm hai việc còn lại, mỗi việc chỉ cần khoá yếu và không chạm dòng nào của content_reports:
--       1. VALIDATE CONSTRAINT — SHARE UPDATE EXCLUSIVE trên content_reports (+ ROW SHARE trên users):
--          KHÔNG chặn INSERT/UPDATE/DELETE/SELECT của ứng dụng, chỉ chặn DDL khác và VACUUM trên bảng
--          trong lúc quét. Cùng khuôn V265 (chk_class_attendance_status: NOT VALID rồi VALIDATE sau).
--       2. UPDATE user_notifications — bóc email + displayName khỏi payload ACCOUNT_DELETED cũ (quyết
--          định 8 của 10/09, phần dữ liệu). Khoá ROW EXCLUSIVE chỉ trên user_notifications.
--     Thứ tự VALIDATE trước, UPDATE sau: khoá của VALIDATE là khoá yếu nên giữ qua câu UPDATE không
--     ảnh hưởng người dùng; gộp hai câu một tệp để một lần chạy migration là hoàn tất cả hai.
--
-- Dữ liệu prod kiểm 10/09 (chỉ đọc): content_reports 0 DÒNG ⇒ VALIDATE tức thời. Kể cả DB có dữ liệu,
-- VALIDATE không thể vấp: FK cũ (V244) là ON DELETE CASCADE nên chưa từng có reporter_id mồ côi.
--
-- Không ghi vết audit ở đây: migration không có actor; số dòng thông báo bị bóc đọc ở log Flyway nếu cần.

ALTER TABLE content_reports VALIDATE CONSTRAINT fk_content_reports_reporter;

-- UserNotificationService.onAccountDeleted từng nhét email + displayName của NGƯỜI VỪA XOÁ TÀI KHOẢN
-- vào payload gửi mọi admin, và UserNotificationRetentionService không bao giờ xoá thông báo chưa
-- đọc ⇒ PII của người đã thực thi quyền xoá nằm lại vô thời hạn. Code từ V321 chỉ gửi deletedUserId;
-- dòng cũ dọn tại đây bằng phép trừ khoá jsonb — không đụng thông báo loại khác.
-- jsonb_exists() thay cho toán tử `?` — cố ý, để không tầng JDBC nào đọc nhầm `?` thành tham số.
UPDATE user_notifications
   SET payload_json = payload_json - 'email' - 'displayName'
 WHERE notification_type = 'ACCOUNT_DELETED'
   AND (jsonb_exists(payload_json, 'email') OR jsonb_exists(payload_json, 'displayName'));
