-- ─────────────────────────────────────────────────────────────────────────────
-- V31: Seed canonical taxonomy tags (German names) + localized translations.
-- Tag "name" is the canonical German identifier used in word_tags filtering.
-- Colors follow a consistent palette for UI display.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO tags (name, color) VALUES
  ('Alltag',        '#22d3ee'),
  ('Reise',         '#a78bfa'),
  ('Beruf',         '#f59e0b'),
  ('Familie',       '#f472b6'),
  ('Essen',         '#34d399'),
  ('Gesundheit',    '#fb7185'),
  ('Wohnen',        '#60a5fa'),
  ('Bildung',       '#818cf8'),
  ('Freizeit',      '#fbbf24'),
  ('Technik',       '#2dd4bf'),
  ('Finanzen',      '#4ade80'),
  ('Einkaufen',     '#f97316'),
  ('Verkehr',       '#94a3b8'),
  ('Natur',         '#86efac'),
  ('Kultur',        '#e879f9'),
  ('Gefühle',       '#fca5a5')
ON DUPLICATE KEY UPDATE color = VALUES(color);

-- Vietnamese translations
INSERT INTO tag_translations (tag_id, locale, label)
SELECT id, 'vi', label FROM (
  SELECT id, 'Cuộc sống hàng ngày'  AS label FROM tags WHERE name = 'Alltag'
  UNION ALL SELECT id, 'Du lịch'        FROM tags WHERE name = 'Reise'
  UNION ALL SELECT id, 'Nghề nghiệp'    FROM tags WHERE name = 'Beruf'
  UNION ALL SELECT id, 'Gia đình'       FROM tags WHERE name = 'Familie'
  UNION ALL SELECT id, 'Ăn uống'        FROM tags WHERE name = 'Essen'
  UNION ALL SELECT id, 'Sức khỏe'       FROM tags WHERE name = 'Gesundheit'
  UNION ALL SELECT id, 'Nhà ở'          FROM tags WHERE name = 'Wohnen'
  UNION ALL SELECT id, 'Giáo dục'       FROM tags WHERE name = 'Bildung'
  UNION ALL SELECT id, 'Giải trí'       FROM tags WHERE name = 'Freizeit'
  UNION ALL SELECT id, 'Công nghệ'      FROM tags WHERE name = 'Technik'
  UNION ALL SELECT id, 'Tài chính'      FROM tags WHERE name = 'Finanzen'
  UNION ALL SELECT id, 'Mua sắm'        FROM tags WHERE name = 'Einkaufen'
  UNION ALL SELECT id, 'Giao thông'     FROM tags WHERE name = 'Verkehr'
  UNION ALL SELECT id, 'Thiên nhiên'    FROM tags WHERE name = 'Natur'
  UNION ALL SELECT id, 'Văn hóa'        FROM tags WHERE name = 'Kultur'
  UNION ALL SELECT id, 'Cảm xúc'        FROM tags WHERE name = 'Gefühle'
) x
ON DUPLICATE KEY UPDATE label = VALUES(label);

-- English translations
INSERT INTO tag_translations (tag_id, locale, label)
SELECT id, 'en', label FROM (
  SELECT id, 'Daily Life'    AS label FROM tags WHERE name = 'Alltag'
  UNION ALL SELECT id, 'Travel'         FROM tags WHERE name = 'Reise'
  UNION ALL SELECT id, 'Work & Career'  FROM tags WHERE name = 'Beruf'
  UNION ALL SELECT id, 'Family'         FROM tags WHERE name = 'Familie'
  UNION ALL SELECT id, 'Food & Drink'   FROM tags WHERE name = 'Essen'
  UNION ALL SELECT id, 'Health'         FROM tags WHERE name = 'Gesundheit'
  UNION ALL SELECT id, 'Housing'        FROM tags WHERE name = 'Wohnen'
  UNION ALL SELECT id, 'Education'      FROM tags WHERE name = 'Bildung'
  UNION ALL SELECT id, 'Leisure'        FROM tags WHERE name = 'Freizeit'
  UNION ALL SELECT id, 'Technology'     FROM tags WHERE name = 'Technik'
  UNION ALL SELECT id, 'Finance'        FROM tags WHERE name = 'Finanzen'
  UNION ALL SELECT id, 'Shopping'       FROM tags WHERE name = 'Einkaufen'
  UNION ALL SELECT id, 'Transport'      FROM tags WHERE name = 'Verkehr'
  UNION ALL SELECT id, 'Nature'         FROM tags WHERE name = 'Natur'
  UNION ALL SELECT id, 'Culture'        FROM tags WHERE name = 'Kultur'
  UNION ALL SELECT id, 'Emotions'       FROM tags WHERE name = 'Gefühle'
) x
ON DUPLICATE KEY UPDATE label = VALUES(label);
