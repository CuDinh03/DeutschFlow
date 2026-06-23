-- ============================================================================
-- M-5 DEPLOY GATE — #126 (pool_unlimited). Chạy quanh lúc deploy V237.
-- Mục tiêu: TRƯỚC khi V237 bật free-tier cap cho org member pool=0 (mặc định =
-- TẤT CẢ org, vì không chỗ nào set pool), xác định org nào HỢP LỆ unlimited rồi
-- set cờ, để họ KHÔNG bị cap đột ngột (PPTX 2/ngày, OCR 5/ngày).
--
-- THỨ TỰ:
--   1) (NGAY BÂY GIỜ, read-only) Chạy STEP A + B → xem inventory, chốt danh sách ID hợp lệ.
--   2) Deploy backend (#126 + V237).  [cột pool_unlimited chỉ tồn tại SAU bước này]
--   3) (TRONG cửa sổ deploy) Chạy STEP C để set cờ cho các ID đã chốt → STEP D verify.
-- Lưu ý: STEP A/B KHÔNG tham chiếu pool_unlimited (cột chưa tồn tại trước V237).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- STEP A — Tổng hợp (giống ITEM 5 cũ): bao nhiêu org đang pool=0 sẽ bị cap?
-- ----------------------------------------------------------------------------
SELECT
    COUNT(*)                                        AS total_orgs,
    COUNT(*) FILTER (WHERE monthly_token_pool > 0)  AS orgs_metered_pool_set,   -- sẽ KHÔNG bị cap (OrgPoolGuard lo)
    COUNT(*) FILTER (WHERE monthly_token_pool = 0)  AS orgs_pool_zero_WILL_CAP, -- sẽ BỊ cap sau V237 nếu không set unlimited
    COUNT(*) FILTER (WHERE plan_code IS NOT NULL)   AS orgs_with_plan_code
FROM organizations;


-- ----------------------------------------------------------------------------
-- STEP B — Inventory TỪNG org (đây là cái để bạn QUYẾT định cờ unlimited).
-- Đọc cột effect_after_deploy: 'WILL BE CAPPED' = org member sẽ bị giới hạn
-- PPTX/OCR sau deploy trừ khi bạn set pool_unlimited=true HOẶC đặt pool>0.
-- ----------------------------------------------------------------------------
SELECT
    o.id,
    o.name,
    o.plan_code,
    o.monthly_token_pool                              AS pool,
    CASE WHEN o.monthly_token_pool > 0 THEN 'metered (ok, no cap)'
         ELSE 'WILL BE CAPPED after V237'             END AS effect_after_deploy,
    o.seat_limit,
    o.status,
    COUNT(m.user_id) FILTER (WHERE m.status = 'ACTIVE')                          AS active_members,
    COUNT(m.user_id) FILTER (WHERE m.status = 'ACTIVE' AND m.role = 'TEACHER')   AS teachers,
    COUNT(m.user_id) FILTER (WHERE m.status = 'ACTIVE' AND m.role = 'STUDENT')   AS students,
    o.valid_until
FROM organizations o
LEFT JOIN org_members m ON m.org_id = o.id
GROUP BY o.id, o.name, o.plan_code, o.monthly_token_pool, o.seat_limit, o.status, o.valid_until
ORDER BY active_members DESC, o.id;


-- ----------------------------------------------------------------------------
-- STEP B2 (tuỳ chọn) — Ai THỰC SỰ sẽ cảm nhận cap? org member đã dùng PPTX/OCR
-- gần đây (30 ngày). Org nào xuất hiện ở đây + pool=0 → ưu tiên cân nhắc set cờ.
-- ----------------------------------------------------------------------------
SELECT o.id AS org_id, o.name, f.feature,
       COUNT(DISTINCT f.user_id) AS users_using,
       SUM(f.count)              AS total_uses_30d
FROM free_tier_usage f
JOIN users u       ON u.id = f.user_id
JOIN org_members m ON m.user_id = u.id AND m.status = 'ACTIVE'
JOIN organizations o ON o.id = m.org_id
WHERE f.usage_date >= CURRENT_DATE - INTERVAL '30 days'
  AND f.feature IN ('PPTX', 'OCR_GRADE')
  AND o.monthly_token_pool = 0
GROUP BY o.id, o.name, f.feature
ORDER BY total_uses_30d DESC;


-- ============================================================================
-- ===  CHỈ CHẠY SAU KHI V237 ĐÃ ÁP (cột pool_unlimited tồn tại)  ============
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP C — Set cờ unlimited cho các org HỢP LỆ. THAY danh sách id bằng kết quả STEP B.
--   • Org trả tiền/đối tác đã hứa unlimited  → cho vào đây.
--   • Org nội bộ/demo muốn không bị chặn     → cho vào đây.
--   • Mọi org còn lại                         → KHÔNG đụng = bị cap (đúng chủ đích).
--     (Hoặc đặt pool>0 nếu muốn metered thay vì cap: SET monthly_token_pool = <n>.)
-- An toàn: chạy trong transaction, xem RETURNING trước khi COMMIT.
-- ----------------------------------------------------------------------------
BEGIN;
UPDATE organizations
SET pool_unlimited = true,
    updated_at     = now()
WHERE id IN ( /*  ←—— ĐIỀN id từ STEP B, ví dụ: 1, 5, 12  */ )
RETURNING id, name, plan_code, monthly_token_pool, pool_unlimited;
-- Kiểm tra dòng RETURNING đúng ý → COMMIT;  (sai → ROLLBACK;)
COMMIT;


-- ----------------------------------------------------------------------------
-- STEP D — Verify cuối: bức tranh cap/unlimited/metered sau khi set.
-- ----------------------------------------------------------------------------
SELECT id, name, plan_code, monthly_token_pool AS pool, pool_unlimited,
       CASE WHEN pool_unlimited        THEN 'unlimited (bypass)'
            WHEN monthly_token_pool > 0 THEN 'metered'
            ELSE 'free-tier capped'    END AS final_state
FROM organizations
ORDER BY id;

-- ----------------------------------------------------------------------------
-- ALT (thay STEP C bằng API, nếu app đã chạy #126 và bạn có ADMIN JWT):
--   curl -X PATCH https://api.mydeutschflow.com/api/admin/organizations/<ID> \
--        -H "Authorization: Bearer <ADMIN_JWT>" \
--        -H "Content-Type: application/json" \
--        -d '{"poolUnlimited": true}'
-- Hoặc UI: Admin → Tổ chức → mở org → bật unlimited.
-- ----------------------------------------------------------------------------
