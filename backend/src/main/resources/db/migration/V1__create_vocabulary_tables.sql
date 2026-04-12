-- ============================================================
-- V1: MODULE VOCABULARY
-- ============================================================

CREATE TABLE words (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    dtype      VARCHAR(20) NOT NULL,
    base_form  VARCHAR(100) NOT NULL,
    cefr_level ENUM('A1','A2','B1','B2','C1','C2') NOT NULL DEFAULT 'A1',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    INDEX idx_words_base_form (base_form),
    INDEX idx_words_cefr (cefr_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE word_translations (
    id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    word_id BIGINT     NOT NULL,
    locale  VARCHAR(5) NOT NULL,
    meaning TEXT       NOT NULL,
    example TEXT,
    FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
    UNIQUE KEY uq_word_locale (word_id, locale)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tags (
    id    BIGINT AUTO_INCREMENT PRIMARY KEY,
    name  VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE word_tags (
    word_id BIGINT NOT NULL,
    tag_id  BIGINT NOT NULL,
    PRIMARY KEY (word_id, tag_id),
    FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE nouns (
    id            BIGINT PRIMARY KEY,
    gender        ENUM('DER','DIE','DAS') NOT NULL,
    plural_form   VARCHAR(100),
    genitive_form VARCHAR(100),
    noun_type     ENUM('STARK','SCHWACH','GEMISCHT') NOT NULL DEFAULT 'STARK',
    FOREIGN KEY (id) REFERENCES words(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE noun_declension_forms (
    id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    noun_id BIGINT NOT NULL,
    kasus   ENUM('NOMINATIV','AKKUSATIV','DATIV','GENITIV') NOT NULL,
    numerus ENUM('SINGULAR','PLURAL') NOT NULL,
    form    VARCHAR(100) NOT NULL,
    FOREIGN KEY (noun_id) REFERENCES nouns(id) ON DELETE CASCADE,
    UNIQUE KEY uq_noun_kasus_numerus (noun_id, kasus, numerus)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE verbs (
    id             BIGINT PRIMARY KEY,
    auxiliary_verb ENUM('HABEN','SEIN') NOT NULL DEFAULT 'HABEN',
    partizip2      VARCHAR(100) NOT NULL,
    is_separable   BOOLEAN NOT NULL DEFAULT FALSE,
    prefix         VARCHAR(20),
    is_irregular   BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (id) REFERENCES words(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE verb_conjugations (
    id       BIGINT AUTO_INCREMENT PRIMARY KEY,
    verb_id  BIGINT NOT NULL,
    tense    ENUM('PRASENS','PRATERITUM','PERFEKT','FUTUR1','KONJUNKTIV2','IMPERATIV') NOT NULL,
    pronoun  ENUM('ICH','DU','ER_SIE_ES','WIR','IHR','SIE_FORMAL') NOT NULL,
    form     VARCHAR(100) NOT NULL,
    FOREIGN KEY (verb_id) REFERENCES verbs(id) ON DELETE CASCADE,
    UNIQUE KEY uq_verb_tense_pronoun (verb_id, tense, pronoun)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE adjectives (
    id           BIGINT PRIMARY KEY,
    comparative  VARCHAR(100),
    superlative  VARCHAR(100),
    is_irregular BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (id) REFERENCES words(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE word_components (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    compound_id  BIGINT NOT NULL,
    component_id BIGINT NOT NULL,
    position     INT    NOT NULL,
    FOREIGN KEY (compound_id)  REFERENCES words(id) ON DELETE CASCADE,
    FOREIGN KEY (component_id) REFERENCES words(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
