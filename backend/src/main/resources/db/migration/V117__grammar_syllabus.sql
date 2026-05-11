-- V117: Grammar Syllabus System
-- Supports: Teacher creates AI exercises → Admin reviews → Student practices

-- 1. Grammar Topics (organized by CEFR level)
CREATE TABLE IF NOT EXISTS grammar_topics (
  id              BIGSERIAL PRIMARY KEY,
  cefr_level      VARCHAR(5)   NOT NULL,
  topic_code      VARCHAR(50)  NOT NULL UNIQUE,
  title_de        VARCHAR(200) NOT NULL,
  title_vi        VARCHAR(200) NOT NULL,
  title_en        VARCHAR(200),
  description_vi  TEXT,
  sort_order      INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gt_cefr ON grammar_topics (cefr_level, sort_order);

-- 2. Grammar Exercises
CREATE TABLE IF NOT EXISTS grammar_exercises (
  id              BIGSERIAL PRIMARY KEY,
  topic_id        BIGINT NOT NULL REFERENCES grammar_topics(id) ON DELETE CASCADE,
  exercise_type   VARCHAR(30) NOT NULL,       -- FILL_BLANK, MULTIPLE_CHOICE, REORDER, TRANSLATE
  difficulty      INT DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  question_json   JSONB NOT NULL,             -- {prompt, options[], correct_answer, explanation_vi, explanation_de}
  status          VARCHAR(20) DEFAULT 'DRAFT',-- DRAFT, PENDING_REVIEW, APPROVED, REJECTED
  reject_reason   TEXT,
  created_by      BIGINT,                     -- Teacher user id
  reviewed_by     BIGINT,                     -- Admin user id
  reviewed_at     TIMESTAMPTZ,
  ai_generated    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ge_topic    ON grammar_exercises (topic_id, status);
CREATE INDEX idx_ge_status   ON grammar_exercises (status);
CREATE INDEX idx_ge_creator  ON grammar_exercises (created_by);

-- 3. Student Progress per Topic
CREATE TABLE IF NOT EXISTS grammar_topic_progress (
  id                BIGSERIAL PRIMARY KEY,
  user_id           BIGINT NOT NULL,
  topic_id          BIGINT NOT NULL REFERENCES grammar_topics(id) ON DELETE CASCADE,
  exercises_done    INT DEFAULT 0,
  exercises_correct INT DEFAULT 0,
  mastery_percent   REAL DEFAULT 0,
  last_practiced_at TIMESTAMPTZ,
  UNIQUE(user_id, topic_id)
);

CREATE INDEX idx_gtp_user ON grammar_topic_progress (user_id);

-- 4. Seed A1 Grammar Topics (Goethe Standard)
INSERT INTO grammar_topics (cefr_level, topic_code, title_de, title_vi, title_en, description_vi, sort_order) VALUES
('A1', 'ARTIKEL',         'Artikel: Der, Die, Das',           'Mạo từ xác định & không xác định', 'Articles: Der, Die, Das',           'der/die/das, ein/eine/kein', 1),
('A1', 'NOMEN_PLURAL',    'Nomen im Plural',                  'Danh từ số nhiều',                  'Noun Plurals',                      'Quy tắc tạo số nhiều: -e, -en, -er, -s, Umlaut', 2),
('A1', 'KONJUGATION',     'Verben konjugieren (Präsens)',     'Chia động từ thì hiện tại',         'Verb Conjugation (Present)',         'Chia động từ có quy tắc và bất quy tắc', 3),
('A1', 'SEIN_HABEN',      'sein & haben',                     'Động từ sein & haben',              'sein & haben',                      'Hai động từ quan trọng nhất', 4),
('A1', 'SATZBAU',         'Satzbau (S-V-O)',                  'Cấu trúc câu V2',                  'Sentence Structure (S-V-O)',        'Động từ luôn ở vị trí số 2', 5),
('A1', 'W_FRAGEN',        'W-Fragen',                         'Câu hỏi W-Fragen',                 'W-Questions',                       'Wer, Was, Wo, Wann, Wie, Warum, Woher', 6),
('A1', 'NEGATION',        'Negation (nicht / kein)',           'Phủ định',                          'Negation (nicht / kein)',            'Phân biệt nicht và kein', 7),
('A1', 'AKKUSATIV',       'Der Akkusativ',                    'Cách Akkusativ',                    'The Accusative Case',               'den, einen, keinen — túc từ trực tiếp', 8),
('A1', 'POSSESSIV',       'Possessivartikel',                 'Tính từ sở hữu',                   'Possessive Articles',               'mein, dein, sein, ihr, unser', 9),
('A1', 'MODALVERBEN',     'Modalverben',                      'Động từ khiếm khuyết',              'Modal Verbs',                       'können, müssen, wollen, dürfen, sollen, möchten', 10),
('A1', 'TRENNBARE',       'Trennbare Verben',                 'Động từ tách',                      'Separable Verbs',                   'aufstehen, einkaufen, anrufen', 11),
('A1', 'PERFEKT',         'Perfekt',                          'Thì hoàn thành',                   'Perfect Tense',                     'haben/sein + Partizip II', 12),
('A1', 'PRAEPOSITIONEN',  'Präpositionen (Ort & Zeit)',       'Giới từ',                           'Prepositions (Place & Time)',        'in, auf, an, neben, vor, nach, um', 13),
('A1', 'IMPERATIV',       'Imperativ',                        'Câu mệnh lệnh',                    'Imperative',                        'Gib! Geh! Kommen Sie!', 14),
('A1', 'PERSONALPRONOMEN','Personalpronomen im Akkusativ',    'Đại từ nhân xưng (Akk)',            'Personal Pronouns (Accusative)',     'mich, dich, ihn, sie, es, uns, euch', 15);
