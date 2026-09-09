-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- Cổng kiểm TRƯỚC KHI VIẾT V317 — DEC-13 "admin nền tảng không bao giờ là thành viên trung tâm".
-- CHỈ ĐỌC. Một câu SELECT, không ghi, không đổi gì trên production.
--
-- Chạy:  ~/Developer/deutschflow-tools/run-ct01-admin-membership-gate.sh
--
-- Đọc kết quả:
--   ✅ 0 dòng  → prod sạch. V317 chỉ cần trigger chặn, KHÔNG cần bước dọn dữ liệu.
--   ⛔ có dòng → PHẢI quyết cách dọn TRƯỚC khi viết migration, vì V317 dự kiến RAISE EXCEPTION
--                khi thấy dữ liệu vi phạm ⇒ để nguyên là chặn cả chuyến deploy.
--
-- 🔴 Nếu có dòng nào `org_role = 'OWNER'`: KHÔNG có đường phục hồi trong sản phẩm —
--    removeMember và selfLeave đều từ chối mọi OWNER, transferOwnership chỉ chính OWNER đó gọi
--    được. Owner phải chỉ định người thay TRƯỚC, rồi V317 mới chuyển quyền được.
--
-- Hai nguồn được soi tách bạch vì chúng có thể lệch nhau: `org_members` là bảng quyền thật mà
-- OrgGuard đọc; `users.org_id` là bản sao nhanh mà controller dùng để suy ngữ cảnh trung tâm.
-- Một migration cũ (V234:71) ghi thẳng `users.org_id` không qua OrgMembershipService, nên chốt
-- chặn ở tầng Java không bảo đảm được bản sao này sạch.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

SELECT 'org_members'                        AS nguon,
       u.id                                 AS user_id,
       u.email                              AS email,
       u.role                                AS platform_role,
       m.org_id                             AS org_id,
       o.name                               AS org_name,
       m.role                               AS org_role,
       m.status                             AS status,
       m.joined_at                          AS joined_at
  FROM org_members m
  JOIN users u          ON u.id = m.user_id
  JOIN organizations o  ON o.id = m.org_id
 WHERE u.role = 'ADMIN'

UNION ALL

SELECT 'users.org_id'                       AS nguon,
       u.id                                 AS user_id,
       u.email                              AS email,
       u.role                                AS platform_role,
       u.org_id                             AS org_id,
       o.name                               AS org_name,
       CAST(NULL AS VARCHAR)                AS org_role,
       CAST(NULL AS VARCHAR)                AS status,
       CAST(NULL AS TIMESTAMPTZ)            AS joined_at
  FROM users u
  LEFT JOIN organizations o ON o.id = u.org_id
 WHERE u.role = 'ADMIN'
   AND u.org_id IS NOT NULL

 ORDER BY 1, 2;
