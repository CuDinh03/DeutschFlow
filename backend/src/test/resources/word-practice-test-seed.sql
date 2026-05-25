-- Idempotent vocabulary seed for WordPracticeTopicIntegrationTest (PostgreSQL + Flyway schema).

INSERT INTO tags (name, color) SELECT 'BUSINESS', '#f59e0b' WHERE NOT EXISTS (SELECT 1 FROM tags WHERE name = 'BUSINESS');
INSERT INTO tags (name, color) SELECT 'Beruf', '#6366f1' WHERE NOT EXISTS (SELECT 1 FROM tags WHERE name = 'Beruf');
INSERT INTO tags (name, color) SELECT 'Bildung', '#818cf8' WHERE NOT EXISTS (SELECT 1 FROM tags WHERE name = 'Bildung');
INSERT INTO tags (name, color) SELECT 'GENERAL', '#64748b' WHERE NOT EXISTS (SELECT 1 FROM tags WHERE name = 'GENERAL');

INSERT INTO words (dtype, base_form, cefr_level)
SELECT 'Word', '__vp_audit_business__', 'A1' WHERE NOT EXISTS (SELECT 1 FROM words WHERE base_form = '__vp_audit_business__');
INSERT INTO word_tags (word_id, tag_id)
SELECT w.id, t.id FROM words w JOIN tags t ON t.name = 'BUSINESS'
WHERE w.base_form = '__vp_audit_business__'
  AND NOT EXISTS (SELECT 1 FROM word_tags x WHERE x.word_id = w.id AND x.tag_id = t.id);

INSERT INTO words (dtype, base_form, cefr_level)
SELECT 'Word', '__vp_audit_beruf__', 'A1' WHERE NOT EXISTS (SELECT 1 FROM words WHERE base_form = '__vp_audit_beruf__');
INSERT INTO word_tags (word_id, tag_id)
SELECT w.id, t.id FROM words w JOIN tags t ON t.name = 'Beruf'
WHERE w.base_form = '__vp_audit_beruf__'
  AND NOT EXISTS (SELECT 1 FROM word_tags x WHERE x.word_id = w.id AND x.tag_id = t.id);

-- Bildung: tag exists intentionally without word_tags (documents empty-topic case in taxonomy-only DB).

UPDATE tags SET is_topic_taxonomy = TRUE WHERE name IN ('BUSINESS', 'Beruf', 'Bildung', 'GENERAL');
