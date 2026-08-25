-- G.1 Golden set (gate ra mắt Luyện thi Nói): phiếu chấm TAY của giám khảo người cho phiên mock
-- đã có kết quả máy. Người chấm nhập BAND từng tiêu chí/nhiệm vụ theo đúng rubric của hệ
-- (Goethe A–E, telc A–D, A1 VOLL/HALB/NULL); ĐIỂM và đỗ/trượt của người chấm do RubricScorer
-- tính lại từ band — cùng một bảng quy điểm với máy nên so sánh được 1-1.
-- teil_no = 0 nghĩa là tiêu chí GLOBAL (vd. AUSSPRACHE của Goethe B1) — dùng 0 thay vì NULL
-- để UNIQUE hoạt động (Postgres coi NULL là khác nhau trong ràng buộc UNIQUE).
CREATE TABLE speaking_exam_golden_ratings (
    id             BIGSERIAL PRIMARY KEY,
    session_id     BIGINT      NOT NULL REFERENCES speaking_exam_sessions (id) ON DELETE CASCADE,
    rater_user_id  BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    teil_no        INT         NOT NULL DEFAULT 0,
    criterion_code VARCHAR(64) NOT NULL,
    band           VARCHAR(8)  NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_golden_rating UNIQUE (session_id, rater_user_id, teil_no, criterion_code)
);
CREATE INDEX idx_golden_ratings_session ON speaking_exam_golden_ratings (session_id);
CREATE INDEX idx_golden_ratings_rater ON speaking_exam_golden_ratings (rater_user_id, session_id);
