-- V46: Topic taxonomy facet + merge legacy/UI tags into canonical V31 names.
-- "is_topic_taxonomy" restricts student topic pickers & limits auto-tag reset/clear scope.

ALTER TABLE tags
    ADD COLUMN is_topic_taxonomy TINYINT(1) NOT NULL DEFAULT 0
        COMMENT '1 = V31 learner topic facet (shown in topicsOnly tag lists / auto-tag scope)';

UPDATE tags SET is_topic_taxonomy = 1 WHERE name IN (
    'Alltag','Reise','Beruf','Familie','Essen','Gesundheit','Wohnen','Bildung','Freizeit',
    'Technik','Finanzen','Einkaufen','Verkehr','Natur','Kultur','Gefühle'
);

-- V13 MVP names -> V31 taxonomy
INSERT IGNORE INTO word_tags (word_id, tag_id)
SELECT wt.word_id, t_new.id FROM word_tags wt
INNER JOIN tags t_old ON t_old.id = wt.tag_id AND t_old.name = 'TRAVEL'
INNER JOIN tags t_new ON t_new.name = 'Reise';
DELETE wt FROM word_tags wt INNER JOIN tags t_old ON t_old.id = wt.tag_id AND t_old.name = 'TRAVEL';

INSERT IGNORE INTO word_tags (word_id, tag_id)
SELECT wt.word_id, t_new.id FROM word_tags wt
INNER JOIN tags t_old ON t_old.id = wt.tag_id AND t_old.name = 'BUSINESS'
INNER JOIN tags t_new ON t_new.name = 'Beruf';
DELETE wt FROM word_tags wt INNER JOIN tags t_old ON t_old.id = wt.tag_id AND t_old.name = 'BUSINESS';

INSERT IGNORE INTO word_tags (word_id, tag_id)
SELECT wt.word_id, t_new.id FROM word_tags wt
INNER JOIN tags t_old ON t_old.id = wt.tag_id AND t_old.name = 'TECH'
INNER JOIN tags t_new ON t_new.name = 'Technik';
DELETE wt FROM word_tags wt INNER JOIN tags t_old ON t_old.id = wt.tag_id AND t_old.name = 'TECH';

INSERT IGNORE INTO word_tags (word_id, tag_id)
SELECT wt.word_id, t_new.id FROM word_tags wt
INNER JOIN tags t_old ON t_old.id = wt.tag_id AND t_old.name = 'GENERAL'
INNER JOIN tags t_new ON t_new.name = 'Alltag';
DELETE wt FROM word_tags wt INNER JOIN tags t_old ON t_old.id = wt.tag_id AND t_old.name = 'GENERAL';

-- V6 grammar seed topic labels -> V31 (may coexist with identical names — merge only differing names)
INSERT IGNORE INTO word_tags (word_id, tag_id)
SELECT wt.word_id, t_new.id FROM word_tags wt
INNER JOIN tags t_old ON t_old.id = wt.tag_id AND t_old.name = 'Essen & Trinken'
INNER JOIN tags t_new ON t_new.name = 'Essen';
DELETE wt FROM word_tags wt INNER JOIN tags t_old ON t_old.id = wt.tag_id AND t_old.name = 'Essen & Trinken';

INSERT IGNORE INTO word_tags (word_id, tag_id)
SELECT wt.word_id, t_new.id FROM word_tags wt
INNER JOIN tags t_old ON t_old.id = wt.tag_id AND t_old.name = 'Arbeit & Beruf'
INNER JOIN tags t_new ON t_new.name = 'Beruf';
DELETE wt FROM word_tags wt INNER JOIN tags t_old ON t_old.id = wt.tag_id AND t_old.name = 'Arbeit & Beruf';

INSERT IGNORE INTO word_tags (word_id, tag_id)
SELECT wt.word_id, t_new.id FROM word_tags wt
INNER JOIN tags t_old ON t_old.id = wt.tag_id AND t_old.name = 'Reisen'
INNER JOIN tags t_new ON t_new.name = 'Reise';
DELETE wt FROM word_tags wt INNER JOIN tags t_old ON t_old.id = wt.tag_id AND t_old.name = 'Reisen';

INSERT IGNORE INTO word_tags (word_id, tag_id)
SELECT wt.word_id, t_new.id FROM word_tags wt
INNER JOIN tags t_old ON t_old.id = wt.tag_id AND t_old.name = 'Schule'
INNER JOIN tags t_new ON t_new.name = 'Bildung';
DELETE wt FROM word_tags wt INNER JOIN tags t_old ON t_old.id = wt.tag_id AND t_old.name = 'Schule';

-- Drop orphaned legacy topic rows (cascades tag_translations)
DELETE FROM tags WHERE name IN (
    'TRAVEL','BUSINESS','TECH','GENERAL',
    'Essen & Trinken','Arbeit & Beruf','Reisen','Schule'
);
