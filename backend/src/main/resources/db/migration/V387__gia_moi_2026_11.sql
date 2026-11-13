-- V387: Giá B2C mới + bộ sản phẩm App Store mới (owner chốt 14/11/2026, QĐ-QG-17..20).
--
--   PRO   = Pro tháng 249.000đ (1 tháng) và Pro 2 tháng 399.000đ (gói chính); 200.000 token/ngày (V378, QĐ-QG-12).
--   ULTRA = "Tăng tốc" 2 tháng 599.000đ: quyền bằng đúng PRO, chỉ khác 400.000 token/ngày. Đảo QĐ-QG-16
--           (tắt ULTRA). features_json không chặn quyền nào trong code (chỉ màn admin đọc), nên chỉ chép
--           của PRO cho khỏi hứa tính năng cũ (voiceClone, priorityQueue, huy hiệu vàng).
--
-- Thời hạn của thuê bao Apple lấy theo expiresDate của Apple, không theo duration_months; cột này chỉ là
-- siêu dữ liệu (payment_transactions, GET /payments/apple/products). Giá Apple đặt ở App Store Connect.
--
-- Chỉ sửa dữ liệu, không đổi schema — tương thích ngược khi blue-green. Production chưa có thuê bao trả
-- tiền (kiểm 14/11), nên ngừng 4 sản phẩm cũ không ảnh hưởng ai.

-- 1. PRO: giá tháng mới (cột price_vnd chỉ dùng cho thanh toán web — đang tắt).
UPDATE subscription_plans
SET price_vnd     = 249000,
    features_json = jsonb_set(COALESCE(features_json, '{}'::jsonb), '{priceVnd}', '249000'::jsonb)
WHERE code = 'PRO';

-- 2. ULTRA → Tăng tốc. UPSERT vì trên DB dựng mới (replay) dòng ULTRA chỉ được V189 chèn với
--    daily_token_grant = 0 — các UPDATE ở V42/V73 chạy trước khi dòng tồn tại.
INSERT INTO subscription_plans (code, name, monthly_token_limit, daily_token_grant, wallet_cap_days,
                                features_json, is_active, price_vnd, duration_months)
SELECT 'ULTRA', 'Tăng tốc', 400000, 400000, 30,
       jsonb_set(COALESCE(p.features_json, '{}'::jsonb), '{priceVnd}', '599000'::jsonb),
       TRUE, 599000, 2
FROM subscription_plans p
WHERE p.code = 'PRO'
ON CONFLICT (code) DO UPDATE
SET name                = EXCLUDED.name,
    monthly_token_limit = EXCLUDED.monthly_token_limit,
    daily_token_grant   = EXCLUDED.daily_token_grant,
    wallet_cap_days     = EXCLUDED.wallet_cap_days,
    features_json       = EXCLUDED.features_json,
    is_active           = EXCLUDED.is_active,
    price_vnd           = EXCLUDED.price_vnd,
    duration_months     = EXCLUDED.duration_months;

-- 3. App Store: bộ ID mới (QĐ-QG-20). ID phải khớp TỪNG KÝ TỰ với App Store Connect và
--    mobile/lib/iapProducts.ts; cả ba là thuê bao tự gia hạn cùng một nhóm.
UPDATE apple_products SET is_active = FALSE WHERE product_id LIKE 'com.deutschflow.app.%';

INSERT INTO apple_products (product_id, plan_code, duration_months, is_active) VALUES
    ('com.cudinh.mydeutschflow.pro.monthly',     'PRO',   1, TRUE),
    ('com.cudinh.mydeutschflow.pro.twomonths',   'PRO',   2, TRUE),
    ('com.cudinh.mydeutschflow.boost.twomonths', 'ULTRA', 2, TRUE)
ON CONFLICT (product_id) DO UPDATE
SET plan_code       = EXCLUDED.plan_code,
    duration_months = EXCLUDED.duration_months,
    is_active       = TRUE;
