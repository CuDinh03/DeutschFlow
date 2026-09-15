-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- Cổng kiểm TRƯỚC KHI VIẾT migration trigger — DEC-13 "admin nền tảng không bao giờ là thành viên
-- trung tâm". CHỈ ĐỌC. Một câu SELECT, không ghi, không đổi gì trên production.
--
-- ✅ Đã chạy trên production 10/09/2026 ~13:40: PASS, 0 dòng — V318 đã áp trigger
--    (V318__block_platform_admin_org_membership.sql; số V317 rốt cuộc dùng cho backfill sổ hoạt động).
--    Script vẫn có ích để soi định kỳ: V318 KHÔNG gắn trigger lên `users.org_id` (bản sao nhanh, không
--    phải cổng), nên nguồn thứ hai bên dưới vẫn có thể lệch mà không bị DB chặn.
--
-- Chạy:  ~/Developer/deutschflow-tools/run-ct01-admin-membership-gate.sh
--
-- Đọc kết quả:
--   ✅ 0 dòng  → prod sạch. Migration trigger chỉ cần chặn, KHÔNG cần bước dọn dữ liệu.
--   ⛔ có dòng → PHẢI quyết cách dọn TRƯỚC, vì V318 RAISE EXCEPTION ở tiền điều kiện khi thấy dữ liệu
--                vi phạm ⇒ để nguyên là chặn cả chuyến deploy (áp lại lên môi trường bẩn cũng vậy).
--
-- 🔴 Nếu có dòng nào `org_role = 'OWNER'`: KHÔNG có đường phục hồi trong sản phẩm —
--    removeMember và selfLeave đều từ chối mọi OWNER, transferOwnership chỉ chính OWNER đó gọi
--    được. Owner phải chỉ định người thay TRƯỚC, rồi migration mới chuyển quyền được.
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
