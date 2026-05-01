-- Normalize severity to BLOCKING | MAJOR | MINOR (aligned with structured errors[] contract)
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
    MODIFY COLUMN severity VARCHAR(16) NOT NULL DEFAULT 'MINOR';
