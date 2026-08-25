-- V284 — Lưu audio lượt nói CHỈ cho phiên hiệu chuẩn (golden set).
--
-- Quyết định owner 26/08/2026: KHÔNG lưu audio của mọi học viên (chi phí lưu trữ + nghĩa vụ
-- consent ghi âm). Chỉ những người đã ĐỒNG Ý tham gia chiến dịch hiệu chuẩn G.2/G.3 mới có
-- audio được giữ lại, và chỉ trong phiên MOCK — vì golden set chấm trên phiên mock.
--
-- Consent được ghi nhận ở đây (consented_at) chứ không phải suy diễn từ việc "có audio":
-- rút lại đồng ý = xoá dòng participant + purge audio (endpoint admin), phiên cũ không còn key.

ALTER TABLE speaking_exam_sessions
    ADD COLUMN IF NOT EXISTS retain_audio BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN speaking_exam_sessions.retain_audio IS
    'true = lưu audio từng lượt lên S3 (speaking_exam_turns.audio_ref). Chỉ bật cho phiên MOCK của người đã đồng ý tham gia hiệu chuẩn.';

CREATE TABLE IF NOT EXISTS speaking_exam_calibration_participants (
    user_id      BIGINT      PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    consented_at TIMESTAMPTZ NOT NULL,
    note         VARCHAR(255),
    created_by   BIGINT      REFERENCES users (id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE speaking_exam_calibration_participants IS
    'Người học đã đồng ý cho lưu audio phục vụ hiệu chuẩn chấm điểm (G.2/G.3). Xoá dòng = rút đồng ý.';
