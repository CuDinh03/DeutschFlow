-- ============================================================
-- V2: MODULE GRAMMAR
-- ============================================================

CREATE TABLE declination_rules (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    kasus        ENUM('NOMINATIV','AKKUSATIV','DATIV','GENITIV') NOT NULL,
    gender       ENUM('DER','DIE','DAS','PLURAL')                NOT NULL,
    article_type ENUM('DEFINITE','INDEFINITE','NONE')            NOT NULL,
    article      VARCHAR(20) NOT NULL,
    adj_ending   VARCHAR(10) NOT NULL,
    UNIQUE KEY uq_rule (kasus, gender, article_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sentence_patterns (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    pattern_type ENUM('HAUPTSATZ','NEBENSATZ','FRAGESATZ_W','FRAGESATZ_JA_NEIN') NOT NULL,
    connector    VARCHAR(20),
    slot_order   JSON    NOT NULL,
    verb_kick    BOOLEAN NOT NULL DEFAULT FALSE,
    v2_rule      BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
