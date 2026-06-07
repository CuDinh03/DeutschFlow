-- ============================================================
-- V195: Fill the index gaps identified by the deep performance audit
-- Targets: notification dedup, streak-by-date, dependency join, node-reverse,
--          and the duplicate words(cefr_level) cleanup.
-- All statements are idempotent (IF NOT EXISTS / table guards) so re-running
-- on an environment that already has any of these is a no-op.
-- ============================================================

-- user_notifications: DailyNotificationJob's "did we already send this type today?"
-- and the inbox-by-category view filter by (recipient, notification_type, created_at).
-- Existing indexes are (recipient, read_at, created_at) and (recipient, created_at) —
-- neither covers the notification_type filter.
CREATE INDEX IF NOT EXISTS idx_un_recipient_type_created
    ON user_notifications (recipient_user_id, notification_type, created_at DESC);

-- user_xp_events: computeStreakDays groups by DATE(created_at) per user. The existing
-- (user_id, created_at DESC) covers the user filter but Postgres still extracts the
-- date from every row. An expression index on the date lets it be used directly.
CREATE INDEX IF NOT EXISTS idx_uxe_user_date
    ON user_xp_events (user_id, (created_at::date));

-- skill_tree_node_dependencies: checkDependenciesMet joins on
-- (d.node_id = ?) AND (dp.node_id = d.depends_on_node_id AND dp.user_id = ?).
-- The existing single-column index on node_id forces a heap lookup for depends_on_node_id;
-- a composite makes the dependency walk an index-only scan.
CREATE INDEX IF NOT EXISTS idx_stnd_node_dep
    ON skill_tree_node_dependencies (node_id, depends_on_node_id);

-- skill_tree_user_progress: the same join needs the reverse direction —
-- "is this node already COMPLETED by this user?" — and the existing (user_id, ...)
-- indexes don't lead with node_id.
CREATE INDEX IF NOT EXISTS idx_stup_node_user
    ON skill_tree_user_progress (node_id, user_id);

-- words(cefr_level): V1 created idx_words_cefr; V151 added idx_words_cefr_level on the
-- same column. Drop the older duplicate (keep the descriptive name).
DROP INDEX IF EXISTS idx_words_cefr;

-- review_queue: prior audit recommended (user_id, next_review_at), but verification shows
-- there is NO review_queue table in any migration. DailyNotificationJob.java queries
-- `SELECT ... FROM review_queue WHERE ...` — that throws at runtime today. This is a
-- bug in the job, not a missing index; tracked separately. No DDL emitted here.

-- vocab_review_schedule(user_id, algorithm_version): covered by an existing composite
-- (user_id, algorithm_version, next_review_at) added when FSRS landed — no new index needed.
