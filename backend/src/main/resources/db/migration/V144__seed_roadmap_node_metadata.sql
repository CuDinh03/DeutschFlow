-- V144: Seed roadmap node metadata for the A0→A1 foundation-first roadmap
-- Purpose: enrich existing skill_tree_nodes with node_code / node_family /
-- prerequisites / unlock metadata so the backend can drive the roadmap tree
-- without relying on plan-based routing.

WITH roadmap_seed AS (
    SELECT * FROM (VALUES
        ('D11', 'A1-001', 'CORE', 'CORE', 'a1.welcome', '[]'::jsonb, '{"next":["A1-002"],"reason":"Foundation opener for roadmap learning"}'::jsonb),
        ('D12', 'A1-002', 'CORE', 'CORE', 'a1.alphabet', '[]'::jsonb, '{"next":["A1-003"],"reason":"Alphabet and pronunciation basics"}'::jsonb),
        ('D13', 'A1-003', 'CORE', 'CORE', 'a1.phonetics', '["D12"]'::jsonb, '{"next":["A1-004"],"reason":"Sound awareness and blending"}'::jsonb),
        ('D14', 'A1-004', 'CORE', 'CORE', 'a1.numbers_0_20', '["D12","D13"]'::jsonb, '{"next":["A1-005"],"reason":"Survival numbers for daily communication"}'::jsonb),
        ('D15', 'A1-005', 'CORE', 'CORE', 'a1.greetings', '["D12","D13"]'::jsonb, '{"next":["A1-006"],"reason":"Greeting and self-introduction"}'::jsonb),
        ('D16', 'A1-006', 'CORE', 'CORE', 'a1.self_intro', '["D15"]'::jsonb, '{"next":["A1-007"],"reason":"Introductions and personal information"}'::jsonb),
        ('D17', 'A1-007', 'CORE', 'CORE', 'a1.time_date', '["D14","D15"]'::jsonb, '{"next":["A1-008"],"reason":"Time and date expressions"}'::jsonb),
        ('D18', 'A1-008', 'CORE', 'CORE', 'a1.family', '["D15","D16"]'::jsonb, '{"next":["A1-009"],"reason":"Family vocabulary for simple talking"}'::jsonb),
        ('D19', 'A1-009', 'CORE', 'CORE', 'a1.common_objects', '["D12","D18"]'::jsonb, '{"next":["A1-010"],"reason":"Everyday nouns and objects"}'::jsonb),
        ('D20', 'A1-010', 'CORE', 'CHECKPOINT', 'a1.common_places', '["D15","D16","D19"]'::jsonb, '{"next":["A1-011"],"reason":"Checkpoint before sentence building"}'::jsonb),
        ('D21', 'A1-011', 'CORE', 'CORE', 'a1.word_order', '["D20"]'::jsonb, '{"next":["A1-012"],"reason":"Basic word order and sentence structure"}'::jsonb),
        ('D22', 'A1-012', 'CORE', 'CORE', 'a1.sein', '["D21"]'::jsonb, '{"next":["A1-013"],"reason":"Core copula for identity and state"}'::jsonb),
        ('D23', 'A1-013', 'CORE', 'CORE', 'a1.haben', '["D21"]'::jsonb, '{"next":["A1-014"],"reason":"Core possession verb"}'::jsonb),
        ('D24', 'A1-014', 'CORE', 'PRACTICE', 'a1.yes_no_questions', '["D12","D21","D22"]'::jsonb, '{"next":["A1-015"],"reason":"Question formation practice"}'::jsonb),
        ('D25', 'A1-015', 'CORE', 'PRACTICE', 'a1.w_questions', '["D24"]'::jsonb, '{"next":["A1-016"],"reason":"W-question practice"}'::jsonb),
        ('D26', 'A1-016', 'CORE', 'CHECKPOINT', 'a1.negation', '["D22","D23","D24","D25"]'::jsonb, '{"next":["A1-017"],"reason":"Negation checkpoint before grammar layer"}'::jsonb),
        ('D27', 'A1-017', 'CORE', 'CORE', 'a1.nominativ', '["D16","D26"]'::jsonb, '{"next":["A1-018"],"reason":"Subject case foundation"}'::jsonb),
        ('D28', 'A1-018', 'CORE', 'CORE', 'a1.akkusativ', '["D27"]'::jsonb, '{"next":["A1-019"],"reason":"Direct object case foundation"}'::jsonb),
        ('D29', 'A1-019', 'CORE', 'CORE', 'a1.personal_pronouns', '["D27"]'::jsonb, '{"next":["A1-020"],"reason":"Pronouns for natural sentence building"}'::jsonb),
        ('D30', 'A1-020', 'CORE', 'PRACTICE', 'a1.present_conjugation', '["D27","D29"]'::jsonb, '{"next":["A1-021"],"reason":"Verb conjugation practice"}'::jsonb)
    ) AS t(day_code, node_code, node_family, node_type_family, content_key, prerequisites_json, unlock_metadata)
)
UPDATE skill_tree_nodes n
SET
    node_code = COALESCE(n.node_code, s.node_code),
    node_family = COALESCE(n.node_family, s.node_family),
    content_key = COALESCE(n.content_key, s.content_key),
    prerequisites_json = COALESCE(NULLIF(n.prerequisites_json, '[]'::jsonb), s.prerequisites_json),
    unlock_metadata = COALESCE(NULLIF(n.unlock_metadata, '{}'::jsonb), s.unlock_metadata),
    mastery_threshold = CASE
        WHEN n.mastery_threshold = 70 AND n.day_number IS NOT NULL AND n.day_number >= 20 THEN 80
        WHEN n.mastery_threshold = 70 AND n.day_number IS NOT NULL AND n.day_number >= 10 THEN 75
        ELSE n.mastery_threshold
    END
FROM roadmap_seed s
WHERE CONCAT('D', LPAD(n.day_number::text, 2, '0')) = s.day_code;

-- Ensure the early A1 roadmap nodes have stable family labels even if older seed data differs.
-- Keep values within the validated chk_skill_tree_node_family domain.
UPDATE skill_tree_nodes
SET node_family = CASE
    WHEN day_number BETWEEN 11 AND 20 THEN 'CORE'
    WHEN day_number BETWEEN 21 AND 26 THEN 'CORE'
    WHEN day_number BETWEEN 27 AND 30 THEN 'CHECKPOINT'
    ELSE COALESCE(node_family, 'CORE')
END
WHERE day_number BETWEEN 11 AND 30;
