CREATE TABLE IF NOT EXISTS word_coverage_daily  (
    snapshot_date DATE PRIMARY KEY,
    total_words BIGINT NOT NULL,
    noun_words BIGINT NOT NULL,
    noun_rows BIGINT NOT NULL,
    noun_with_gender BIGINT NOT NULL,
    noun_der BIGINT NOT NULL,
    noun_die BIGINT NOT NULL,
    noun_das BIGINT NOT NULL,
    noun_coverage_percent DECIMAL(6,2) NOT NULL,
    verb_words BIGINT NOT NULL,
    verb_rows BIGINT NOT NULL,
    verb_coverage_percent DECIMAL(6,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
