-- ============================================================
-- V13: Seed basic tags + map to existing vocabulary (MVP)
-- ============================================================

INSERT INTO tags (name, color) VALUES
('GENERAL', '#64748b'),
('TRAVEL', '#0ea5e9'),
('BUSINESS', '#f59e0b'),
('TECH', '#8b5cf6')
ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color;

-- Map a small subset of A1 words to tags (idempotent)
INSERT INTO word_tags (word_id, tag_id)
SELECT w.id, t.id
FROM words w
JOIN tags t ON t.name = 'TRAVEL'
WHERE w.base_form IN ('Bahnhof', 'Flughafen', 'Land')
ON CONFLICT DO NOTHING;

INSERT INTO word_tags (word_id, tag_id)
SELECT w.id, t.id
FROM words w
JOIN tags t ON t.name = 'BUSINESS'
WHERE w.base_form IN ('arbeiten', 'Geld')
ON CONFLICT DO NOTHING;

INSERT INTO word_tags (word_id, tag_id)
SELECT w.id, t.id
FROM words w
JOIN tags t ON t.name = 'TECH'
WHERE w.base_form IN ('Handy')
ON CONFLICT DO NOTHING;

INSERT INTO word_tags (word_id, tag_id)
SELECT w.id, t.id
FROM words w
JOIN tags t ON t.name = 'GENERAL'
WHERE w.cefr_level = 'A1'
ON CONFLICT DO NOTHING;
