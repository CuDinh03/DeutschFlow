-- Đợt 2 admin (09/11/2026): lịch sử cấu hình AI + quay lại bản cũ.
--
-- PUT /api/admin/ai-config sửa 4 khoá system_config (ai.systemPrompt, ai.temperature, ai.maxTokens,
-- ai.topP) ghép vào MỌI lời gọi AI của hệ thống. Trước đây chỉ có một vết audit "updated" — không
-- biết giá trị cũ là gì nên không có đường lùi khi một lần sửa làm hỏng chất lượng trả lời.
-- Mỗi lần lưu (và mỗi lần quay lại) ghi một dòng ở đây: ảnh chụp TRƯỚC + SAU của cả 4 khoá, lý do,
-- người sửa. Dòng quay lại trỏ về dòng nguồn qua restored_from_id.
--
-- before_json/after_json mang cả prompt (để admin xem diff và quay lại) — bảng này chỉ admin đọc
-- qua /api/admin/ai-config/history. Vết audit tương ứng thì KHÔNG mang prompt, chỉ sha256.
CREATE TABLE IF NOT EXISTS ai_config_history (
    id                 BIGSERIAL PRIMARY KEY,
    changed_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    changed_by_user_id BIGINT,
    changed_by_email   VARCHAR(255),
    reason             TEXT         NOT NULL,
    before_json        JSONB        NOT NULL,
    after_json         JSONB        NOT NULL,
    restored_from_id   BIGINT       NULL REFERENCES ai_config_history (id)
);

CREATE INDEX IF NOT EXISTS idx_ai_config_history_changed_at
    ON ai_config_history (changed_at DESC);

-- "Hoạt động bảo mật" của người dùng (GET /api/profile/me/security-events) đọc audit_logs theo
-- (target_type = 'USER', target_id = <mình>) mới nhất trước. Chưa có index nào phủ cặp này
-- (chỉ created_at, event_name, và các index theo org_id) ⇒ mỗi lần mở tab là một lượt quét bảng.
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_created
    ON audit_logs (target_type, target_id, created_at DESC);
