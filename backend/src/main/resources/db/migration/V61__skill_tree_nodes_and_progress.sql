-- ============================================================
-- V61: Skill Tree — DAG Node + Dependency + User Progress
-- Architecture: Cây Kỹ Năng theo mô hình Trụ cột (CORE_TRUNK)
-- và Nhánh phụ (SATELLITE_LEAF) cho hệ thống DeutschFlow.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. SKILL TREE NODES — Bảng lưu trữ các Node trong Cây Kỹ Năng
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skill_tree_nodes (
    id              BIGSERIAL PRIMARY KEY,

    -- ── Phân loại node ──
    -- CORE_TRUNK: Trụ cột ngữ pháp lõi bắt buộc (tiêu hao Năng lượng)
    -- SATELLITE_LEAF: Nhánh phụ cá nhân hóa (mở bằng Vé chuyên ngành)
    node_type       VARCHAR(20)     NOT NULL CHECK (node_type IN ('CORE_TRUNK', 'SATELLITE_LEAF')),

    -- ── Metadata hiển thị ──
    title_de        VARCHAR(200)    NOT NULL,          -- "Alphabet & Phonetik"
    title_vi        VARCHAR(200)    NOT NULL,          -- "Bảng chữ cái & Phát âm"
    description_vi  TEXT,                               -- Mô tả chi tiết cho UI
    emoji           VARCHAR(10)     DEFAULT '📖',

    -- ── Vị trí trong lộ trình ──
    phase           VARCHAR(30)     NOT NULL DEFAULT 'PHONETIK',
    -- PHONETIK | GRUNDLAGEN | GRAMMATIK | SATZSTRUKTUR | BERUF_CONTEXT | ...
    day_number      INTEGER,                            -- NULL nếu node không thuộc 14-day onboarding
    week_number     INTEGER,                            -- Tuần trong lộ trình (1, 2, ...)
    sort_order      INTEGER         NOT NULL DEFAULT 0, -- Thứ tự hiển thị trong cùng phase

    -- ── CEFR & Difficulty ──
    cefr_level      VARCHAR(3)      NOT NULL DEFAULT 'A1',  -- A1, A2, B1, ...
    difficulty      INTEGER         NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 10),
    xp_reward       INTEGER         NOT NULL DEFAULT 100,
    energy_cost     INTEGER         NOT NULL DEFAULT 1,     -- Năng lượng cần để mở (chỉ CORE_TRUNK)

    -- ── Chuyên ngành (cho SATELLITE_LEAF) ──
    industry        VARCHAR(100),                           -- "IT", "Medizin", "Gastronomie", ...
    industry_vocab_percent INTEGER    DEFAULT 0 CHECK (industry_vocab_percent BETWEEN 0 AND 100),
    vocab_strategy  VARCHAR(20)     DEFAULT 'GENERAL',
    -- LEHNWOERTER | LABEL_OBJECTS | CONTEXT | GENERAL

    -- ── LLM-Generated Content Cache ──
    -- Lưu JSON bài học sinh bởi LLM. NULL = chưa sinh / là CORE_TRUNK tĩnh.
    -- User sau có cùng industry + cefr_level sẽ query từ đây → 0 latency.
    content_json    JSONB,
    content_hash    VARCHAR(64),                            -- SHA-256 hash để detect thay đổi
    content_generated_at TIMESTAMPTZ,                       -- Thời điểm LLM sinh content
    content_model   VARCHAR(100),                           -- "groq/llama-4-scout-17b-16e-instruct"

    -- ── Nội dung tĩnh cho CORE_TRUNK (luôn có) ──
    -- grammar_points, core_vocab, exercises được define ở Java code,
    -- nhưng có thể override bằng content_json nếu muốn A/B test.
    core_topics     TEXT[],                                  -- {"ALPHABET","SPECIAL_CHARS","PHONETIK"}
    grammar_points  TEXT[],                                  -- {"Buchstabieren","Aussprache"}

    -- ── Trạng thái ──
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Indexes cho query Cây Kỹ Năng
CREATE INDEX idx_stn_type_phase       ON skill_tree_nodes (node_type, phase);
CREATE INDEX idx_stn_cefr_industry    ON skill_tree_nodes (cefr_level, industry) WHERE node_type = 'SATELLITE_LEAF';
CREATE INDEX idx_stn_day_number       ON skill_tree_nodes (day_number) WHERE day_number IS NOT NULL;
CREATE INDEX idx_stn_sort_order       ON skill_tree_nodes (phase, sort_order);
-- GIN index cho JSONB content search (tìm bài học theo từ khóa)
CREATE INDEX idx_stn_content_gin      ON skill_tree_nodes USING GIN (content_json) WHERE content_json IS NOT NULL;
-- Cache lookup: tìm bài đã sinh cho industry + cefr
CREATE INDEX idx_stn_cache_lookup     ON skill_tree_nodes (industry, cefr_level, content_hash) WHERE content_json IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 2. NODE DEPENDENCIES — Cạnh DAG: điều kiện tiên quyết
--    "Muốn mở Node B thì phải hoàn thành Node A trước"
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skill_tree_node_dependencies (
    id                  BIGSERIAL PRIMARY KEY,
    node_id             BIGINT      NOT NULL REFERENCES skill_tree_nodes(id) ON DELETE CASCADE,
    depends_on_node_id  BIGINT      NOT NULL REFERENCES skill_tree_nodes(id) ON DELETE CASCADE,

    -- ── Loại dependency ──
    -- HARD: Bắt buộc hoàn thành 100% trước khi mở
    -- SOFT: Chỉ cần >= min_score_percent
    dependency_type     VARCHAR(10) NOT NULL DEFAULT 'HARD' CHECK (dependency_type IN ('HARD', 'SOFT')),
    min_score_percent   INTEGER     DEFAULT 100 CHECK (min_score_percent BETWEEN 0 AND 100),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Chống duplicate edges
    CONSTRAINT uq_node_dependency UNIQUE (node_id, depends_on_node_id),
    -- Chống tự phụ thuộc vào chính mình
    CONSTRAINT chk_no_self_dep CHECK (node_id <> depends_on_node_id)
);

CREATE INDEX idx_stnd_node_id     ON skill_tree_node_dependencies (node_id);
CREATE INDEX idx_stnd_depends_on  ON skill_tree_node_dependencies (depends_on_node_id);

-- ─────────────────────────────────────────────────────────────
-- 3. USER PROGRESS — Tiến độ của từng user trên Cây Kỹ Năng
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skill_tree_user_progress (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    node_id         BIGINT      NOT NULL REFERENCES skill_tree_nodes(id) ON DELETE CASCADE,

    -- ── Trạng thái node cho user ──
    -- LOCKED → UNLOCKED → IN_PROGRESS → COMPLETED
    status          VARCHAR(15) NOT NULL DEFAULT 'LOCKED'
                    CHECK (status IN ('LOCKED', 'UNLOCKED', 'IN_PROGRESS', 'COMPLETED')),

    -- ── Điểm & Tiến độ ──
    score_percent   INTEGER     DEFAULT 0 CHECK (score_percent BETWEEN 0 AND 100),
    xp_earned       INTEGER     DEFAULT 0,
    attempts        INTEGER     DEFAULT 0,
    best_score      INTEGER     DEFAULT 0 CHECK (best_score BETWEEN 0 AND 100),

    -- ── Gamification ──
    energy_spent    INTEGER     DEFAULT 0,       -- Năng lượng đã tiêu cho CORE_TRUNK
    tickets_spent   INTEGER     DEFAULT 0,       -- Vé chuyên ngành đã dùng cho SATELLITE_LEAF

    -- ── Content cá nhân hóa ──
    -- JSON bài học đã sinh riêng cho user này (override node.content_json nếu cần)
    personalized_content_json JSONB,

    -- ── Pre-fetching status ──
    -- Khi user đạt 80% node hiện tại, hệ thống gọi LLM sinh content cho node tiếp theo
    prefetch_status VARCHAR(15) DEFAULT 'NONE'
                    CHECK (prefetch_status IN ('NONE', 'QUEUED', 'GENERATING', 'READY', 'FAILED')),
    prefetch_triggered_at TIMESTAMPTZ,

    -- ── Timestamps ──
    unlocked_at     TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Mỗi user chỉ có 1 record cho mỗi node
    CONSTRAINT uq_user_node UNIQUE (user_id, node_id)
);

-- Index chính cho dashboard query (lấy tất cả node của 1 user)
CREATE INDEX idx_stup_user_status   ON skill_tree_user_progress (user_id, status);
-- Index cho pre-fetching scheduler
CREATE INDEX idx_stup_prefetch      ON skill_tree_user_progress (prefetch_status, user_id)
    WHERE prefetch_status IN ('QUEUED', 'GENERATING');
-- Index cho leaderboard / achievement query
CREATE INDEX idx_stup_completed     ON skill_tree_user_progress (user_id, completed_at DESC)
    WHERE status = 'COMPLETED';

-- ─────────────────────────────────────────────────────────────
-- 4. SEED: 14-day Goethe Onboarding Curriculum (CORE_TRUNK)
-- ─────────────────────────────────────────────────────────────
INSERT INTO skill_tree_nodes (node_type, title_de, title_vi, description_vi, emoji, phase, day_number, week_number, sort_order, cefr_level, difficulty, xp_reward, energy_cost, industry_vocab_percent, vocab_strategy, core_topics, grammar_points)
VALUES
-- ═══ TUẦN 1: Vỡ lòng — Âm thanh & Nhận diện ═══
('CORE_TRUNK', 'Alphabet & Sonderzeichen (Teil 1)', 'Bảng chữ cái & Âm đặc trưng (P1)',
 'Học bảng chữ cái tiếng Đức, đặc biệt: ä, ö, ü, ß và các cụm nguyên âm ei, ie, eu. AI chấm điểm phát âm gắt gao.',
 '🔤', 'PHONETIK', 1, 1, 1, 'A1', 1, 100, 1, 5, 'LEHNWOERTER',
 ARRAY['ALPHABET','SPECIAL_CHARS','UMLAUTE'], ARRAY['Aussprache','Vokale']),

('CORE_TRUNK', 'Konsonantengruppen & Aussprache (Teil 2)', 'Cụm phụ âm & Luyện phát âm (P2)',
 'Luyện các cụm phụ âm khó: sch, ch, sp, st, pf, z. Phân biệt ch trong "ich" vs "ach". AI Feedback realtime.',
 '🗣️', 'PHONETIK', 2, 1, 2, 'A1', 1, 100, 1, 5, 'LEHNWOERTER',
 ARRAY['KONSONANTEN','SCH_CH_SP_ST'], ARRAY['Konsonanten','Ausspracheregeln']),

('CORE_TRUNK', 'Begrüßung & Sich vorstellen', 'Chào hỏi & Giới thiệu bản thân',
 'Hallo, Guten Morgen, Tschüss. Cấu trúc Ich bin... / Ich heiße... Luyện nói với AI.',
 '👋', 'GRUNDLAGEN', 3, 1, 3, 'A1', 2, 120, 1, 8, 'LEHNWOERTER',
 ARRAY['BEGRUESSUNG','SELBSTVORSTELLUNG'], ARRAY['Ich bin...','Ich heiße...']),

('CORE_TRUNK', 'Buchstabieren & Beruf', 'Đánh vần tên & Nghề nghiệp',
 'Đánh vần tên bằng tiếng Đức. Học từ vựng nghề nghiệp cơ bản. Bài tập: đánh vần tên + nói nghề.',
 '✏️', 'GRUNDLAGEN', 4, 1, 4, 'A1', 2, 120, 1, 10, 'LEHNWOERTER',
 ARRAY['BUCHSTABIEREN','BERUFE'], ARRAY['Buchstabieren','Wie heißen Sie?']),

('CORE_TRUNK', 'Zahlen 1-20 & Personalpronomen (Teil 1)', 'Số đếm 1-20 & Đại từ nhân xưng (P1)',
 'Số đếm 1-20. Đại từ: ich, du, er, sie, es. Bài tập: nói tuổi, số điện thoại.',
 '🔢', 'GRUNDLAGEN', 5, 1, 5, 'A1', 2, 130, 1, 8, 'LEHNWOERTER',
 ARRAY['ZAHLEN_1_20','PRONOMEN_SINGULAR'], ARRAY['Personalpronomen','Wie alt bist du?']),

('CORE_TRUNK', 'Zahlen 21-100 & Personalpronomen (Teil 2)', 'Số đếm 21-100 & Đại từ (P2)',
 'Quy tắc đọc ngược (21 = ein-und-zwanzig). Đại từ: wir, ihr, sie/Sie. Luyện nghe số.',
 '💯', 'GRUNDLAGEN', 6, 1, 6, 'A1', 3, 140, 1, 10, 'LEHNWOERTER',
 ARRAY['ZAHLEN_21_100','PRONOMEN_PLURAL'], ARRAY['Umkehrregel','wir/ihr/sie']),

('CORE_TRUNK', 'Woche-1-Wiederholung & Mini-Test', 'Ôn tập Tuần 1 & Mini Test',
 'Ôn tập toàn bộ Ngày 1-6: bảng chữ cái, chào hỏi, số đếm, đại từ. Bài kiểm tra nhanh.',
 '🏆', 'GRUNDLAGEN', 7, 1, 7, 'A1', 3, 200, 1, 10, 'LABEL_OBJECTS',
 ARRAY['REVIEW_WEEK1','MINI_TEST'], ARRAY['Wiederholung','Kontrolle']),

-- ═══ TUẦN 2: Lắp ghép — Cấu trúc & Giới tính ═══
('CORE_TRUNK', 'Der, Die, Das — Bestimmter Artikel', 'Der, Die, Das — Mạo từ xác định',
 'Giống đực (der), giống cái (die), giống trung (das), số nhiều (die). Bôi màu theo giới tính.',
 '🎨', 'GRAMMATIK', 8, 2, 8, 'A1', 3, 150, 1, 15, 'LABEL_OBJECTS',
 ARRAY['BESTIMMTER_ARTIKEL','GENUS'], ARRAY['der/die/das','Pluralformen']),

('CORE_TRUNK', 'Ein, Eine — Unbestimmter Artikel', 'Ein, Eine — Mạo từ không xác định',
 'Mạo từ không xác định: ein (masc/neut), eine (fem). So sánh với der/die/das.',
 '📐', 'GRAMMATIK', 9, 2, 9, 'A1', 3, 150, 1, 18, 'LABEL_OBJECTS',
 ARRAY['UNBESTIMMTER_ARTIKEL','EIN_EINE'], ARRAY['ein/eine','Negation: kein/keine']),

('CORE_TRUNK', 'sein & haben — Konjugation Präsens', 'sein & haben — Chia động từ hiện tại',
 '2 động từ quan trọng nhất: sein (thì, là, ở) và haben (có). Chia theo tất cả đại từ.',
 '⚡', 'GRAMMATIK', 10, 2, 10, 'A1', 4, 160, 1, 20, 'LABEL_OBJECTS',
 ARRAY['SEIN_HABEN','KONJUGATION_PRAESENS'], ARRAY['sein Konjugation','haben Konjugation']),

('CORE_TRUNK', 'Regelmäßige Verben — Konjugation', 'Động từ có quy tắc — Chia động từ',
 'Chia động từ có quy tắc: machen, lernen, arbeiten + động từ chuyên ngành đầu tiên.',
 '🔧', 'GRAMMATIK', 11, 2, 11, 'A1', 4, 160, 1, 22, 'LABEL_OBJECTS',
 ARRAY['REGELMAESSIGE_VERBEN','KONJUGATION'], ARRAY['Verbstamm + Endung','-e/-st/-t/-en/-t/-en']),

('CORE_TRUNK', 'W-Fragen — Fragewörter', 'W-Fragen — Câu hỏi có từ để hỏi',
 'Wer, Was, Wo, Woher, Wie, Wann. Cấu trúc câu hỏi. Bài tập hỏi-đáp với AI.',
 '❓', 'SATZSTRUKTUR', 12, 2, 12, 'A1', 4, 170, 1, 20, 'CONTEXT',
 ARRAY['W_FRAGEN','FRAGESATZ'], ARRAY['Wer/Was/Wo/Woher/Wie','V2-Regel in Fragen']),

('CORE_TRUNK', 'V2-Regel & Aussagesatz', 'Quy tắc V2 & Câu trần thuật',
 'Quy tắc vàng: Động từ LUÔN đứng vị trí số 2. Luyện đặt câu đúng trật tự.',
 '📏', 'SATZSTRUKTUR', 13, 2, 13, 'A1', 5, 180, 1, 25, 'CONTEXT',
 ARRAY['V2_REGEL','AUSSAGESATZ','SATZSTELLUNG'], ARRAY['Verbposition 2','Subjekt-Verb-Objekt']),

('CORE_TRUNK', 'Woche-2-Wiederholung & Checkpoint', 'Ôn tập Tuần 2 & Kiểm tra Checkpoint',
 'Ôn tập Ngày 8-13: mạo từ, chia động từ, cấu trúc câu. Bài kiểm tra Checkpoint A1.',
 '🎯', 'SATZSTRUKTUR', 14, 2, 14, 'A1', 5, 300, 1, 25, 'CONTEXT',
 ARRAY['REVIEW_WEEK2','CHECKPOINT_A1'], ARRAY['Gesamtwiederholung','Kompetenzcheck']);

-- ─────────────────────────────────────────────────────────────
-- 5. SEED: DAG Dependencies (tuyến tính cho 14-day onboarding)
-- ─────────────────────────────────────────────────────────────
-- Mỗi ngày phụ thuộc vào ngày trước đó (trừ Ngày 1)
DO $$
DECLARE
    prev_id BIGINT;
    curr_id BIGINT;
    d INTEGER;
BEGIN
    FOR d IN 2..14 LOOP
        SELECT id INTO prev_id FROM skill_tree_nodes WHERE day_number = d - 1 AND node_type = 'CORE_TRUNK' LIMIT 1;
        SELECT id INTO curr_id FROM skill_tree_nodes WHERE day_number = d     AND node_type = 'CORE_TRUNK' LIMIT 1;
        IF prev_id IS NOT NULL AND curr_id IS NOT NULL THEN
            INSERT INTO skill_tree_node_dependencies (node_id, depends_on_node_id, dependency_type, min_score_percent)
            VALUES (curr_id, prev_id, 'HARD', 60)
            ON CONFLICT (node_id, depends_on_node_id) DO NOTHING;
        END IF;
    END LOOP;
END $$;
