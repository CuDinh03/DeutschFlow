-- Phase 2: Grammar articles and cases system for definite articles
-- This table maps gender + case to the correct definite article (der, die, das, den, etc.)

CREATE TABLE grammar_articles (
    id BIGSERIAL PRIMARY KEY,
    gender VARCHAR(10) NOT NULL,  -- 'm' (masculine), 'f' (feminine), 'n' (neuter)
    kasus VARCHAR(20) NOT NULL,   -- nominative, accusative, dative, genitive
    article VARCHAR(10) NOT NULL, -- der, die, das, den, dem, des, etc.
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_grammar_article UNIQUE (gender, kasus)
);

-- Seed German definite articles
DELETE FROM grammar_articles;

INSERT INTO grammar_articles (gender, kasus, article, created_at)
VALUES
-- Nominative (subject) - der, die, das
('m', 'nominative', 'der', NOW()),
('f', 'nominative', 'die', NOW()),
('n', 'nominative', 'das', NOW()),

-- Accusative (direct object) - den, die, das
('m', 'accusative', 'den', NOW()),
('f', 'accusative', 'die', NOW()),
('n', 'accusative', 'das', NOW()),

-- Dative (indirect object) - dem, der, dem
('m', 'dative', 'dem', NOW()),
('f', 'dative', 'der', NOW()),
('n', 'dative', 'dem', NOW()),

-- Genitive (possessive) - des, der, des
('m', 'genitive', 'des', NOW()),
('f', 'genitive', 'der', NOW()),
('n', 'genitive', 'des', NOW());

-- Create grammar_cases table for teaching declension patterns
CREATE TABLE grammar_cases (
    id BIGSERIAL PRIMARY KEY,
    case_name VARCHAR(20) NOT NULL UNIQUE,
    case_label VARCHAR(50) NOT NULL,     -- "Nominative (Subject)", "Accusative (Direct Object)", etc.
    english_description VARCHAR(255),    -- English explanation of the case
    german_description VARCHAR(255),     -- German explanation
    question_words VARCHAR(100),         -- "Wer? Was?" for nominative, "Wen? Was?" for accusative, etc.
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO grammar_cases (case_name, case_label, english_description, german_description, question_words)
VALUES
('nominative', 'Nominativ (Subject)', 'The subject of the sentence. Answers "Who? What?"', 'Das Subjekt des Satzes. Antwortet auf "Wer? Was?"', 'Wer? Was?'),
('accusative', 'Akkusativ (Direct Object)', 'The direct object of the sentence. Answers "Whom? What?"', 'Das direkte Objekt des Satzes. Antwortet auf "Wen? Was?"', 'Wen? Was?'),
('dative', 'Dativ (Indirect Object)', 'The indirect object. Answers "To whom? To what?"', 'Das indirekte Objekt. Antwortet auf "Wem? Wofür?"', 'Wem? Wo?'),
('genitive', 'Genitiv (Possessive)', 'Shows possession or belonging. Answers "Whose?"', 'Zeigt Besitz. Antwortet auf "Wessen?"', 'Wessen?');

-- Create grammar_case_examples table for learning context
CREATE TABLE grammar_case_examples (
    id BIGSERIAL PRIMARY KEY,
    case_id BIGINT NOT NULL,
    german_sentence VARCHAR(255) NOT NULL,
    english_translation VARCHAR(255) NOT NULL,
    word_in_focus VARCHAR(100) NOT NULL,
    case_role VARCHAR(50) NOT NULL,     -- "subject", "direct_object", "indirect_object", "possessive"
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES grammar_cases(id) ON DELETE CASCADE
);

INSERT INTO grammar_case_examples (case_id, german_sentence, english_translation, word_in_focus, case_role)
VALUES
-- Nominative examples
(1, 'Der Mann ist alt.', 'The man is old.', 'Der Mann', 'subject'),
(1, 'Die Frau liest ein Buch.', 'The woman reads a book.', 'Die Frau', 'subject'),
(1, 'Das Kind spielt.', 'The child plays.', 'Das Kind', 'subject'),

-- Accusative examples
(2, 'Ich sehe den Mann.', 'I see the man.', 'den Mann', 'direct_object'),
(2, 'Er liest die Zeitung.', 'He reads the newspaper.', 'die Zeitung', 'direct_object'),
(2, 'Sie kauft das Buch.', 'She buys the book.', 'das Buch', 'direct_object'),

-- Dative examples
(3, 'Ich gebe dem Mann ein Buch.', 'I give the man a book.', 'dem Mann', 'indirect_object'),
(3, 'Sie zeigt der Frau den Weg.', 'She shows the woman the way.', 'der Frau', 'indirect_object'),
(3, 'Das Kind hilft dem Mädchen.', 'The child helps the girl.', 'dem Mädchen', 'indirect_object'),

-- Genitive examples
(4, 'Das ist das Buch des Mannes.', 'That is the man''s book.', 'des Mannes', 'possessive'),
(4, 'Die Tasche der Frau ist groß.', 'The woman''s bag is big.', 'der Frau', 'possessive'),
(4, 'Das Zimmer des Kindes ist sauber.', 'The child''s room is clean.', 'des Kindes', 'possessive');

-- Create grammar_exercises table for case practice
CREATE TABLE grammar_case_exercises (
    id BIGSERIAL PRIMARY KEY,
    case_id BIGINT NOT NULL,
    difficulty_level INT NOT NULL DEFAULT 1,  -- 1=A1, 2=A2, 3=B1
    exercise_type VARCHAR(50) NOT NULL,       -- 'article_selection', 'noun_declension', 'sentence_fill', 'case_identification'
    question VARCHAR(255) NOT NULL,
    correct_answer VARCHAR(100) NOT NULL,
    explanation VARCHAR(255),
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES grammar_cases(id) ON DELETE CASCADE
);

-- Sample exercises for nominative case
INSERT INTO grammar_case_exercises (case_id, difficulty_level, exercise_type, question, correct_answer, explanation)
VALUES
(1, 1, 'article_selection', 'Welcher Artikel? ___ Mann ist alt.', 'Der', 'Nominative singular masculine: der'),
(1, 1, 'article_selection', 'Welcher Artikel? ___ Frau ist nett.', 'Die', 'Nominative singular feminine: die'),
(1, 1, 'article_selection', 'Welcher Artikel? ___ Kind ist jung.', 'Das', 'Nominative singular neuter: das'),

-- Sample exercises for accusative case
(2, 1, 'article_selection', 'Welcher Artikel? Ich sehe ___ Mann.', 'den', 'Accusative singular masculine: den'),
(2, 1, 'article_selection', 'Welcher Artikel? Sie liest ___ Buch.', 'das', 'Accusative singular neuter: das (same as nominative)'),
(2, 1, 'article_selection', 'Welcher Artikel? Er kauft ___ Tasche.', 'die', 'Accusative singular feminine: die (same as nominative)'),

-- Sample exercises for dative case
(3, 1, 'article_selection', 'Welcher Artikel? Ich gebe ___ Mann ein Buch.', 'dem', 'Dative singular masculine: dem'),
(3, 1, 'article_selection', 'Welcher Artikel? Sie hilft ___ Frau.', 'der', 'Dative singular feminine: der'),
(3, 1, 'article_selection', 'Welcher Artikel? Das Kind spielt mit ___ Hund.', 'dem', 'Dative singular neuter: dem'),

-- Sample exercises for genitive case
(4, 1, 'article_selection', 'Welcher Artikel? Das Buch ___ Mannes ist interessant.', 'des', 'Genitive singular masculine: des'),
(4, 1, 'article_selection', 'Welcher Artikel? Die Tasche ___ Frau ist groß.', 'der', 'Genitive singular feminine: der'),
(4, 1, 'article_selection', 'Welcher Artikel? Das Zimmer ___ Kindes ist sauber.', 'des', 'Genitive singular neuter: des');
