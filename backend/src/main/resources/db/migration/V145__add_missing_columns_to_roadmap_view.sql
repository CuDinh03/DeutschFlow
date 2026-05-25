-- V145: Add missing columns to roadmap view
-- Purpose: recreate v_skill_tree_roadmap_nodes to include prerequisites_json and unlock_metadata

CREATE OR REPLACE VIEW v_skill_tree_roadmap_nodes AS
SELECT
    n.id,
    n.node_code,
    n.node_family,
    n.node_type,
    n.title_de,
    n.title_vi,
    n.description_vi,
    n.emoji,
    n.phase,
    n.cefr_level,
    n.day_number,
    n.week_number,
    n.sort_order,
    n.mastery_threshold,
    n.unlock_rule,
    n.estimated_minutes,
    n.xp_reward,
    n.energy_cost,
    n.content_key,
    n.tags,
    n.content_json,
    n.is_active,
    n.created_at,
    n.updated_at,
    n.prerequisites_json,
    n.unlock_metadata
FROM skill_tree_nodes n;
