-- V228 — direct 1-1 messaging between a student and a teacher who share a class.
-- Authz (who-may-message-whom) is enforced in the service via shared teacher↔student class
-- membership; the table itself just stores the thread. No conversation table — a conversation
-- is the (sender,recipient) pair, derived at read time.
--
-- Rollback (manual — Flyway CE has no undo):
--   DROP TABLE IF EXISTS messages;

CREATE TABLE messages (
  id            BIGSERIAL PRIMARY KEY,
  sender_id     BIGINT    NOT NULL REFERENCES users(id),
  recipient_id  BIGINT    NOT NULL REFERENCES users(id),
  body          TEXT      NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT now(),
  read_at       TIMESTAMP
);

-- Thread between two users in id order (history); recipient lookup for conversation list + unread.
CREATE INDEX idx_messages_pair      ON messages (sender_id, recipient_id, id);
CREATE INDEX idx_messages_recipient ON messages (recipient_id, id);
