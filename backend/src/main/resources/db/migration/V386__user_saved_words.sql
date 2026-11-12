-- Sổ từ riêng của học viên — lưu từ khi luyện đề đọc (13/11/2026, owner chốt 4 quyết định).
--
-- Học viên bôi đen 1–5 từ trong bài đọc ở Luyện Teil ⇒ "Lưu từ". Server tìm dạng gốc + nghĩa trong kho
-- (words, kể cả dạng biến cách / Partizip II); không có thì AI giải nghĩa theo câu đang đọc, kết quả để ở
-- vocab_lookup_cache dùng chung cho người sau. Chủ đề lấy từ bộ chủ đề sẵn của kho (tags.is_topic_taxonomy):
-- tag của chính từ trong kho → luật từ khoá → AI (cùng lượt tra) → để trống = "Chưa phân loại".
-- Lưu xong tự vào lịch ôn (vocab_review_schedule, vocab_id = srs_vocab_id): từ trong kho dùng chung mã
-- 'word_<id>' với các bài luyện từ vựng (không sinh thẻ trùng), từ ngoài kho 'sw:<dạng gốc>'. Gỡ khỏi sổ thì
-- gỡ thẻ — trừ khi thẻ đã có từ trước khi lưu (srs_created = FALSE).
--
-- Một hàng / người × dạng gốc (lemma_key = chữ thường). Lưu lại cùng từ ⇒ giữ hàng cũ, không nhân bản.
-- Vị trí trong bài (exam_id, teil_key, passage_block, char_start/end) để sau này mở lại đúng câu; đề bị xoá
-- ⇒ SET NULL, từ vẫn ở trong sổ.
--
-- Chỉ thêm bảng ⇒ tương thích ngược khi blue-green.

CREATE TABLE user_saved_words (
    id              BIGSERIAL     PRIMARY KEY,
    user_id         BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lemma           VARCHAR(120)  NOT NULL,
    lemma_key       VARCHAR(120)  NOT NULL,
    surface         VARCHAR(120)  NOT NULL,
    article         VARCHAR(3),
    pos             VARCHAR(20),
    meaning_vi      TEXT,
    meaning_source  VARCHAR(10)   NOT NULL,
    word_id         BIGINT        REFERENCES words(id) ON DELETE SET NULL,
    topic           VARCHAR(100),
    topic_source    VARCHAR(10)   NOT NULL DEFAULT 'NONE',
    source_sentence TEXT,
    exam_id         BIGINT        REFERENCES mock_exams(id) ON DELETE SET NULL,
    teil_key        VARCHAR(40),
    passage_block   VARCHAR(80),
    char_start      INTEGER,
    char_end        INTEGER,
    srs_vocab_id    VARCHAR(80)   NOT NULL,
    -- FALSE = thẻ ôn đã có từ trước (vd. từ kho đã học ở bài thẻ vuốt) ⇒ gỡ khỏi sổ KHÔNG xoá thẻ đó.
    srs_created     BOOLEAN       NOT NULL DEFAULT TRUE,
    ai_lookup       BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_saved_words_lemma UNIQUE (user_id, lemma_key),
    CONSTRAINT ck_user_saved_words_meaning_source CHECK (meaning_source IN ('KHO', 'CACHE', 'AI')),
    CONSTRAINT ck_user_saved_words_topic_source CHECK (topic_source IN ('KHO', 'RULE', 'AI', 'USER', 'NONE'))
);

CREATE INDEX idx_user_saved_words_user_topic ON user_saved_words (user_id, topic);
CREATE INDEX idx_user_saved_words_user_exam ON user_saved_words (user_id, exam_id, teil_key);
-- Đếm lượt tra AI trong ngày (trần mỗi ngày) — chỉ hàng có gọi AI.
CREATE INDEX idx_user_saved_words_ai_day ON user_saved_words (user_id, created_at) WHERE ai_lookup;

-- Kết quả AI giải nghĩa từ ngoài kho, dùng chung mọi học viên. Khoá = dạng bôi đen, chữ thường.
CREATE TABLE vocab_lookup_cache (
    surface_key VARCHAR(120)  PRIMARY KEY,
    lemma       VARCHAR(120)  NOT NULL,
    article     VARCHAR(3),
    pos         VARCHAR(20),
    meaning_vi  TEXT          NOT NULL,
    topic       VARCHAR(100),
    model       VARCHAR(120),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
