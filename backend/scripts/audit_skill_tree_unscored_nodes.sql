-- Audit: skill-tree nodes with 0 server-gradeable exercises (MULTIPLE_CHOICE / FILL_BLANK).
--
-- Purpose: after the P1 spine fix, a node completes either by (a) scoring >= mastery_threshold on
-- its gradeable exercises, or (b) the learner tapping "Đánh dấu đã học" on a theory-only node.
-- This report lists every active node that has NO gradeable exercise, so the PO can decide which
-- ones are intentionally theory-only (fine) vs. which should get MC/FILL_BLANK content added.
--
-- Read-only. Does NOT modify content. Run against the app DB, e.g.:
--   psql "$DATABASE_URL" -f backend/scripts/audit_skill_tree_unscored_nodes.sql
--
-- Buckets (see `bucket` column):
--   THEORY_ONLY   — 0 exercises at all (e.g. the alphabet lesson); completes via "mark as learned".
--   SELF_CHECK    — has exercises but only TRANSLATE/REORDER (self-checked, not graded).
--   AI_GRADED     — SPEAKING/WRITING nodes (graded by AI, not by MC/FILL_BLANK) — expected here.

WITH node_ex AS (
    SELECT
        n.id,
        n.title_vi,
        n.cefr_level,
        n.session_type,
        n.mastery_threshold,
        COALESCE(n.content_json -> 'exercises' -> 'theory_gate', '[]'::jsonb)
            || COALESCE(n.content_json -> 'exercises' -> 'practice', '[]'::jsonb) AS all_exercises,
        jsonb_array_length(COALESCE(n.content_json -> 'theory_cards', '[]'::jsonb)) AS theory_cards
    FROM skill_tree_nodes n
    WHERE n.is_active = TRUE
      AND n.content_json IS NOT NULL
),
counted AS (
    SELECT
        ne.*,
        jsonb_array_length(ne.all_exercises) AS total_exercises,
        (
            SELECT count(*)
            FROM jsonb_array_elements(ne.all_exercises) e
            WHERE e ->> 'type' IN ('MULTIPLE_CHOICE', 'FILL_BLANK')
        ) AS scored_count
    FROM node_ex ne
)
SELECT
    id,
    title_vi,
    cefr_level,
    session_type,
    mastery_threshold,
    theory_cards,
    total_exercises,
    scored_count,
    CASE
        WHEN session_type IN ('SPEAKING', 'WRITING') THEN 'AI_GRADED'
        WHEN total_exercises = 0                     THEN 'THEORY_ONLY'
        ELSE                                              'SELF_CHECK'
    END AS bucket
FROM counted
WHERE scored_count = 0
ORDER BY bucket, cefr_level, id;
