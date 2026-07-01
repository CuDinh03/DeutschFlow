-- V241 — class group chat channel (P6). One channel per class; every class member
-- (enrolled students + the class's teachers) may post and read all messages.
--
-- Deletion is SOFT: deleted_at/deleted_by are set but the row + original body are RETAINED,
-- so a moderated message keeps an audit trail the teacher can review. Members see deleted
-- messages as a "[đã xoá]" placeholder; the body stays in the table for oversight.
--
-- Authz (class membership + who-may-delete) is enforced in the service.
--
-- Rollback (manual — Flyway CE has no undo):
--   DROP TABLE IF EXISTS class_channel_messages;

CREATE TABLE class_channel_messages (
  id          BIGSERIAL PRIMARY KEY,
  class_id    BIGINT    NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
  sender_id   BIGINT    NOT NULL REFERENCES users(id),
  body        TEXT      NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMP,
  deleted_by  BIGINT    REFERENCES users(id)
);

-- Channel history read (ordered) + per-class scoping.
CREATE INDEX idx_class_channel_class ON class_channel_messages (class_id, id);
