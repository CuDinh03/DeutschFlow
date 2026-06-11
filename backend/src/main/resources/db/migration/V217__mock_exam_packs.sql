-- V217: Mock-exam packs (checklist D3) — curated, subscription-gated bundles of mock exams.
-- A pack is a view over mock_exams by (cefr_level, exam_format): its exams are the active
-- mock_exams matching that level+format. requires_paid packs are locked for FREE users and
-- unlocked by any paid plan (PRO/PREMIUM/ULTRA) — the SKU is the subscription tier, not a
-- per-pack purchase. Admins curate packs; this seeds packs over the existing seeded exams.
CREATE TABLE mock_exam_packs (
    id             BIGSERIAL PRIMARY KEY,
    title          VARCHAR(200) NOT NULL,
    description_vi TEXT,
    cefr_level     VARCHAR(5)   NOT NULL,
    exam_format    VARCHAR(30)  NOT NULL DEFAULT 'GOETHE',
    requires_paid  BOOLEAN      NOT NULL DEFAULT TRUE,
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order     INT          NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_mock_exam_packs_active ON mock_exam_packs (sort_order) WHERE is_active = TRUE;

INSERT INTO mock_exam_packs (title, description_vi, cefr_level, exam_format, requires_paid, sort_order) VALUES
 ('Luyện thi Goethe B1 — Bộ đề đầy đủ', 'Bộ đề thi thử Goethe-Zertifikat B1 sát cấu trúc thật, có chấm điểm + nhận xét AI.', 'B1', 'GOETHE', TRUE, 1),
 ('Luyện thi Goethe B2', 'Bộ đề thi thử Goethe B2 nâng cao, đầy đủ 4 kỹ năng.', 'B2', 'GOETHE', TRUE, 2),
 ('Làm quen Goethe A1', 'Bộ đề thi thử Goethe A1 — bước khởi đầu (gồm cả đề miễn phí).', 'A1', 'GOETHE', FALSE, 3);
