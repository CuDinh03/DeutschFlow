-- ============================================================
-- V1: MODULE VOCABULARY
-- ============================================================

CREATE TABLE words  (
    id         BIGSERIAL PRIMARY KEY,
    dtype      VARCHAR(20) NOT NULL,
    base_form  VARCHAR(100) NOT NULL,
    cefr_level VARCHAR(64) NOT NULL DEFAULT 'A1',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_words_base_form ON words (base_form);
CREATE INDEX IF NOT EXISTS idx_words_cefr ON words (cefr_level);


CREATE TABLE word_translations  (
    id      BIGSERIAL PRIMARY KEY,
    word_id BIGINT     NOT NULL,
    locale  VARCHAR(5) NOT NULL,
    meaning TEXT       NOT NULL,
    example TEXT,
    FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
    CONSTRAINT uq_word_locale UNIQUE (word_id, locale)
);


CREATE TABLE tags  (
    id    BIGSERIAL PRIMARY KEY,
    name  VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7)
);


CREATE TABLE word_tags  (
    word_id BIGINT NOT NULL,
    tag_id  BIGINT NOT NULL,
    PRIMARY KEY (word_id, tag_id),
    FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
);


CREATE TABLE nouns  (
    id            BIGINT PRIMARY KEY,
    gender        VARCHAR(64) NOT NULL,
    plural_form   VARCHAR(100),
    genitive_form VARCHAR(100),
    noun_type     VARCHAR(64) NOT NULL DEFAULT 'STARK',
    FOREIGN KEY (id) REFERENCES words(id) ON DELETE CASCADE
);


CREATE TABLE noun_declension_forms  (
    id      BIGSERIAL PRIMARY KEY,
    noun_id BIGINT NOT NULL,
    kasus   VARCHAR(64) NOT NULL,
    numerus VARCHAR(64) NOT NULL,
    form    VARCHAR(100) NOT NULL,
    FOREIGN KEY (noun_id) REFERENCES nouns(id) ON DELETE CASCADE,
    CONSTRAINT uq_noun_kasus_numerus UNIQUE (noun_id, kasus, numerus)
);


CREATE TABLE verbs  (
    id             BIGINT PRIMARY KEY,
    auxiliary_verb VARCHAR(64) NOT NULL DEFAULT 'HABEN',
    partizip2      VARCHAR(100) NOT NULL,
    is_separable   BOOLEAN NOT NULL DEFAULT FALSE,
    prefix         VARCHAR(20),
    is_irregular   BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (id) REFERENCES words(id) ON DELETE CASCADE
);


CREATE TABLE verb_conjugations  (
    id       BIGSERIAL PRIMARY KEY,
    verb_id  BIGINT NOT NULL,
    tense    VARCHAR(64) NOT NULL,
    pronoun  VARCHAR(64) NOT NULL,
    form     VARCHAR(100) NOT NULL,
    FOREIGN KEY (verb_id) REFERENCES verbs(id) ON DELETE CASCADE,
    CONSTRAINT uq_verb_tense_pronoun UNIQUE (verb_id, tense, pronoun)
);


CREATE TABLE adjectives  (
    id           BIGINT PRIMARY KEY,
    comparative  VARCHAR(100),
    superlative  VARCHAR(100),
    is_irregular BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (id) REFERENCES words(id) ON DELETE CASCADE
);


CREATE TABLE word_components  (
    id           BIGSERIAL PRIMARY KEY,
    compound_id  BIGINT NOT NULL,
    component_id BIGINT NOT NULL,
    position     INT    NOT NULL,
    FOREIGN KEY (compound_id)  REFERENCES words(id) ON DELETE CASCADE,
    FOREIGN KEY (component_id) REFERENCES words(id) ON DELETE RESTRICT
);
