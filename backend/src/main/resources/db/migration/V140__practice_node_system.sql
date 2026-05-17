-- ============================================================
-- V140: Practice Node System — 4 kỹ năng (Hören/Sprechen/Lesen/Schreiben)
-- Sinh đồng thời 4 node bài tập sau khi hoàn thành Theory Node
-- Bài tập AI-generated, không lặp câu hỏi, tăng dần level
-- ============================================================

-- 1. Bảng Practice Session — mỗi session = 1 kỹ năng x 1 generation
CREATE TABLE IF NOT EXISTS practice_node_sessions (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_node_id  BIGINT      NOT NULL REFERENCES skill_tree_nodes(id),

    -- Kỹ năng: HOEREN, SPRECHEN, LESEN, SCHREIBEN
    skill_type      VARCHAR(15) NOT NULL
                    CHECK (skill_type IN ('HOEREN', 'SPRECHEN', 'LESEN', 'SCHREIBEN')),

    -- Thế hệ bài tập (1 = lần đầu, 2+ = không trùng, tăng dần level)
    generation      INTEGER     NOT NULL DEFAULT 1,

    -- JSON bài tập AI sinh (6 câu)
    exercises_json  JSONB       NOT NULL,

    -- Hash từng câu hỏi để chống lặp
    question_hashes TEXT[]      NOT NULL DEFAULT '{}',

    -- Trạng thái
    status          VARCHAR(15) NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE', 'COMPLETED', 'ABANDONED')),
    score_percent   INTEGER     DEFAULT NULL,
    xp_earned       INTEGER     DEFAULT 0,

    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pns_user_node_skill
    ON practice_node_sessions (user_id, source_node_id, skill_type);
CREATE INDEX idx_pns_active
    ON practice_node_sessions (user_id, status) WHERE status = 'ACTIVE';

-- 2. Log câu hỏi đã thấy — chống lặp THEO KỸ NĂNG
CREATE TABLE IF NOT EXISTS user_seen_exercise_hashes (
    user_id         BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_node_id  BIGINT      NOT NULL,
    skill_type      VARCHAR(15) NOT NULL,
    question_hash   VARCHAR(64) NOT NULL,
    seen_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, source_node_id, skill_type, question_hash)
);

-- 3. Thêm cột Netzwerk Neu mapping vào skill_tree_nodes
ALTER TABLE skill_tree_nodes
    ADD COLUMN IF NOT EXISTS netzwerk_neu_unit VARCHAR(10);

-- 4. Cập nhật mapping A1: Node → Netzwerk Neu Unit
UPDATE skill_tree_nodes SET netzwerk_neu_unit = 'L01' WHERE day_number BETWEEN 11 AND 14 AND cefr_level = 'A1';
UPDATE skill_tree_nodes SET netzwerk_neu_unit = 'L02' WHERE day_number BETWEEN 15 AND 17 AND cefr_level = 'A1';
UPDATE skill_tree_nodes SET netzwerk_neu_unit = 'L04' WHERE day_number BETWEEN 18 AND 21 AND cefr_level = 'A1';
UPDATE skill_tree_nodes SET netzwerk_neu_unit = 'L09' WHERE day_number BETWEEN 22 AND 24 AND cefr_level = 'A1';
UPDATE skill_tree_nodes SET netzwerk_neu_unit = 'L05' WHERE day_number BETWEEN 25 AND 28 AND cefr_level = 'A1';
UPDATE skill_tree_nodes SET netzwerk_neu_unit = 'L03' WHERE day_number BETWEEN 29 AND 31 AND cefr_level = 'A1';
UPDATE skill_tree_nodes SET netzwerk_neu_unit = 'L08' WHERE day_number BETWEEN 32 AND 34 AND cefr_level = 'A1';

-- 5. Thống nhất phase naming
UPDATE skill_tree_nodes SET phase = 'CORE_A1'
WHERE phase IN ('GRUNDLAGEN', 'GRAMMATIK', 'SATZSTRUKTUR', 'MODALVERBEN', 'AKKUSATIV', 'TRENNBARE_VERBEN')
  AND cefr_level = 'A1';
