-- ============================================================
-- V13: Seed basic tags + map to existing vocabulary (MVP)
-- ============================================================

INSERT INTO tags (name, color) VALUES
('GENERAL', '#64748b'),
('TRAVEL', '#0ea5e9'),
('BUSINESS', '#f59e0b'),
('TECH', '#8b5cf6')
ON DUPLICATE KEY UPDATE color = VALUES(color);

-- Map a small subset of A1 words to tags (idempotent)
INSERT IGNORE INTO word_tags (word_id, tag_id)
SELECT w.id, t.id
FROM words w
JOIN tags t ON t.name = 'TRAVEL'
WHERE w.base_form IN ('Bahnhof', 'Flughafen', 'Land');

INSERT IGNORE INTO word_tags (word_id, tag_id)
SELECT w.id, t.id
FROM words w
JOIN tags t ON t.name = 'BUSINESS'
WHERE w.base_form IN ('arbeiten', 'Geld');

INSERT IGNORE INTO word_tags (word_id, tag_id)
SELECT w.id, t.id
FROM words w
JOIN tags t ON t.name = 'TECH'
WHERE w.base_form IN ('Handy');

INSERT IGNORE INTO word_tags (word_id, tag_id)
SELECT w.id, t.id
FROM words w
JOIN tags t ON t.name = 'GENERAL'
WHERE w.cefr_level = 'A1';
