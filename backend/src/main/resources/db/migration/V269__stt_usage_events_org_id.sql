-- M-4 (audit B2B 2026-07-04): stt_usage_events thiếu org_id → STT COGS (driver COGS lặp lớn nhất
-- của AI-Speaking, Whisper tính theo giây) không quy được về từng tenant. Thêm cột + backfill +
-- partial index; từ nay AiUsageLedgerService.recordStt ghi org_id ngay tại event (resolve qua
-- org_members ACTIVE — cùng nguồn tenant với gate, xem M-5).

ALTER TABLE stt_usage_events
    ADD COLUMN org_id BIGINT REFERENCES organizations(id);

COMMENT ON COLUMN stt_usage_events.org_id IS
    'Tenant tại thời điểm phát sinh event (M-4). Backfill lịch sử từ users.org_id; event mới ghi theo org_members ACTIVE.';

-- Backfill lịch sử: nguồn duy nhất có dữ liệu thời-điểm-cũ là users.org_id (org_members không lưu
-- lịch sử membership). Chấp nhận xấp xỉ "org hiện tại của user" cho event cũ — báo cáo COGS theo
-- tenant chỉ cần đúng từ nay về sau; dữ liệu cũ mang tính tham khảo.
UPDATE stt_usage_events e
   SET org_id = u.org_id
  FROM users u
 WHERE u.id = e.user_id
   AND u.org_id IS NOT NULL
   AND e.org_id IS NULL;

-- Partial index cho truy vấn COGS theo tenant (bỏ qua khối B2C org_id NULL chiếm đa số).
CREATE INDEX IF NOT EXISTS idx_stt_usage_events_org
    ON stt_usage_events (org_id, created_at)
    WHERE org_id IS NOT NULL;
