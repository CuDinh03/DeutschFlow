-- Add FSRS parameters to learning_review_items table
-- FSRS State: 0 (New), 1 (Learning), 2 (Review), 3 (Relearning)

ALTER TABLE learning_review_items
    ADD COLUMN state INT NOT NULL DEFAULT 0,
    ADD COLUMN difficulty NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
    ADD COLUMN stability NUMERIC(8, 4) NOT NULL DEFAULT 0.0,
    ADD COLUMN lapses INT NOT NULL DEFAULT 0,
    ADD COLUMN last_reviewed_state INT NULL;

-- Migrate existing SM-2 data to FSRS
-- 1. If an item has been reviewed (repetitions > 0), mark it as Review (2)
-- 2. Give it a default FSRS difficulty of 5.0 (medium)
-- 3. Use the existing SM-2 interval as the initial stability for FSRS
UPDATE learning_review_items
SET state = 2,
    difficulty = 5.0,
    stability = interval_days
WHERE repetitions > 0;
