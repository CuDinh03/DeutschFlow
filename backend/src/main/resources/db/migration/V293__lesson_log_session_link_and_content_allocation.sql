-- ============================================================
-- V293: Nhật ký gắn BUỔI + bảng phân bổ nội dung theo buổi (PR-4, GĐ2)
-- ============================================================
-- Spec vận hành lớp trung tâm §2.3/§5 (AC05–AC08); plan PR-4.
--
-- 1) class_lesson_logs.session_id: nhật ký/điểm danh neo vào BUỔI (class_sessions.id — id đã
--    bất biến nhờ V292 + regenerate giữ-ID), hết cảnh hai buổi sáng/chiều cùng ngày phải phân
--    biệt bằng "số buổi" nhập tay (AC05). FK RESTRICT: buổi đã có nhật ký là lịch sử — không
--    xoá được buổi (nhật ký chỉ ghi cho buổi đã diễn ra nên không cản trở regenerate/deletePattern
--    vốn chỉ đụng buổi tương lai).
-- 2) BACKFILL AN TOÀN, KHÔNG ĐOÁN (spec §10): chỉ map nhật ký cũ vào buổi khi ngày đó lớp có
--    ĐÚNG MỘT buổi trong class_sessions. Ngày 0 buổi hoặc ≥2 buổi → giữ session_id NULL (đường
--    legacy theo ngày + số buổi vẫn nguyên). Chạy backend/scripts/pr4-check-log-mapping.sql trên
--    prod TRƯỚC merge để biết trước số lượng từng nhóm (cổng §7.2).
-- 3) Unique đổi tầng: 1 nhật ký / 1 buổi khi đã gắn session_id; hai index V266 theo (ngày, số
--    buổi) thu hẹp lại CHỈ cho nhật ký legacy (session_id NULL) — nếu không, log sáng gắn buổi
--    sáng + log chiều gắn buổi chiều cùng ngày sẽ bị index cũ chặn oan (AC05).
-- 4) class_session_contents: phân bổ mục nội dung vào buổi (kế hoạch → xác nhận đã dạy/dở →
--    phần dở chuyển tiếp sang buổi kế qua carried_from_id, giữ liên kết gốc không nhân bản —
--    spec §5, AC06). FK session RESTRICT: buổi có phân bổ không bị xoá lặng lẽ.
-- ============================================================

ALTER TABLE class_lesson_logs
    ADD COLUMN IF NOT EXISTS session_id BIGINT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cll_session') THEN
    ALTER TABLE class_lesson_logs
      ADD CONSTRAINT fk_cll_session
      FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Backfill tất định: ngày có đúng MỘT buổi của lớp → nhật ký ngày đó thuộc buổi đó.
UPDATE class_lesson_logs l
SET session_id = s.sid
FROM (
    SELECT class_id, (start_at::date) AS d, MIN(id) AS sid
    FROM class_sessions
    GROUP BY class_id, (start_at::date)
    HAVING COUNT(*) = 1
) s
WHERE l.session_id IS NULL
  AND l.class_id = s.class_id
  AND l.session_date = s.d;

-- 1 nhật ký / buổi.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cll_by_session
    ON class_lesson_logs(session_id)
    WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cll_session ON class_lesson_logs(session_id);

-- Thu hẹp 2 unique V266 về nhóm legacy (session_id NULL). DROP + CREATE cùng transaction của
-- Flyway nên không có khe hở ghi trùng.
DROP INDEX IF EXISTS uq_class_lesson_logs_session;
CREATE UNIQUE INDEX uq_class_lesson_logs_session
    ON class_lesson_logs(class_id, session_date, session_number)
    WHERE session_number IS NOT NULL AND session_id IS NULL;

DROP INDEX IF EXISTS uq_class_lesson_logs_date;
CREATE UNIQUE INDEX uq_class_lesson_logs_date
    ON class_lesson_logs(class_id, session_date)
    WHERE session_number IS NULL AND session_id IS NULL;

COMMENT ON INDEX uq_class_lesson_logs_session IS
    'Chống trùng nhật ký theo (lớp, ngày, số buổi) — CHỈ cho nhật ký legacy chưa gắn buổi (V293). Nhật ký gắn buổi chốt bằng uq_cll_by_session.';
COMMENT ON INDEX uq_class_lesson_logs_date IS
    'Bổ trợ nhóm legacy không đánh số buổi (session_id NULL) — xem uq_class_lesson_logs_session.';

-- ── Phân bổ nội dung theo buổi ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS class_session_contents (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL,
    class_lesson_id BIGINT NOT NULL,
    curriculum_item_id BIGINT,
    order_index INT NOT NULL,
    planned_minutes INT,
    status VARCHAR(12) NOT NULL DEFAULT 'PLANNED',
    actual_minutes INT,
    remaining_minutes INT,
    carried_from_id BIGINT,
    confirmed_by BIGINT,
    confirmed_at TIMESTAMP,
    note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_csc_session ON class_session_contents(session_id, order_index);
CREATE INDEX IF NOT EXISTS idx_csc_lesson ON class_session_contents(class_lesson_id);
CREATE INDEX IF NOT EXISTS idx_csc_item ON class_session_contents(curriculum_item_id);

-- Một mục bắt buộc chỉ có MỘT dòng phân bổ trong một buổi (chia item qua nhiều buổi = nhiều buổi
-- khác nhau; carry-over cũng nằm ở buổi KHÁC nên không vướng).
CREATE UNIQUE INDEX IF NOT EXISTS uq_csc_session_item
    ON class_session_contents(session_id, curriculum_item_id)
    WHERE curriculum_item_id IS NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_csc_session') THEN
    ALTER TABLE class_session_contents
      ADD CONSTRAINT fk_csc_session
      FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_csc_lesson') THEN
    ALTER TABLE class_session_contents
      ADD CONSTRAINT fk_csc_lesson
      FOREIGN KEY (class_lesson_id) REFERENCES class_lessons(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_csc_item') THEN
    ALTER TABLE class_session_contents
      ADD CONSTRAINT fk_csc_item
      FOREIGN KEY (curriculum_item_id) REFERENCES curriculum_items(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_csc_carried_from') THEN
    ALTER TABLE class_session_contents
      ADD CONSTRAINT fk_csc_carried_from
      FOREIGN KEY (carried_from_id) REFERENCES class_session_contents(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_csc_status') THEN
    ALTER TABLE class_session_contents
      ADD CONSTRAINT chk_csc_status
      CHECK (status IN ('PLANNED', 'TAUGHT', 'PARTIAL'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_csc_planned_minutes') THEN
    ALTER TABLE class_session_contents
      ADD CONSTRAINT chk_csc_planned_minutes
      CHECK (planned_minutes IS NULL OR planned_minutes > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_csc_actual_minutes') THEN
    ALTER TABLE class_session_contents
      ADD CONSTRAINT chk_csc_actual_minutes
      CHECK (actual_minutes IS NULL OR actual_minutes >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_csc_remaining_minutes') THEN
    ALTER TABLE class_session_contents
      ADD CONSTRAINT chk_csc_remaining_minutes
      CHECK (remaining_minutes IS NULL OR remaining_minutes > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_csc_confirmed_by') THEN
    ALTER TABLE class_session_contents
      ADD CONSTRAINT fk_csc_confirmed_by
      FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
