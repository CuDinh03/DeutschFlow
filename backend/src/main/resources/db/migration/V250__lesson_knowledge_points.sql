-- ============================================================
-- V250: lesson_knowledge_point — tách "kiến thức cần học" khỏi class_lessons.description (Phase 1b)
-- ============================================================
-- TRƯỚC: knowledge points bị nhồi vào class_lessons.description, mã hoá bằng ký tự
--        xuống dòng (frontend parseKnowledgePoints/formatKnowledgePoints). Không ràng
--        buộc, không tìm kiếm, không gắn tag/cờ trạng thái từng điểm được.
--
-- SAU:  bảng con lesson_knowledge_point (1 dòng / 1 điểm) + tùy chọn tag kỹ năng (skill_tag)
--       và tag nội dung (content_tag). Bảng con là NGUỒN CHÍNH cho web/backend; nhưng
--       description VẪN được ghi song song (dual-write ở service) làm bản sao cho mobile
--       (mobile hiện render description NGUYÊN VĂN) + fallback đọc cho bài legacy.
--
-- BACKFILL: đọc từng class_lessons.description → tách theo '\n', bỏ ký tự bullet đầu dòng
--       (khớp regex parseKnowledgePoints: /^\s*[-•·*]\s*/), btrim, bỏ dòng rỗng → mỗi điểm
--       một dòng với order_index 0-based. KHÔNG đụng description (non-destructive; giữ làm
--       backup + fallback). class_lessons do giáo viên tạo, DB rỗng (fresh replay) → backfill
--       không chèn gì; prod → chép sang bảng con.
-- ============================================================

CREATE TABLE IF NOT EXISTS lesson_knowledge_point (
    id BIGSERIAL PRIMARY KEY,
    lesson_id BIGINT NOT NULL,
    order_index INT NOT NULL,
    text TEXT NOT NULL,
    skill_tag VARCHAR(16),
    content_tag VARCHAR(16),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_knowledge_point_lesson
    ON lesson_knowledge_point(lesson_id, order_index);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_lkp_lesson') THEN
    ALTER TABLE lesson_knowledge_point
      ADD CONSTRAINT fk_lkp_lesson
      FOREIGN KEY (lesson_id) REFERENCES class_lessons(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_lkp_skill_tag') THEN
    ALTER TABLE lesson_knowledge_point
      ADD CONSTRAINT chk_lkp_skill_tag
      CHECK (skill_tag IS NULL OR skill_tag IN ('HOEREN', 'LESEN', 'SCHREIBEN', 'SPRECHEN'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_lkp_content_tag') THEN
    ALTER TABLE lesson_knowledge_point
      ADD CONSTRAINT chk_lkp_content_tag
      CHECK (content_tag IS NULL OR content_tag IN ('WORTSCHATZ', 'GRAMMATIK', 'AUSSPRACHE', 'LANDESKUNDE', 'REDEMITTEL', 'STRATEGIE'));
  END IF;
END $$;

-- Backfill from existing description text (non-destructive; runs once via Flyway).
INSERT INTO lesson_knowledge_point (lesson_id, order_index, text, created_at, updated_at)
SELECT s.lesson_id,
       (ROW_NUMBER() OVER (PARTITION BY s.lesson_id ORDER BY s.ord)) - 1 AS order_index,
       s.pt,
       NOW(), NOW()
FROM (
  SELECT cl.id AS lesson_id,
         t.ord AS ord,
         -- Strip a leading bullet, then trim ALL leading/trailing whitespace (tab, CR, …)
         -- so this matches Java String.trim()/JS .trim() exactly (single-arg btrim() would
         -- only drop U+0020 spaces, leaving embedded \r on Windows-CRLF legacy descriptions).
         regexp_replace(
           regexp_replace(t.line, '^[[:space:]]*[-•·*][[:space:]]*', ''),
           '^[[:space:]]+|[[:space:]]+$', '', 'g'
         ) AS pt
  FROM class_lessons cl
  CROSS JOIN LATERAL regexp_split_to_table(cl.description, E'\n') WITH ORDINALITY AS t(line, ord)
  WHERE cl.description IS NOT NULL AND btrim(cl.description) <> ''
) s
WHERE s.pt <> ''
  AND NOT EXISTS (SELECT 1 FROM lesson_knowledge_point);
