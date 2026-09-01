-- Curriculum import: idempotency ledger for the commit step.
--
-- The commit writes a whole curriculum (16 modules / 40 lessons for a Netzwerk A1 import) in one
-- transaction. A client that times out mid-write and retries must not produce a second copy, so the
-- wizard generates one key per commit attempt and replays it on every retry. The UNIQUE constraint
-- is what makes that safe under concurrency: a racing duplicate loses on insert instead of both
-- transactions writing a curriculum each.
--
-- The stored result lets a replay answer with the ORIGINAL counts, so a retry looks identical to
-- the first call from the client's point of view.
CREATE TABLE curriculum_import_commit (
    id                BIGSERIAL PRIMARY KEY,
    class_id          BIGINT      NOT NULL REFERENCES teacher_classes (id) ON DELETE CASCADE,
    teacher_id        BIGINT      NOT NULL REFERENCES users (id),
    idempotency_key   VARCHAR(120) NOT NULL,
    source_material_id BIGINT     REFERENCES materials (id) ON DELETE SET NULL,
    modules_created   INT         NOT NULL,
    lessons_created   INT         NOT NULL,
    result_payload    TEXT        NOT NULL,
    created_at        TIMESTAMP   NOT NULL DEFAULT now()
);

-- Scoped to the class, not global: two teachers' unrelated imports may legitimately carry the same
-- client-generated key, and a key only ever needs to be unique within the curriculum it writes.
CREATE UNIQUE INDEX ux_curriculum_import_commit_class_key
    ON curriculum_import_commit (class_id, idempotency_key);

CREATE INDEX ix_curriculum_import_commit_class ON curriculum_import_commit (class_id);
