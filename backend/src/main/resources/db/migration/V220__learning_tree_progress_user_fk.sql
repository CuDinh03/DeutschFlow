-- V220 — add the missing user_id foreign keys on the learning-tree progress tables (QA follow-up, PR #123).
--
-- WHY
--   V219 created tree_node_progress / tree_milestone_progress with `user_id BIGINT NOT NULL` but no
--   FK to users(id). node_id already cascades on tree_nodes deletion, but a hard-deleted USER would
--   leave orphan progress rows that accumulate silently — inconsistent with the rest of the schema.
--
-- SAFETY
--   The tree feature is new and flag-gated, so these tables carry no production rows yet (orphan
--   count validated 0 before authoring). ON DELETE CASCADE matches node_id's behaviour: removing a
--   user removes their tree progress.

ALTER TABLE tree_node_progress
    ADD CONSTRAINT fk_tree_node_progress_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE tree_milestone_progress
    ADD CONSTRAINT fk_tree_milestone_progress_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
