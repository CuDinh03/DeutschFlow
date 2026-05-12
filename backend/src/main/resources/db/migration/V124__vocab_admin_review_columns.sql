-- V124: Phase 4 Vocabulary Quality — Admin Review Tracking
-- Thêm reviewed_by_admin và admin_notes vào bảng words
-- Mục đích: admin có thể đánh dấu từ đã được kiểm tra, ghi chú vấn đề

ALTER TABLE words
  ADD COLUMN IF NOT EXISTS reviewed_by_admin  BOOLEAN   DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS admin_review_notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at         TIMESTAMP(6);

-- Index để admin dashboard query nhanh từ chưa review
CREATE INDEX IF NOT EXISTS idx_words_not_reviewed
  ON words (id)
  WHERE reviewed_by_admin = FALSE;

-- Index để thống kê từ đã review
CREATE INDEX IF NOT EXISTS idx_words_reviewed
  ON words (reviewed_at DESC)
  WHERE reviewed_by_admin = TRUE;

COMMENT ON COLUMN words.reviewed_by_admin IS
  'TRUE = admin đã kiểm tra thủ công chất lượng từ này';
COMMENT ON COLUMN words.admin_review_notes IS
  'Ghi chú của admin về vấn đề chất lượng (dtype sai, gender sai, thiếu IPA...)';
COMMENT ON COLUMN words.reviewed_at IS
  'Thời điểm admin xác nhận review lần cuối';
