-- ============================================================================
-- V302 — Bảo trì định kỳ (plans/2026-09-03 §12b, PR-A2): cửa sổ bảo trì lặp
-- hằng ngày (khung deploy/job đêm ~03:00 VN) đi theo config `app.maintenance.daily.*`,
-- job tự tạo cửa sổ SCHEDULED cho lần kế tiếp.
--
-- recurrence_key: khoá chống tạo trùng khi job chạy mỗi 60s — vd "daily:2026-09-10".
-- Cửa sổ có recurrence_key được coi là "định kỳ": bị LOẠI khỏi banner `upcoming`
-- (không spam banner mỗi ngày; user online lúc bật vẫn thấy màn chặn qua 503).
-- ============================================================================

ALTER TABLE maintenance_windows
    ADD COLUMN IF NOT EXISTS recurrence_key VARCHAR(64);

-- Mỗi (rule, ngày) chỉ MỘT cửa sổ — enforce ở DB, job materialize idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS uq_maintenance_windows_recurrence
    ON maintenance_windows (recurrence_key) WHERE recurrence_key IS NOT NULL;
