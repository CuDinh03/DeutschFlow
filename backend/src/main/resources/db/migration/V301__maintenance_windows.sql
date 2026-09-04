-- ============================================================================
-- V301 — Cơ chế bảo trì hệ thống (plans/2026-09-03-thiet-ke-co-che-bao-tri-he-thong.md)
--
-- Một nguồn sự thật duy nhất cho trạng thái bảo trì: KHÔNG có cờ thứ hai trong
-- system_config (hai cờ sẽ lệch nhau). Vòng đời: SCHEDULED → ACTIVE →
-- COMPLETED | CANCELLED. mode FULL chặn API qua MaintenanceModeFilter;
-- ANNOUNCE_ONLY chỉ đổi payload /api/public/system/status (client hiện banner).
--
-- Các mốc notified_* chống gửi thông báo lặp khi job chạy mỗi phút (cùng
-- pattern "notified đúng một lần" của regrade #437). ends_at NULL = khẩn cấp
-- chưa rõ giờ xong (auto_complete đòi ends_at NOT NULL — enforce ở service).
-- ============================================================================

CREATE TABLE IF NOT EXISTS maintenance_windows (
    id                   BIGSERIAL PRIMARY KEY,
    title                VARCHAR(200) NOT NULL,
    note                 TEXT,
    starts_at            TIMESTAMP NOT NULL,
    ends_at              TIMESTAMP,
    mode                 VARCHAR(20) NOT NULL DEFAULT 'FULL',
    status               VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    auto_activate        BOOLEAN NOT NULL DEFAULT TRUE,
    -- Mặc định TẮT có chủ đích: bảo trì chưa xong mà cơ chế tự mở cửa nguy hiểm
    -- hơn quên tắt — quên tắt đã có chuông overdue (ADMIN_SYSTEM_ALERT + alert rule).
    auto_complete        BOOLEAN NOT NULL DEFAULT FALSE,
    notified_schedule_at TIMESTAMP,
    notified_before_at   TIMESTAMP,
    notified_complete_at TIMESTAMP,
    overdue_alerted_at   TIMESTAMP,
    created_by           VARCHAR(255) NOT NULL,
    created_at           TIMESTAMP NOT NULL DEFAULT now(),
    updated_at           TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT chk_mw_mode   CHECK (mode   IN ('FULL', 'ANNOUNCE_ONLY')),
    CONSTRAINT chk_mw_status CHECK (status IN ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT chk_mw_ends   CHECK (ends_at IS NULL OR ends_at > starts_at)
);

-- Bất biến hệ thống: tối đa MỘT window đang ACTIVE — enforce bằng DB chứ không
-- chỉ bằng code (hai admin bấm activate song song → một bên nhận 409, không bao
-- giờ có hai window cùng chặn với nội dung khác nhau).
CREATE UNIQUE INDEX IF NOT EXISTS uq_maintenance_windows_active
    ON maintenance_windows (status) WHERE status = 'ACTIVE';

-- Job mỗi phút quét theo (status, starts_at); cache trạng thái cũng đọc đường này.
CREATE INDEX IF NOT EXISTS idx_maintenance_windows_status_starts
    ON maintenance_windows (status, starts_at);
