-- ============================================================================
-- REMEDIATION.md — Mục 6 "Cần xác minh thêm": các query chạy TRÊN PROD DB
-- Chạy read-only. Không sửa dữ liệu. Đọc kỹ phần lưu ý multi-org ở mỗi query.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- ITEM 3 — Timezone server DB (M-3)
-- LƯU Ý: sau khi M-3 đã sửa code dùng `AT TIME ZONE 'Asia/Ho_Chi_Minh'` tường minh,
-- giá trị này KHÔNG còn ảnh hưởng tới mốc reset org-pool. Query chỉ để biết, không
-- còn là rủi ro. Nếu trả 'UTC' thì các cột timestamp khác (không AT TIME ZONE) vẫn theo UTC.
-- ----------------------------------------------------------------------------
SHOW timezone;


-- ----------------------------------------------------------------------------
-- ITEM 5 — monthly_token_pool mặc định = 0 (org-pool enforcement đang no-op?)
-- Nếu MỌI org đều pool = 0 → org-pool enforcement hiện no-op cho tất cả, và
-- M-5 backdoor (org member dùng PPTX/OCR đắt miễn phí) đang mở rộng.
-- Đây là dữ liệu đầu vào để chốt M-5 (CHECKPOINT 1).
-- ----------------------------------------------------------------------------
SELECT
    COUNT(*)                                              AS total_orgs,
    COUNT(*) FILTER (WHERE monthly_token_pool > 0)        AS orgs_with_pool_set,
    COUNT(*) FILTER (WHERE monthly_token_pool = 0)        AS orgs_pool_zero_unlimited,
    COUNT(*) FILTER (WHERE plan_code IS NOT NULL)         AS orgs_with_plan_code
FROM organizations;

-- Phân bố plan_code thực tế của org (ứng viên nguồn-sự-thật "unlimited hợp lệ" cho M-5).
-- Nếu cột này NULL hết → không có tín hiệu "đã mua unlimited" nào để backfill an toàn.
SELECT plan_code, COUNT(*) AS n,
       COUNT(*) FILTER (WHERE monthly_token_pool > 0) AS with_pool_set
FROM organizations
GROUP BY plan_code
ORDER BY n DESC;


-- ----------------------------------------------------------------------------
-- ITEM 6 — Drift giữa users.org_id và org_members (T-1/D-1)
--
-- LƯU Ý MULTI-ORG (quan trọng — theo phản hồi của bạn):
--   Nếu hệ thống CHO PHÉP một user thuộc nhiều org thì users.org_id chỉ là "org chính",
--   và việc user có membership ở org khác KHÔNG phải drift. Vì vậy KHÔNG so trực tiếp
--   users.org_id == org_members.org_id. Thay vào đó định nghĩa drift = "user có org_id
--   nhưng KHÔNG có BẤT KỲ membership ACTIVE nào khớp đúng org_id đó".
--   (org_members.id là composite key → cột là id_org_id / id_user_id tuỳ @Embeddable;
--    chỉnh tên cột cho khớp schema thật nếu cần.)
--
-- BƯỚC 1 — Đếm magnitude TRƯỚC khi soi từng dòng (theo gợi ý của bạn):
--   gần 0  → nền móng sạch, M-5/D-3 đứng vững.
--   lớn    → phải chốt "nguồn sự thật membership là cột hay bảng" trước, vì nó là input
--            cho cả M-5 (định nghĩa unlimited) lẫn D-3 (snapshot seats).
-- ----------------------------------------------------------------------------
SELECT drift_type, COUNT(*) AS n
FROM (
    -- Case 1: user.org_id trỏ tới org mà user KHÔNG có membership ACTIVE khớp
    SELECT u.id AS user_id, 'org_id_without_active_membership' AS drift_type
    FROM users u
    WHERE u.org_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM org_members m
          WHERE m.user_id = u.id
            AND m.org_id  = u.org_id
            AND m.status  = 'ACTIVE'
      )

    UNION ALL

    -- Case 2: user có membership ACTIVE nhưng users.org_id = NULL (quota sẽ bỏ sót org)
    SELECT m.user_id, 'active_membership_but_null_org_id' AS drift_type
    FROM org_members m
    JOIN users u ON u.id = m.user_id
    WHERE m.status = 'ACTIVE'
      AND u.org_id IS NULL
) t
GROUP BY drift_type;

-- BƯỚC 2 — chi tiết (chỉ chạy nếu magnitude > 0, để soi tay):
SELECT u.id AS user_id, u.email, u.org_id AS users_org_id,
       m.org_id AS member_org_id, m.role, m.status
FROM users u
LEFT JOIN org_members m ON m.user_id = u.id AND m.status = 'ACTIVE'
WHERE (u.org_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM org_members x
                        WHERE x.user_id = u.id AND x.org_id = u.org_id AND x.status = 'ACTIVE'))
   OR (u.org_id IS NULL AND m.user_id IS NOT NULL)
ORDER BY u.id
LIMIT 200;
