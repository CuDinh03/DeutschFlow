-- V378: Hạn mức AI gói PRO — 200.000 token/ngày (trước: 400.000). Trần cộng dồn giữ nguyên 30 ngày.
--
-- Quyết định owner 10/11/2026 (sau audit quota). Ở giá gpt-oss-120b hiện tại (~7.100đ / 1 triệu token)
-- trần chi phí AI của PRO là ~85.000đ/tháng cho gói 299.000đ; mức mới đưa về ~43.000đ/tháng.
-- 200.000 token/ngày vẫn gấp đôi một ngày học nặng (3 buổi nói + 3 bài viết + 1 phỏng vấn ≈ 97.000).
--
-- wallet_cap_days KHÔNG đổi (30): gói PRO bán theo kỳ 30 ngày, token ngày nào chưa dùng được giữ tới
-- hết kỳ — ví tối đa 30 × 200.000 = 6 triệu (trước: 12 triệu).
--
-- Trial 7 ngày hưởng theo dòng PRO nên cũng nhận mức mới (tối đa 1,4 triệu token thay vì 2,8 triệu).
-- Subscription có monthly_token_limit_override giữ mức cấp ngày riêng, không bị ảnh hưởng.
--
-- Không cần sửa user_ai_token_wallets: mọi đường cộng ví đều kẹp số dư về walletCap mới
-- (QuotaService.computeAccruedWalletBalance / accrueWalletThroughToday), nên ví đang vượt 6 triệu
-- tự về trần ở lần đọc/ghi kế tiếp. Chỉ sửa dữ liệu, không đổi schema — tương thích ngược khi blue-green.
--
-- monthly_token_limit của PRO là cột di sản soi theo mức cấp ngày (chỉ màn admin đọc); giữ đồng bộ.
UPDATE subscription_plans
SET daily_token_grant   = 200000,
    monthly_token_limit = 200000
WHERE code = 'PRO';
