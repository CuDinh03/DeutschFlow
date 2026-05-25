-- ============================================================
-- V2: MODULE GRAMMAR
-- ============================================================

CREATE TABLE declination_rules  (
    id           BIGSERIAL PRIMARY KEY,
    kasus        VARCHAR(64) NOT NULL,
    gender       VARCHAR(64)                NOT NULL,
    article_type VARCHAR(64)            NOT NULL,
    article      VARCHAR(20) NOT NULL,
    adj_ending   VARCHAR(10) NOT NULL,
    CONSTRAINT uq_rule UNIQUE (kasus, gender, article_type)
);


CREATE TABLE sentence_patterns  (
    id           BIGSERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    pattern_type VARCHAR(64) NOT NULL,
    connector    VARCHAR(20),
    slot_order   JSONB    NOT NULL,
    verb_kick    BOOLEAN NOT NULL DEFAULT FALSE,
    v2_rule      BOOLEAN NOT NULL DEFAULT TRUE
);
