-- V47: Minimal Bildung (Education) ↔ word coverage for learner practice (A1 seeds from V9/V10).
-- Many environments had taxonomy tag Bildung without word_tags; this attaches common school/study lemmas.

INSERT IGNORE INTO word_tags (word_id, tag_id)
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
  );
