CREATE TABLE IF NOT EXISTS word_translation_coverage_daily  (
  snapshot_date DATE NOT NULL PRIMARY KEY,
  total_words BIGINT NOT NULL,
  words_with_de BIGINT NOT NULL,
  words_with_vi BIGINT NOT NULL,
  words_with_en BIGINT NOT NULL,
  words_with_all_locales BIGINT NOT NULL,
  de_coverage_percent DECIMAL(5,2) NOT NULL,
  vi_coverage_percent DECIMAL(5,2) NOT NULL,
  en_coverage_percent DECIMAL(5,2) NOT NULL,
  all_locales_coverage_percent DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
