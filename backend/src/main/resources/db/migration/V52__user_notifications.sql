-- In-app notification inbox (per recipient). Materialized from domain events after commit.

CREATE TABLE user_notifications (
    id BIGSERIAL PRIMARY KEY,
    recipient_user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    notification_type VARCHAR(64) NOT NULL,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_notifications_type_chk CHECK (char_length(trim(notification_type)) > 0)
);

CREATE INDEX idx_user_notifications_recipient_created
    ON user_notifications (recipient_user_id, created_at DESC);

CREATE INDEX idx_user_notifications_recipient_unread
    ON user_notifications (recipient_user_id)
    WHERE read_at IS NULL;
