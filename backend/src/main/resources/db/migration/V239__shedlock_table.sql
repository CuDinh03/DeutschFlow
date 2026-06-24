-- S-7: ShedLock distributed-lock table.
-- Every @Scheduled job annotated with @SchedulerLock acquires a row here so it runs on exactly
-- one node at a time — prevents double-send / double-charge / double-cleanup when more than one app
-- instance runs (multi-node, or the blue-green window where two colors overlap).
-- Standard ShedLock JdbcTemplateLockProvider schema (TIMESTAMP columns; provider uses DB time).
CREATE TABLE IF NOT EXISTS shedlock (
    name       VARCHAR(64)  NOT NULL,
    lock_until TIMESTAMP    NOT NULL,
    locked_at  TIMESTAMP    NOT NULL,
    locked_by  VARCHAR(255) NOT NULL,
    PRIMARY KEY (name)
);
