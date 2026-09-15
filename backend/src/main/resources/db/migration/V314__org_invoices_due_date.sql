-- V314 — Hạn thanh toán hoá đơn trung tâm (Q4 owner chốt 07/09/2026, PR-A3b).
--
-- 🔴 THỨ TỰ DEPLOY: tệp này là V314 và PHẢI được áp SAU V313 của PR-A4 (#609, `paused_at`).
-- `spring.flyway.out-of-order = false` trên production, nên nếu V314 lên trước thì lúc V313 tới
-- Flyway sẽ từ chối và backend KHÔNG BOOT. Merge #609 trước PR này. (Cùng ràng buộc như V235.)
--
-- Trang hoá đơn hiện không có cột "đến hạn" nào để hiện, nên trung tâm không biết hoá đơn nào quá
-- hạn và việc đối soát phải làm bằng trí nhớ. Quy tắc owner chốt: hạn = ngày GỬI + 7 ngày; hoá đơn
-- còn ở trạng thái nháp thì KHÔNG có hạn (chưa gửi thì chưa có gì để đến hạn).
ALTER TABLE org_invoices ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ NULL;

-- Backfill cho hoá đơn ĐÃ GỬI mà chưa thanh toán.
--
-- ⚠️ Bảng KHÔNG có cột `sent_at` — không có mốc nào ghi lại thời điểm hoá đơn chuyển sang SENT.
-- `updated_at` là thứ gần nhất còn lại: với hoá đơn đang ở SENT thì lần cập nhật cuối gần như chắc
-- chắn chính là lần gửi. Đây là XẤP XỈ và cố ý ghi rõ ra đây; hoá đơn tạo từ nay trở đi được đặt hạn
-- đúng lúc chuyển trạng thái nên không dùng tới đường xấp xỉ này nữa.
UPDATE org_invoices
   SET due_date = updated_at + INTERVAL '7 days'
 WHERE status = 'SENT'
   AND due_date IS NULL;

-- Truy vấn trang hoá đơn sắp theo hạn và lọc quá hạn; chỉ hoá đơn đã gửi mới có hạn nên chỉ mục
-- riêng phần là đủ và rẻ.
CREATE INDEX IF NOT EXISTS idx_org_invoices_due_date
    ON org_invoices (org_id, due_date)
    WHERE due_date IS NOT NULL;

COMMENT ON COLUMN org_invoices.due_date IS
    'Hạn thanh toán = thời điểm chuyển sang SENT + 7 ngày (Q4, 07/09/2026). NULL với hoá đơn DRAFT. '
    'Dòng backfill dùng updated_at làm xấp xỉ ngày gửi vì bảng không có cột sent_at.';
