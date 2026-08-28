-- V287 — Backfill user_subscriptions.source + biến nó thành bắt buộc.
--
-- Cột `source` ĐÃ CÓ từ V189 (Apple IAP) nhưng nullable và chỉ được ghi bởi đường
-- thanh toán. Mọi gói do provisioner cấp — trial PRO 7 ngày lúc đăng ký, và gói
-- DEFAULT sau khi hết hạn — đều để NULL. Vì thế hôm nay KHÔNG có cách nào phân biệt
-- "PRO vì đang dùng thử" với "PRO vì đã trả tiền" ngoài việc đoán qua độ dài kỳ hạn.
--
-- Ba quyết định của owner (28/08) đều cần phân biệt đó:
--   Q1 trial chỉ cấp cho tài khoản vừa đăng ký;
--   Q2 ví cạn giữa trial thì KHÔNG hạ gói (chờ grant hôm sau);
--   Q3 ngày 8 thì trial kết thúc hẳn + xoá ví, còn gói TRẢ PHÍ vẫn giữ grace-drain.
-- Không có `source`, nhánh Q2/Q3 sẽ áp nhầm luật của trial lên người đã trả tiền.

-- 1) Trial do provisioner cấp: PRO/FREE, kỳ hạn đúng 7 ngày, và KHÔNG có giao dịch
--    thanh toán nào của user đó. Điều kiện cuối là thứ tránh gán nhầm cho người mua
--    gói ngắn ngày.
UPDATE user_subscriptions us
   SET source = 'TRIAL'
 WHERE us.source IS NULL
   AND us.plan_code IN ('PRO', 'FREE')
   AND us.ends_at IS NOT NULL
   AND us.ends_at - us.starts_at BETWEEN INTERVAL '6 days 12 hours' AND INTERVAL '7 days 12 hours'
   AND NOT EXISTS (
       SELECT 1 FROM payment_transactions pt
        WHERE pt.user_id = us.user_id
          AND pt.status = 'SUCCESS'
   );

-- 2) Gói DEFAULT không phải trial, cũng không phải mua: nó là trạng thái nền.
UPDATE user_subscriptions
   SET source = 'DEFAULT'
 WHERE source IS NULL
   AND plan_code = 'DEFAULT';

-- 3) Phần còn lại (gói trả phí đời cũ, gói admin cấp tay) không đủ dữ kiện để đoán.
--    Gán UNKNOWN và ĐỂ NGUYÊN như vậy: đoán bừa ở đây nghĩa là Q3 có thể xoá ví của
--    một người đã trả tiền.
UPDATE user_subscriptions SET source = 'UNKNOWN' WHERE source IS NULL;

ALTER TABLE user_subscriptions ALTER COLUMN source SET DEFAULT 'UNKNOWN';
ALTER TABLE user_subscriptions ALTER COLUMN source SET NOT NULL;

COMMENT ON COLUMN user_subscriptions.source IS
    'Ai tạo ra quyền lợi này: TRIAL (provisioner lúc đăng ký) | IAP | SEPAY | DEFAULT (gói nền) | ADMIN | UNKNOWN (đời cũ, không đoán được). Q2/Q3 rẽ nhánh theo cột này — gán sai là áp luật trial lên người đã trả tiền.';
