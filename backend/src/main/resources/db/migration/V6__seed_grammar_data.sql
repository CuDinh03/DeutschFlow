-- ============================================================
-- V6: SEED DATA — declination_rules (48 rows) + sentence_patterns
-- ============================================================

-- ------------------------------------------------------------
-- DECLINATION RULES: 4 Kasus × 4 Gender × 3 ArticleType = 48
-- ------------------------------------------------------------

-- NOMINATIV
INSERT INTO declination_rules (kasus, gender, article_type, article, adj_ending) VALUES
('NOMINATIV', 'DER',    'DEFINITE',   'der',   '-e'),
('NOMINATIV', 'DER',    'INDEFINITE', 'ein',   '-er'),
('NOMINATIV', 'DER',    'NONE',       '--',    '-er'),
('NOMINATIV', 'DIE',    'DEFINITE',   'die',   '-e'),
('NOMINATIV', 'DIE',    'INDEFINITE', 'eine',  '-e'),
('NOMINATIV', 'DIE',    'NONE',       '--',    '-e'),
('NOMINATIV', 'DAS',    'DEFINITE',   'das',   '-e'),
('NOMINATIV', 'DAS',    'INDEFINITE', 'ein',   '-es'),
('NOMINATIV', 'DAS',    'NONE',       '--',    '-es'),
('NOMINATIV', 'PLURAL', 'DEFINITE',   'die',   '-en'),
('NOMINATIV', 'PLURAL', 'INDEFINITE', '--',    '-e'),
('NOMINATIV', 'PLURAL', 'NONE',       '--',    '-e');

-- AKKUSATIV
INSERT INTO declination_rules (kasus, gender, article_type, article, adj_ending) VALUES
('AKKUSATIV', 'DER',    'DEFINITE',   'den',   '-en'),
('AKKUSATIV', 'DER',    'INDEFINITE', 'einen', '-en'),
('AKKUSATIV', 'DER',    'NONE',       '--',    '-en'),
('AKKUSATIV', 'DIE',    'DEFINITE',   'die',   '-e'),
('AKKUSATIV', 'DIE',    'INDEFINITE', 'eine',  '-e'),
('AKKUSATIV', 'DIE',    'NONE',       '--',    '-e'),
('AKKUSATIV', 'DAS',    'DEFINITE',   'das',   '-e'),
('AKKUSATIV', 'DAS',    'INDEFINITE', 'ein',   '-es'),
('AKKUSATIV', 'DAS',    'NONE',       '--',    '-es'),
('AKKUSATIV', 'PLURAL', 'DEFINITE',   'die',   '-en'),
('AKKUSATIV', 'PLURAL', 'INDEFINITE', '--',    '-e'),
('AKKUSATIV', 'PLURAL', 'NONE',       '--',    '-e');

-- DATIV
INSERT INTO declination_rules (kasus, gender, article_type, article, adj_ending) VALUES
('DATIV', 'DER',    'DEFINITE',   'dem',   '-en'),
('DATIV', 'DER',    'INDEFINITE', 'einem', '-en'),
('DATIV', 'DER',    'NONE',       '--',    '-em'),
('DATIV', 'DIE',    'DEFINITE',   'der',   '-en'),
('DATIV', 'DIE',    'INDEFINITE', 'einer', '-en'),
('DATIV', 'DIE',    'NONE',       '--',    '-er'),
('DATIV', 'DAS',    'DEFINITE',   'dem',   '-en'),
('DATIV', 'DAS',    'INDEFINITE', 'einem', '-en'),
('DATIV', 'DAS',    'NONE',       '--',    '-em'),
('DATIV', 'PLURAL', 'DEFINITE',   'den',   '-en'),
('DATIV', 'PLURAL', 'INDEFINITE', '--',    '-en'),
('DATIV', 'PLURAL', 'NONE',       '--',    '-en');

-- GENITIV
INSERT INTO declination_rules (kasus, gender, article_type, article, adj_ending) VALUES
('GENITIV', 'DER',    'DEFINITE',   'des',    '-en'),
('GENITIV', 'DER',    'INDEFINITE', 'eines',  '-en'),
('GENITIV', 'DER',    'NONE',       '--',     '-en'),
('GENITIV', 'DIE',    'DEFINITE',   'der',    '-en'),
('GENITIV', 'DIE',    'INDEFINITE', 'einer',  '-en'),
('GENITIV', 'DIE',    'NONE',       '--',     '-er'),
('GENITIV', 'DAS',    'DEFINITE',   'des',    '-en'),
('GENITIV', 'DAS',    'INDEFINITE', 'eines',  '-en'),
('GENITIV', 'DAS',    'NONE',       '--',     '-en'),
('GENITIV', 'PLURAL', 'DEFINITE',   'der',    '-en'),
('GENITIV', 'PLURAL', 'INDEFINITE', '--',     '-er'),
('GENITIV', 'PLURAL', 'NONE',       '--',     '-er');

-- ------------------------------------------------------------
-- SENTENCE PATTERNS
-- ------------------------------------------------------------
INSERT INTO sentence_patterns (name, pattern_type, connector, slot_order, verb_kick, v2_rule) VALUES
('Hauptsatz_SVO',
 'HAUPTSATZ', NULL,
 '["SUBJECT","VERB_FINITE","DATIV_OBJ","AKKUSATIV_OBJ","ADVERB","VERB_INFINITE"]',
 FALSE, TRUE),

('Hauptsatz_Adverb_First',
 'HAUPTSATZ', NULL,
 '["ADVERB","VERB_FINITE","SUBJECT","DATIV_OBJ","AKKUSATIV_OBJ","VERB_INFINITE"]',
 FALSE, TRUE),

('Nebensatz_weil',
 'NEBENSATZ', 'weil',
 '["CONNECTOR","SUBJECT","DATIV_OBJ","AKKUSATIV_OBJ","ADVERB","VERB_FINITE"]',
 TRUE, FALSE),

('Nebensatz_dass',
 'NEBENSATZ', 'dass',
 '["CONNECTOR","SUBJECT","DATIV_OBJ","AKKUSATIV_OBJ","ADVERB","VERB_FINITE"]',
 TRUE, FALSE),

('Nebensatz_wenn',
 'NEBENSATZ', 'wenn',
 '["CONNECTOR","SUBJECT","DATIV_OBJ","AKKUSATIV_OBJ","ADVERB","VERB_FINITE"]',
 TRUE, FALSE),

('Nebensatz_obwohl',
 'NEBENSATZ', 'obwohl',
 '["CONNECTOR","SUBJECT","DATIV_OBJ","AKKUSATIV_OBJ","ADVERB","VERB_FINITE"]',
 TRUE, FALSE),

('Fragesatz_W',
 'FRAGESATZ_W', NULL,
 '["W_WORT","VERB_FINITE","SUBJECT","DATIV_OBJ","AKKUSATIV_OBJ"]',
 FALSE, FALSE),

('Fragesatz_Ja_Nein',
 'FRAGESATZ_JA_NEIN', NULL,
 '["VERB_FINITE","SUBJECT","DATIV_OBJ","AKKUSATIV_OBJ"]',
 FALSE, FALSE);

-- ------------------------------------------------------------
-- SEED TAGS
-- ------------------------------------------------------------
INSERT INTO tags (name, color) VALUES
('Essen & Trinken', '#f97316'),
('Familie',         '#ec4899'),
('Arbeit & Beruf',  '#6366f1'),
('Reisen',          '#14b8a6'),
('Wohnen',          '#84cc16'),
('Freizeit',        '#f59e0b'),
('Gesundheit',      '#ef4444'),
('Schule',          '#3b82f6'),
('Natur',           '#22c55e'),
('Alltag',          '#a855f7');
