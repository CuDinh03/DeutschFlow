-- ============================================================
-- V66: Curriculum V2 — Schema upgrades for unified Roadmap+Sessions
-- ============================================================

-- ── New columns ──
ALTER TABLE skill_tree_nodes ADD COLUMN IF NOT EXISTS module_number INTEGER;
ALTER TABLE skill_tree_nodes ADD COLUMN IF NOT EXISTS module_title_vi VARCHAR(200);
ALTER TABLE skill_tree_nodes ADD COLUMN IF NOT EXISTS module_title_de VARCHAR(200);
ALTER TABLE skill_tree_nodes ADD COLUMN IF NOT EXISTS session_type VARCHAR(20) DEFAULT 'LESSON';
ALTER TABLE skill_tree_nodes ADD COLUMN IF NOT EXISTS satellite_status VARCHAR(20);
ALTER TABLE skill_tree_nodes ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE skill_tree_nodes ADD COLUMN IF NOT EXISTS creator_user_id BIGINT;
ALTER TABLE skill_tree_nodes ADD COLUMN IF NOT EXISTS generating_started_at TIMESTAMPTZ;

-- ── PostgreSQL Power-ups: GIN indexes ──
CREATE INDEX IF NOT EXISTS idx_stn_tags_gin ON skill_tree_nodes USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_stn_satellite_status ON skill_tree_nodes (satellite_status) WHERE satellite_status IS NOT NULL;

-- ── Clear old V61/V62 seed data ──
DELETE FROM skill_tree_user_progress;
DELETE FROM skill_tree_node_dependencies;
DELETE FROM skill_tree_nodes;
