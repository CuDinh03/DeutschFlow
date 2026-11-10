-- V378: Hạn mức AI gói PRO — 200.000 token/ngày, cộng dồn tối đa 7 ngày.
--
-- Quyết định owner 10/11/2026 (sau audit quota): trước đây PRO cấp 400.000 token/ngày và cho cộng dồn
-- 30 ngày (ví tối đa 12 triệu). Ở giá gpt-oss-120b hiện tại (~7.100đ / 1 triệu token) trần chi phí AI
-- là ~85.000đ/tháng cho gói 299.000đ, và người dùng có thể để dành rồi đốt 12 triệu token trong một
-- ngày. Mức mới: trần ~43.000đ/tháng, ví tối đa 1,4 triệu; 200.000 token/ngày vẫn gấp đôi một ngày
-- học nặng (3 buổi nói + 3 bài viết + 1 phỏng vấn ≈ 97.000 token).
--
-- Trial 7 ngày hưởng theo dòng PRO nên cũng nhận mức mới (tối đa 1,4 triệu token thay vì 2,8 triệu).
-- Subscription có monthly_token_limit_override giữ mức cấp ngày riêng; chỉ trần cộng dồn đổi theo.
--
-- Không cần sửa user_ai_token_wallets: mọi đường cộng ví đều kẹp số dư về walletCap mới
-- (QuotaService.computeAccruedWalletBalance / accrueWalletThroughToday), nên ví đang vượt 1,4 triệu
-- tự về trần ở lần đọc/ghi kế tiếp. Chỉ sửa dữ liệu, không đổi schema — tương thích ngược khi blue-green.
--
-- monthly_token_limit của PRO là cột di sản soi theo mức cấp ngày (chỉ màn admin đọc); giữ đồng bộ.
UPDATE subscription_plans
SET daily_token_grant   = 200000,
    wallet_cap_days     = 7,
    monthly_token_limit = 200000
WHERE code = 'PRO';
