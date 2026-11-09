-- B3 "Nâng phòng thi" (09/11/2026). Chỉ thêm cột/bảng — tương thích ngược khi blue-green, mobile không đổi.
-- Số V373: V368–V370 đang giữ cho PR #803/#804/#805, V371/V372 để dành — các số nhỏ hơn phải lên prod trước
-- (out-of-order: false, docs/QUY_TRINH_PHAT_HANH.md §6.2).
--
-- 1) mock_exam_practice_progress.notes_json — "Vì sao tôi chọn": ghi chú ngắn (không bắt buộc) của học viên
--    cho từng câu khi luyện một Teil, {itemId: "ghi chú"}. Lưu cùng nháp/nộp, hiện cạnh giải thích sau khi nộp.
--    Làm lại Teil (DELETE hàng) thì mất theo.
ALTER TABLE mock_exam_practice_progress
    ADD COLUMN IF NOT EXISTS notes_json JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2) mock_exam_attempts.draft_flags_json — câu "đánh dấu xem lại" trong lúc thi thử, ["LV2-6", ...].
--    Cột riêng, KHÔNG trộn vào draft_json (draft_json là bản đáp án /finish có thể chấm khi quá hạn).
--    NULL = client chưa gửi (mobile cũ): lưu nháp không có trường flags thì giữ nguyên giá trị cũ.
ALTER TABLE mock_exam_attempts
    ADD COLUMN IF NOT EXISTS draft_flags_json JSONB;

-- 3) Bộ nhớ đệm "Hỏi AI về câu này" ở màn xem lại sau khi nộp. Một lời giải thích cho mỗi
--    (đề, Teil, câu, đáp án đã chọn, ngôn ngữ, phiên bản nội dung). Không chứa gì riêng của người học
--    (ghi chú "vì sao tôi chọn" không gửi AI) nên dùng chung mọi người: hỏi lại — của mình hay người
--    khác — trả bản đã lưu, không gọi AI, không trừ quota.
--    content_hash = SHA-256 của toàn bộ ngữ cảnh gửi AI (đoạn văn, câu hỏi, lựa chọn, đáp án, giải thích
--    sẵn): sửa đề/giải thích là ra hash mới, bản cũ tự hết hiệu lực. chosen = '' khi câu bỏ trống.
CREATE TABLE IF NOT EXISTS exam_item_ai_explanations (
    id           BIGSERIAL    PRIMARY KEY,
    exam_id      BIGINT       NOT NULL REFERENCES mock_exams (id) ON DELETE CASCADE,
    teil_key     VARCHAR(40)  NOT NULL,
    item_id      VARCHAR(80)  NOT NULL,
    chosen       VARCHAR(40)  NOT NULL DEFAULT '',
    locale       VARCHAR(8)   NOT NULL,
    content_hash CHAR(64)     NOT NULL,
    answer       TEXT         NOT NULL,
    model        VARCHAR(120),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_exam_item_ai_explanation UNIQUE (exam_id, teil_key, item_id, chosen, locale, content_hash)
);
