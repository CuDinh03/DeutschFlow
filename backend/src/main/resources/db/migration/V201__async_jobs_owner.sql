-- Add owner tracking to async_jobs (SEC-6: IDOR guard on SSE/download endpoints)
ALTER TABLE async_jobs ADD COLUMN IF NOT EXISTS created_by_user_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_async_jobs_user ON async_jobs(created_by_user_id);
