-- V72: Fix training_error_samples NOT NULL constraint
-- Groq AI sometimes returns NULL for wrongSpan/correctedSpan when it detects
-- an error but cannot pinpoint the exact span. Allow NULLs to avoid
-- DataIntegrityViolationException during concurrent load.

ALTER TABLE training_error_samples ALTER COLUMN error_original DROP NOT NULL;
ALTER TABLE training_error_samples ALTER COLUMN error_corrected DROP NOT NULL;
