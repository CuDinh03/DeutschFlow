-- ============================================================
-- V292: Tách phút HỌC/NGHỈ khỏi phút CHIẾM LỊCH + neo buổi theo ô lịch gốc (PR-3, GĐ2)
-- ============================================================
-- Spec vận hành lớp trung tâm D04/§3 (buổi chính & bù = 180' học + 15' nghỉ = 195' chiếm lịch)
-- và AC02/AC16; plan PR-3.
--
-- 1) class_sessions/class_schedule_patterns thêm teaching_minutes/break_minutes:
--    - duration_minutes GIỮ NGUYÊN vai trò phút CHIẾM LỊCH (mọi kiểm tra trùng giờ không đổi).
--    - teaching_minutes NULL = dữ liệu cũ chưa tách (đọc ra hiểu là teaching = duration, break
--      giữ default 0). KHÔNG backfill số — không đoán quá khứ (spec §10).
--    - CHECK: đã tách thì teaching > 0, break >= 0 và teaching + break = duration.
-- 2) class_sessions thêm completed_at/completed_by: trạng thái "đã ghi nhận kết thúc" (spec §2.3
--    — buổi qua giờ KHÔNG tự thành đã dạy). Luồng chốt buổi dùng ở PR-7; PR-3 chỉ đặt schema.
-- 3) Partial UNIQUE (pattern_id, original_date) trên buổi CHƯA override: bất biến cho regenerate
--    kiểu UPSERT-GIỮ-ID (G1/AC16 — liên kết theo buổi không bốc hơi khi tính lại lịch).
--    Nếu dữ liệu cũ có buổi "ma" trùng ô (tiền-V262), migration này SẼ FAIL CÓ CHỦ ĐÍCH —
--    chạy backend/scripts/pr3-check-duplicate-pattern-slots.sql trên bản sao dữ liệu thật
--    TRƯỚC khi merge (cổng nâng cấp §7.2 của plan) và xử lý tay từng ca (buổi ma có thể đang
--    được teacher_session_record trỏ tới nên KHÔNG tự xoá ở đây).
-- ============================================================

ALTER TABLE class_sessions
    ADD COLUMN IF NOT EXISTS teaching_minutes INT;

ALTER TABLE class_sessions
    ADD COLUMN IF NOT EXISTS break_minutes INT NOT NULL DEFAULT 0;

ALTER TABLE class_sessions
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

ALTER TABLE class_sessions
    ADD COLUMN IF NOT EXISTS completed_by BIGINT;

ALTER TABLE class_schedule_patterns
    ADD COLUMN IF NOT EXISTS teaching_minutes INT;

ALTER TABLE class_schedule_patterns
    ADD COLUMN IF NOT EXISTS break_minutes INT NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_class_sessions_pattern_slot
    ON class_sessions(pattern_id, original_date)
    WHERE pattern_id IS NOT NULL AND original_date IS NOT NULL AND is_overridden = false;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cs_teaching_minutes') THEN
    ALTER TABLE class_sessions
      ADD CONSTRAINT chk_cs_teaching_minutes
      CHECK (teaching_minutes IS NULL OR teaching_minutes > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cs_break_minutes') THEN
    ALTER TABLE class_sessions
      ADD CONSTRAINT chk_cs_break_minutes
      CHECK (break_minutes >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cs_minutes_sum') THEN
    ALTER TABLE class_sessions
      ADD CONSTRAINT chk_cs_minutes_sum
      CHECK (teaching_minutes IS NULL OR teaching_minutes + break_minutes = duration_minutes);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cs_completed_by') THEN
    ALTER TABLE class_sessions
      ADD CONSTRAINT fk_cs_completed_by
      FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_csp_teaching_minutes') THEN
    ALTER TABLE class_schedule_patterns
      ADD CONSTRAINT chk_csp_teaching_minutes
      CHECK (teaching_minutes IS NULL OR teaching_minutes > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_csp_break_minutes') THEN
    ALTER TABLE class_schedule_patterns
      ADD CONSTRAINT chk_csp_break_minutes
      CHECK (break_minutes >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_csp_minutes_sum') THEN
    ALTER TABLE class_schedule_patterns
      ADD CONSTRAINT chk_csp_minutes_sum
      CHECK (teaching_minutes IS NULL OR teaching_minutes + break_minutes = duration_minutes);
  END IF;
END $$;
