-- Backfill: đánh dấu ĐÃ ĐỌC các thông báo tồn đọng mà hành động liên quan ĐÃ hoàn tất từ trước.
--
-- Bối cảnh: trước bản vá auto-ack, read_at chỉ được đặt khi người dùng bấm chuông. Vì vậy nhiều thông
-- báo "việc đã làm rồi" (bài đã chấm, tin nhắn đã đọc) vẫn nằm chưa-đọc trong chuông. Auto-ack chỉ chạy
-- KỂ TỪ thời điểm hành động xảy ra, nên các tồn đọng CŨ cần script một lần này.
--
-- An toàn:
--   * Idempotent — chỉ chạm read_at IS NULL; chạy lại vô hại.
--   * Chỉ đặt read_at, KHÔNG xoá/sửa gì khác.
--   * Trên DB mới (fresh) không có tồn đọng → no-op.
-- Chạy MỘT LẦN sau khi deploy bản vá, ví dụ:
--   psql "$DATABASE_URL" -f backend/scripts/backfill_notification_auto_read.sql
--
-- Bảng/cột đã xác minh: user_notifications(recipient_user_id, notification_type, payload_json, read_at),
-- student_assignments(assignment_id, student_id, status), messages(recipient_id, sender_id, read_at).

BEGIN;

-- 1) "📥 Bài cần xem" (QUIZ_SUBMISSION_RECEIVED) mà bài nộp tương ứng đã được chấm xong
--    (EVALUATED = giáo viên xác nhận, GRADED = điểm AI hợp lệ cũ). AI_GRADED/SUBMITTED vẫn còn chờ → giữ nguyên.
UPDATE user_notifications un
   SET read_at = NOW()
 WHERE un.read_at IS NULL
   AND un.notification_type = 'QUIZ_SUBMISSION_RECEIVED'
   AND EXISTS (
       SELECT 1
         FROM student_assignments sa
        WHERE sa.assignment_id = (un.payload_json->>'assignmentId')::bigint
          AND sa.student_id    = (un.payload_json->>'studentId')::bigint
          AND sa.status IN ('EVALUATED', 'GRADED'));

-- 2) "💬 Tin nhắn mới" (NEW_MESSAGE) mà thread từ người gửi đó không còn tin nào chưa đọc
--    (người nhận đã mở/đọc hết) → thông báo cũng nên đã đọc.
UPDATE user_notifications un
   SET read_at = NOW()
 WHERE un.read_at IS NULL
   AND un.notification_type = 'NEW_MESSAGE'
   AND (un.payload_json ? 'senderId')
   AND NOT EXISTS (
       SELECT 1
         FROM messages m
        WHERE m.recipient_id = un.recipient_user_id
          AND m.sender_id    = (un.payload_json->>'senderId')::bigint
          AND m.read_at IS NULL);

-- 3) "Yêu cầu tham gia lớp" (CLASS_JOIN_REQUEST_CREATED) mà yêu cầu đã được xử lý (không còn PENDING).
UPDATE user_notifications un
   SET read_at = NOW()
 WHERE un.read_at IS NULL
   AND un.notification_type = 'CLASS_JOIN_REQUEST_CREATED'
   AND NOT EXISTS (
       SELECT 1
         FROM classroom_join_requests jr
        WHERE jr.classroom_id = (un.payload_json->>'classId')::bigint
          AND jr.student_id   = (un.payload_json->>'studentId')::bigint
          AND jr.status = 'PENDING');

COMMIT;
