-- ============================================================================
-- V389 — Góp ý của người dùng về phần mềm (đặc tả gopycapnhat, Giai đoạn 1).
--
-- Chỉ THÊM bảng (tương thích blue-green). Ba bảng:
--   feedback_items        một góp ý (người gửi, loại, phần, điểm hài lòng, trạng thái…)
--   feedback_attachments  ảnh chụp màn hình đã mã hoá lại, nằm ở tiền tố riêng `feedback/` trên R2
--   feedback_replies      lời trả lời của đội ngũ (người gửi đọc được)
--
-- Nhóm góp ý, bản cập nhật, thư mời đánh giá thuộc Giai đoạn 2–3: migration riêng, thêm cột/bảng sau.
-- Số V: V388 đã được đặc tả `luyendeu` giữ (PR #898), nên dùng V389.
-- ============================================================================

CREATE TABLE IF NOT EXISTS feedback_items (
    id                 BIGSERIAL PRIMARY KEY,
    user_id            BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Vai trò và trung tâm ĐÓNG BĂNG lúc gửi (như MOD-06): đổi vai trò về sau không đổi lịch sử.
    role_at_submit     VARCHAR(16)  NOT NULL,
    org_id_at_submit   BIGINT,
    source             VARCHAR(16)  NOT NULL DEFAULT 'IN_APP',
    type               VARCHAR(16)  NOT NULL,
    area               VARCHAR(32)  NOT NULL,
    satisfaction       SMALLINT,
    content            VARCHAR(2000) NOT NULL,
    title              VARCHAR(100) NOT NULL,
    status             VARCHAR(16)  NOT NULL DEFAULT 'NEW',
    allow_contact      BOOLEAN      NOT NULL DEFAULT FALSE,
    -- Chỉ các trường ở BR-04 (trang đã lọc token, trình duyệt, hệ điều hành, thiết bị, bản dựng,
    -- ngôn ngữ, cỡ màn hình). KHÔNG IP, KHÔNG User-Agent đầy đủ.
    tech_info          JSONB,
    client_request_id  VARCHAR(64),
    internal_note      VARCHAR(2000),
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    read_at            TIMESTAMPTZ,
    status_changed_at  TIMESTAMPTZ,
    tech_purged_at     TIMESTAMPTZ,
    CONSTRAINT feedback_items_source_chk CHECK (source IN ('IN_APP', 'RATING_INVITE', 'AFTER_MOCK')),
    CONSTRAINT feedback_items_type_chk CHECK (type IN ('BUG', 'IDEA', 'USABILITY', 'GENERAL')),
    CONSTRAINT feedback_items_status_chk CHECK (status IN ('NEW', 'READ', 'IN_PROGRESS', 'SHIPPED', 'DECLINED')),
    CONSTRAINT feedback_items_satisfaction_chk CHECK (satisfaction IS NULL OR satisfaction BETWEEN 1 AND 5)
);

-- Chống gửi trùng khi mạng rớt (QLT-03): cùng người + cùng clientRequestId = cùng một góp ý.
CREATE UNIQUE INDEX IF NOT EXISTS ux_feedback_items_user_client_request
    ON feedback_items (user_id, client_request_id) WHERE client_request_id IS NOT NULL;
-- Hộp góp ý admin: lọc theo trạng thái, mới nhất trước.
CREATE INDEX IF NOT EXISTS ix_feedback_items_status_created
    ON feedback_items (status, created_at DESC);
-- "Góp ý của tôi".
CREATE INDEX IF NOT EXISTS ix_feedback_items_user_created
    ON feedback_items (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS feedback_attachments (
    id            BIGSERIAL PRIMARY KEY,
    -- NULL tới khi gắn vào góp ý (ảnh tải lên trước, góp ý gửi sau).
    feedback_id   BIGINT       REFERENCES feedback_items(id) ON DELETE CASCADE,
    uploader_id   BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    object_key    VARCHAR(255) NOT NULL UNIQUE,
    content_type  VARCHAR(32)  NOT NULL,
    size_bytes    INTEGER      NOT NULL,
    width         INTEGER      NOT NULL,
    height        INTEGER      NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    purged_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_feedback_attachments_feedback ON feedback_attachments (feedback_id);
CREATE INDEX IF NOT EXISTS ix_feedback_attachments_uploader ON feedback_attachments (uploader_id);

CREATE TABLE IF NOT EXISTS feedback_replies (
    id           BIGSERIAL PRIMARY KEY,
    feedback_id  BIGINT        NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
    body         VARCHAR(1000) NOT NULL,
    -- Admin trả lời xoá tài khoản thì lời trả lời vẫn còn với người gửi góp ý.
    author_id    BIGINT        REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_feedback_replies_feedback ON feedback_replies (feedback_id, created_at);
