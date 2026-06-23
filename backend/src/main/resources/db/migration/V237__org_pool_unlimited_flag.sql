-- M-5: tách ngữ nghĩa nhập nhằng của sentinel `monthly_token_pool = 0`.
--
-- TRƯỚC: pool = 0 mang HAI nghĩa cùng lúc — "chưa cấu hình" và "unlimited có chủ đích".
--        Hệ quả: org member bỏ qua FreeTierGuard (PPTX/OCR) + OrgPoolGuard no-op khi pool=0
--        → dùng AI đắt KHÔNG giới hạn, miễn phí (backdoor).
--
-- SAU:  thêm cờ tường minh `pool_unlimited`. Bảng quyết định cho org member:
--        pool_unlimited = true              → unlimited THẬT (bypass cap)
--        pool_unlimited = false & pool = 0   → áp free-tier cap (đóng backdoor) ← DEFAULT fail-safe
--        pool_unlimited = false & pool > 0   → metered theo org pool (OrgPoolGuard)
--
-- BACKFILL: KHÔNG ai (CHECKPOINT 1 đã duyệt — "tập rỗng + opt-in tường minh").
--   Không tồn tại tín hiệu "đã mua unlimited" đáng tin trong dữ liệu (nothing sets pool;
--   plan_code nullable; invoice không có tier). DEFAULT false = mọi org bị cap cho tới khi
--   platform-admin BẬT cờ có chủ đích qua API (PATCH /api/admin/organizations/{id}).
--   ⚠️ Trước khi deploy: chạy audit/prod_verify_section6.sql (ITEM 5) + set pool_unlimited=true
--      cho các org unlimited hợp lệ, nếu không họ sẽ bị cap sau deploy.

ALTER TABLE organizations
    ADD COLUMN pool_unlimited BOOLEAN NOT NULL DEFAULT false;
