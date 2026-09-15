-- Luyện thi Nói — cứng hoá đường phụ sau audit 31/08 (F-05, F-08):
--   version       : khoá lạc quan JPA @Version — hai finish/lượt nói song song trên cùng phiên thì
--                   lần commit sau 409 thay vì cả hai cùng enqueue job chấm (tốn ~2× token).
--   grading_error : lý do phiên ở GRADING_FAILED (QUOTA_EXCEEDED | JOB_FAILED | JOB_STUCK) để client
--                   hiện đúng thông điệp (hết quota → nạp rồi "Chấm lại", khác với job chết).
ALTER TABLE speaking_exam_sessions ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE speaking_exam_sessions ADD COLUMN IF NOT EXISTS grading_error VARCHAR(64);
