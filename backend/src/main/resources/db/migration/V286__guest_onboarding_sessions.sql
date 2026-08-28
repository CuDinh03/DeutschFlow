-- V286 — Phiên onboarding của KHÁCH (chưa có tài khoản).
--
-- Vì sao cần (spec docs/onboarding-flow-spec.md §4.3, bất biến I-7):
-- Luồng value-first cho khách chạy hết phễu TRƯỚC khi đăng ký. Hôm nay câu trả lời
-- của họ chỉ nằm trên máy (localStorage/SecureStore) và KHÔNG gắn với ai cả, nên
-- effect resume ở màn onboarding chạy cho bất kỳ tài khoản nào đăng nhập trên máy
-- đó — tài khoản thứ hai bị GHI ĐÈ hồ sơ học bằng câu trả lời của người trước
-- (QA 2026-08-20, F-3). TTL 30 phút ở client chỉ thu hẹp cửa sổ chứ không đóng.
--
-- Bảng này đóng hẳn: phiên có chủ, và `claimed_by_user_id` là thứ quyết định câu
-- trả lời thuộc về ai — không phải "ai đang ngồi trước máy".
--
-- Vì sao id là UUID chứ không phải BIGSERIAL: đây là bí mật mang quyền truy cập,
-- client cầm nó để PATCH mà không cần đăng nhập. Số tuần tự thì đoán được, và
-- đoán trúng nghĩa là đọc/sửa được câu trả lời của người lạ.

CREATE TABLE IF NOT EXISTS guest_onboarding_sessions (
    id                  UUID         PRIMARY KEY,
    platform            VARCHAR(16)  NOT NULL,
    locale              VARCHAR(5)   NOT NULL,
    flow_version        VARCHAR(16)  NOT NULL,
    current_step        VARCHAR(32)  NOT NULL,
    answers             JSONB        NOT NULL DEFAULT '{}'::jsonb,
    activity_result     JSONB,
    claimed_by_user_id  BIGINT       REFERENCES users (id) ON DELETE SET NULL,
    claimed_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ  NOT NULL
);

-- Job dọn rác quét theo expires_at; không có index thì mỗi lần chạy là seq scan
-- trên một bảng chỉ có rác.
CREATE INDEX IF NOT EXISTS idx_guest_onb_expires
    ON guest_onboarding_sessions (expires_at);

-- Tra "user này đã claim phiên nào chưa" khi claim lại (idempotent, bất biến I-6).
-- Partial index: đại đa số dòng chưa claim nên NULL không đáng đánh chỉ mục.
CREATE INDEX IF NOT EXISTS idx_guest_onb_claimed_by
    ON guest_onboarding_sessions (claimed_by_user_id)
    WHERE claimed_by_user_id IS NOT NULL;

COMMENT ON TABLE guest_onboarding_sessions IS
    'Câu trả lời phễu onboarding của khách chưa đăng ký. TTL 72h, dọn bằng GuestOnboardingSessionCleanupJob. Claim gắn phiên vào đúng một user và không đảo ngược.';
COMMENT ON COLUMN guest_onboarding_sessions.id IS
    'Vừa là khoá chính vừa là bearer token của phiên — client dùng nó để PATCH mà không cần đăng nhập. PHẢI sinh ngẫu nhiên, không đoán được.';
COMMENT ON COLUMN guest_onboarding_sessions.platform IS 'WEB | IOS | ANDROID — để tách funnel theo nền tảng.';
COMMENT ON COLUMN guest_onboarding_sessions.flow_version IS 'onb_v3 — gắn vào để so funnel giữa flow cũ và mới khi rollout theo %.';
COMMENT ON COLUMN guest_onboarding_sessions.answers IS 'OnboardingAnswers theo spec §5.1. KHÔNG chứa PII: chỉ trình độ/mục tiêu/lĩnh vực.';
COMMENT ON COLUMN guest_onboarding_sessions.activity_result IS
    'Kết quả hoạt động đầu tiên (bài học A0 / placement / hội thoại AI). KHÔNG lưu audio — so khớp phát âm chạy cục bộ trên máy.';
COMMENT ON COLUMN guest_onboarding_sessions.claimed_by_user_id IS
    'NULL = chưa ai nhận. Đặt đúng MỘT lần bằng UPDATE … WHERE claimed_by_user_id IS NULL để hai request đua nhau chỉ một bên thắng.';
