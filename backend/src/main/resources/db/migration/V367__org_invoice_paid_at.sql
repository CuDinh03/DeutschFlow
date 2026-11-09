-- Đợt 1 tối ưu admin (09/11/2026): mốc ĐÃ THU TIỀN của hoá đơn B2B.
--
-- Báo cáo doanh thu admin cộng hoá đơn trung tâm có status PAID theo THÁNG THU TIỀN (giờ VN), nên
-- cần một mốc thời gian đáng tin. updated_at không dùng được: sửa ghi chú sau khi thu cũng làm nó đổi.
-- Từ nay OrgBillingService (đổi tay) và SepayWebhookService (tự khớp chuyển khoản) gán paid_at đúng
-- lúc chuyển sang PAID.
ALTER TABLE org_invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Backfill hoá đơn đã PAID trước migration này: ưu tiên lúc SePay ghi nhận chuyển khoản khớp hoá
-- đơn; không có (đổi tay) thì lấy updated_at — có thể lệch tháng nếu hoá đơn bị sửa sau khi thu.
UPDATE org_invoices i
SET paid_at = COALESCE(
        (SELECT MIN(e.created_at)
         FROM org_payment_events e
         WHERE e.invoice_id = i.id AND e.matched),
        i.updated_at)
WHERE i.status = 'PAID'
  AND i.paid_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_org_invoices_paid_at ON org_invoices (paid_at) WHERE status = 'PAID';
