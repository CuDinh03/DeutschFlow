-- ============================================================
-- V112: Practice Exercises & Exam Prep
-- Bảng lưu trữ bài tập bổ trợ, độc lập với skill_tree_nodes
-- ============================================================

CREATE TABLE IF NOT EXISTS practice_exercises (
    id              BIGSERIAL PRIMARY KEY,
    
    -- Phân loại bài tập
    -- NORMAL: Bài tập ngữ pháp/từ vựng bổ trợ
    -- EXAM: Bài thi mẫu (Goethe Zertifikat, Telc...)
    exercise_type   VARCHAR(20) NOT NULL DEFAULT 'NORMAL' CHECK (exercise_type IN ('NORMAL', 'EXAM')),
    
    -- Level CEFR (A1, A2, B1, B2, C1, C2)
    cefr_level      VARCHAR(3)  NOT NULL,
    
    -- Kỹ năng (GRAMMAR, VOCAB, READING, LISTENING, WRITING, SPEAKING)
    skill_type      VARCHAR(20) NOT NULL,
    
    -- Tên bài thi (nếu exercise_type = 'EXAM', ví dụ: 'Goethe-Zertifikat B1 Modelltest 1')
    exam_name       VARCHAR(200),
    
    -- Dữ liệu câu hỏi (JSON chứa danh sách câu hỏi trắc nghiệm, điền từ...)
    content_json    JSONB       NOT NULL,
    
    -- Thông tin nguồn (tên nguồn lấy bài tập, URL gốc để tham khảo)
    source_name     VARCHAR(100),
    source_url      VARCHAR(500),
    
    -- Điểm thưởng khi hoàn thành
    xp_reward       INTEGER     NOT NULL DEFAULT 50,
    
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_practice_type_level ON practice_exercises (exercise_type, cefr_level);
CREATE INDEX idx_practice_skill ON practice_exercises (skill_type);

-- ============================================================
-- Bảng lưu lịch sử làm bài tập bổ trợ của user
-- Không tính vào Streak (chuỗi ngày học) của hệ thống chính
-- ============================================================

CREATE TABLE IF NOT EXISTS practice_history (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    practice_id     BIGINT      NOT NULL REFERENCES practice_exercises(id) ON DELETE CASCADE,
    
    score_percent   INTEGER     NOT NULL DEFAULT 0 CHECK (score_percent BETWEEN 0 AND 100),
    xp_earned       INTEGER     NOT NULL DEFAULT 0,
    
    -- Thời gian bắt đầu và nộp bài
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    
    -- JSON chứa chi tiết câu trả lời của user để xem lại lịch sử
    answer_data     JSONB,
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_practice_history_user ON practice_history (user_id, completed_at DESC);
