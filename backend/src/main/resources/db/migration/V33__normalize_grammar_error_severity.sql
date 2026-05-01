-- Normalize severity to BLOCKING | MAJOR | MINOR (PostgreSQL)
UPDATE user_grammar_errors
SET severity = 'BLOCKING'
WHERE LOWER(TRIM(severity)) IN ('high', 'critical', 'blocking');

UPDATE user_grammar_errors
SET severity = 'MAJOR'
WHERE LOWER(TRIM(severity)) IN ('medium', 'major');

UPDATE user_grammar_errors
SET severity = 'MINOR'
WHERE LOWER(TRIM(severity)) IN ('low', 'minor');

UPDATE user_grammar_errors
SET severity = 'MINOR'
WHERE severity NOT IN ('BLOCKING', 'MAJOR', 'MINOR');

ALTER TABLE user_grammar_errors
  ALTER COLUMN severity TYPE VARCHAR(16) USING severity::varchar,
  ALTER COLUMN severity SET NOT NULL,
  ALTER COLUMN severity SET DEFAULT 'MINOR';
