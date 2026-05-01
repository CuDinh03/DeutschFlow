-- V47: Bildung ↔ word_tags (PostgreSQL)

INSERT INTO word_tags (word_id, tag_id)
SELECT w.id, t.id
FROM words w
INNER JOIN tags t ON t.name = 'Bildung'
WHERE w.cefr_level = 'A1'
  AND TRIM(w.base_form) IN (
    'Schule',
    'Frage',
    'Antwort',
    'Sprache',
    'Buch',
    'lernen'
  )
ON CONFLICT DO NOTHING;
