-- ============================================================
-- V290: class_lessons ← liên kết Lektion giáo trình + cờ bài bổ trợ (PR-1, AC01)
-- ============================================================
-- lektion_id: bài học của lớp được SINH từ Lektion nào của giáo trình trung tâm (V289).
--   NULL = bài tự do/lớp chưa gắn giáo trình (toàn bộ dữ liệu cũ — không backfill).
--   Bài có lektion_id là NỘI DUNG BẮT BUỘC: giáo viên không sửa/xóa nội dung (guard service,
--   AC01); FK ON DELETE RESTRICT — còn bài đang tham chiếu thì không xoá được Lektion
--   (tức không xoá được phiên bản/bộ giáo trình đang dùng).
-- is_supplementary: bài BỔ TRỢ giáo viên tự thêm trong lớp đã gắn giáo trình (D02) —
--   không tính vào mẫu số hoàn thành giáo trình (dùng từ PR-4). Mặc định FALSE cho dữ liệu cũ.
-- ============================================================

ALTER TABLE class_lessons
    ADD COLUMN IF NOT EXISTS lektion_id BIGINT;

ALTER TABLE class_lessons
    ADD COLUMN IF NOT EXISTS is_supplementary BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_class_lessons_lektion
    ON class_lessons(lektion_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_class_lessons_lektion') THEN
    ALTER TABLE class_lessons
      ADD CONSTRAINT fk_class_lessons_lektion
      FOREIGN KEY (lektion_id) REFERENCES curriculum_lektionen(id) ON DELETE RESTRICT;
  END IF;
END $$;
