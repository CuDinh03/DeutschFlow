-- V285: Server-side autosave draft for mock exam attempts (audit 2026-08-28, C-02).
-- Until now in-progress answers lived only in the browser and were first persisted at /finish,
-- so closing the browser, switching devices or losing storage lost the whole attempt. The
-- attempt row gains a live draft slot + optimistic-lock version so the server is the source
-- of truth while the exam is running.
--
-- Legacy note: answers_json (V118) holds submissions written by pre-V172 /finish and stays
-- untouched — draft_* is a separate live-draft slot, not a submission.
ALTER TABLE mock_exam_attempts
  ADD COLUMN IF NOT EXISTS draft_json           JSONB,
  ADD COLUMN IF NOT EXISTS draft_section_index  INT,
  ADD COLUMN IF NOT EXISTS draft_question_index INT,
  ADD COLUMN IF NOT EXISTS draft_version        BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS draft_saved_at       TIMESTAMPTZ;
