-- V46: Topic taxonomy facet + merge legacy/UI tags into canonical V31 names (PostgreSQL).

ALTER TABLE tags ADD COLUMN IF NOT EXISTS is_topic_taxonomy BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE tags SET is_topic_taxonomy = TRUE WHERE name IN (
    'Alltag','Reise','Beruf','Familie','Essen','Gesundheit','Wohnen','Bildung','Freizeit',
    'Technik','Finanzen','Einkaufen','Verkehr','Natur','Kultur','Gefühle'
);

INSERT INTO word_tags (word_id, tag_id)
SELECT wt.word_id, t_new.id FROM word_tags wt
INNER JOIN tags t_old ON t_old.id = wt.tag_id AND t_old.name = 'TRAVEL'
INNER JOIN tags t_new ON t_new.name = 'Reise'
ON CONFLICT DO NOTHING;
DELETE FROM word_tags wt USING tags t_old
WHERE t_old.id = wt.tag_id AND t_old.name = 'TRAVEL';

INSERT INTO word_tags (word_id, tag_id)
SELECT wt.word_id, t_new.id FROM word_tags wt
INNER JOIN tags t_old ON t_old.id = wt.tag_id AND t_old.name = 'BUSINESS'
INNER JOIN tags t_new ON t_new.name = 'Beruf'
ON CONFLICT DO NOTHING;
DELETE FROM word_tags wt USING tags t_old
WHERE t_old.id = wt.tag_id AND t_old.name = 'BUSINESS';

INSERT INTO word_tags (word_id, tag_id)
SELECT wt.word_id, t_new.id FROM word_tags wt
INNER JOIN tags t_old ON t_old.id = wt.tag_id AND t_old.name = 'TECH'
INNER JOIN tags t_new ON t_new.name = 'Technik'
ON CONFLICT DO NOTHING;
DELETE FROM word_tags wt USING tags t_old
WHERE t_old.id = wt.tag_id AND t_old.name = 'TECH';

INSERT INTO word_tags (word_id, tag_id)
SELECT wt.word_id, t_new.id FROM word_tags wt
INNER JOIN tags t_old ON t_old.id = wt.tag_id AND t_old.name = 'GENERAL'
INNER JOIN tags t_new ON t_new.name = 'Alltag'
ON CONFLICT DO NOTHING;
DELETE FROM word_tags wt USING tags t_old
WHERE t_old.id = wt.tag_id AND t_old.name = 'GENERAL';

INSERT INTO word_tags (word_id, tag_id)
SELECT wt.word_id, t_new.id FROM word_tags wt
INNER JOIN tags t_old ON t_old.id = wt.tag_id AND t_old.name = 'Essen & Trinken'
INNER JOIN tags t_new ON t_new.name = 'Essen'
ON CONFLICT DO NOTHING;
DELETE FROM word_tags wt USING tags t_old
WHERE t_old.id = wt.tag_id AND t_old.name = 'Essen & Trinken';

INSERT INTO word_tags (word_id, tag_id)
SELECT wt.word_id, t_new.id FROM word_tags wt
INNER JOIN tags t_old ON t_old.id = wt.tag_id AND t_old.name = 'Arbeit & Beruf'
INNER JOIN tags t_new ON t_new.name = 'Beruf'
ON CONFLICT DO NOTHING;
DELETE FROM word_tags wt USING tags t_old
WHERE t_old.id = wt.tag_id AND t_old.name = 'Arbeit & Beruf';

INSERT INTO word_tags (word_id, tag_id)
SELECT wt.word_id, t_new.id FROM word_tags wt
INNER JOIN tags t_old ON t_old.id = wt.tag_id AND t_old.name = 'Reisen'
INNER JOIN tags t_new ON t_new.name = 'Reise'
ON CONFLICT DO NOTHING;
DELETE FROM word_tags wt USING tags t_old
WHERE t_old.id = wt.tag_id AND t_old.name = 'Reisen';

INSERT INTO word_tags (word_id, tag_id)
SELECT wt.word_id, t_new.id FROM word_tags wt
INNER JOIN tags t_old ON t_old.id = wt.tag_id AND t_old.name = 'Schule'
INNER JOIN tags t_new ON t_new.name = 'Bildung'
ON CONFLICT DO NOTHING;
DELETE FROM word_tags wt USING tags t_old
WHERE t_old.id = wt.tag_id AND t_old.name = 'Schule';

DELETE FROM tags WHERE name IN (
    'TRAVEL','BUSINESS','TECH','GENERAL',
    'Essen & Trinken','Arbeit & Beruf','Reisen','Schule'
);
