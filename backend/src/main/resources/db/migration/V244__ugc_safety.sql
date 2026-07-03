-- V244: Apple Guideline 1.2 (UGC safety) — user blocks + content reports.
--
-- DeutschFlow has two user↔user surfaces: direct messages (messages, V228) and class-channel
-- messages (class_channel_messages, V241). To ship those on the App Store, Apple requires a way to
-- BLOCK abusive users and REPORT objectionable content. These two tables back both. A server-side
-- word filter (WordFilterService) rejects the most severe content at send time; teachers already
-- soft-delete class messages (V241 deleted_by), and admins triage the reports below.

-- ── user_blocks: blocker no longer receives / can be messaged by the blocked user ────────────────
CREATE TABLE user_blocks (
    id          BIGSERIAL PRIMARY KEY,
    blocker_id  BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id  BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_blocks       UNIQUE (blocker_id, blocked_id),
    CONSTRAINT chk_user_blocks_self CHECK (blocker_id <> blocked_id)
);
CREATE INDEX idx_user_blocks_blocker ON user_blocks (blocker_id);
CREATE INDEX idx_user_blocks_blocked ON user_blocks (blocked_id);

-- ── content_reports: user-filed reports of a message or a user, triaged by admins ────────────────
-- message_id / class_message_id are intentionally NOT foreign keys: a reported message may later be
-- (soft- or hard-) deleted, but the report — with its snapshot_body — must survive for moderation.
CREATE TABLE content_reports (
    id                BIGSERIAL PRIMARY KEY,
    reporter_id       BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_user_id  BIGINT               REFERENCES users(id) ON DELETE SET NULL,
    context           VARCHAR(24)  NOT NULL,   -- DIRECT_MESSAGE | CLASS_MESSAGE | USER
    message_id        BIGINT,                  -- messages.id            (when context = DIRECT_MESSAGE)
    class_message_id  BIGINT,                  -- class_channel_messages.id (when context = CLASS_MESSAGE)
    reason            VARCHAR(32)  NOT NULL,   -- HARASSMENT | SEXUAL | HATE | SPAM | OTHER
    details           VARCHAR(1000),
    snapshot_body     VARCHAR(8000),           -- copy of the reported text, retained if the message is deleted
    status            VARCHAR(16)  NOT NULL DEFAULT 'PENDING',  -- PENDING | RESOLVED | DISMISSED
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    resolved_at       TIMESTAMPTZ,
    resolved_by       BIGINT               REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_content_reports_status   ON content_reports (status, created_at DESC);
CREATE INDEX idx_content_reports_reporter ON content_reports (reporter_id);
