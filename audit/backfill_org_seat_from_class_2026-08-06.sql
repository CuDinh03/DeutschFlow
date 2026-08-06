-- Backfill prod: cấp ghế org_members STUDENT cho học viên ĐÃ ở trong lớp của trung tâm
-- nhưng chưa được ghi vào trung tâm đó (trang /v2/org/students đếm 0 dù lớp có học viên).
--
-- CĂN CỨ (2026-08-06): luồng "học viên nhập mã lớp → giáo viên duyệt" (TeacherService.approveJoinRequest)
-- chỉ tạo class_students, KHÔNG tạo org_members và KHÔNG set users.org_id — nên roster/seat của org
-- không thấy các học viên này. Code đã vá (ensureStudentSeat trong OrgMembershipService); script này
-- xử lý dữ liệu đọng lại từ trước.
--
-- QUY TẮC (khớp code vá):
--   1. Chỉ đụng học viên trong lớp có org_id (lớp B2C org_id NULL bỏ qua).
--   2. Học viên đang ACTIVE ở org KHÁC → KHÔNG re-home (liệt kê ở bước soát, xử tay).
--   3. Học viên đã có row org_members ở đúng org (kể cả LEFT/REVOKED) → chỉ kích hoạt lại nếu chưa ACTIVE.
--   4. Chỉ cấp ghế STUDENT cho user có users.role = 'STUDENT' (không hạ giáo viên).
--   5. Đồng bộ users.org_id (bất biến users.org_id == org của membership ACTIVE).
--
-- ⚠️ SOÁT seat_limit TRƯỚC KHI COMMIT: backfill bỏ qua seat-limit gate của code.
--    Nếu số ghế sau backfill vượt organizations.seat_limit (>0) thì dừng lại hỏi owner.

BEGIN;

-- ── Bước 0: soát hiện trạng ────────────────────────────────────────────────
-- Học viên trong lớp org nhưng chưa ACTIVE trong org đó:
SELECT tc.org_id, cs.student_id, u.email, u.role AS platform_role, u.org_id AS user_org_id,
       om.status AS membership_status
FROM class_students cs
JOIN teacher_classes tc ON tc.id = cs.class_id AND tc.org_id IS NOT NULL
JOIN users u            ON u.id = cs.student_id
LEFT JOIN org_members om ON om.org_id = tc.org_id AND om.user_id = cs.student_id
WHERE (om.user_id IS NULL OR om.status <> 'ACTIVE')
GROUP BY tc.org_id, cs.student_id, u.email, u.role, u.org_id, om.status
ORDER BY tc.org_id, cs.student_id;

-- Trường hợp XUNG ĐỘT phải xử tay (đang ACTIVE ở org khác) — nếu có row thì các câu dưới TỰ LOẠI chúng:
SELECT tc.org_id AS class_org, cs.student_id, u.email, om2.org_id AS active_in_other_org
FROM class_students cs
JOIN teacher_classes tc ON tc.id = cs.class_id AND tc.org_id IS NOT NULL
JOIN users u            ON u.id = cs.student_id
JOIN org_members om2    ON om2.user_id = cs.student_id AND om2.status = 'ACTIVE' AND om2.org_id <> tc.org_id
GROUP BY tc.org_id, cs.student_id, u.email, om2.org_id;

-- Soát seat_limit: ghế ACTIVE hiện có + số sẽ thêm, so với hạn mức (0 = không giới hạn):
SELECT o.id AS org_id, o.name, o.seat_limit,
       (SELECT COUNT(*) FROM org_members m WHERE m.org_id = o.id AND m.role = 'STUDENT' AND m.status = 'ACTIVE') AS seats_now,
       (SELECT COUNT(DISTINCT cs.student_id)
          FROM class_students cs
          JOIN teacher_classes tc ON tc.id = cs.class_id AND tc.org_id = o.id
          JOIN users u ON u.id = cs.student_id AND u.role = 'STUDENT'
          LEFT JOIN org_members om ON om.org_id = o.id AND om.user_id = cs.student_id
          WHERE (om.user_id IS NULL OR om.status <> 'ACTIVE')
            AND NOT EXISTS (SELECT 1 FROM org_members x
                            WHERE x.user_id = cs.student_id AND x.status = 'ACTIVE' AND x.org_id <> o.id)
       ) AS seats_to_add
FROM organizations o
ORDER BY o.id;

-- ── Bước 1: kích hoạt lại membership cũ (LEFT/REVOKED) ở đúng org ──────────
UPDATE org_members om
SET role = 'STUDENT', status = 'ACTIVE', left_at = NULL
FROM class_students cs
JOIN teacher_classes tc ON tc.id = cs.class_id AND tc.org_id IS NOT NULL
JOIN users u ON u.id = cs.student_id AND u.role = 'STUDENT'
WHERE om.org_id = tc.org_id AND om.user_id = cs.student_id
  AND om.status <> 'ACTIVE'
  AND NOT EXISTS (SELECT 1 FROM org_members x
                  WHERE x.user_id = cs.student_id AND x.status = 'ACTIVE' AND x.org_id <> tc.org_id);

-- ── Bước 2: chèn membership mới cho học viên chưa từng có row ──────────────
INSERT INTO org_members (org_id, user_id, role, status, joined_at)
SELECT DISTINCT tc.org_id, cs.student_id, 'STUDENT', 'ACTIVE', cs.joined_at
FROM class_students cs
JOIN teacher_classes tc ON tc.id = cs.class_id AND tc.org_id IS NOT NULL
JOIN users u ON u.id = cs.student_id AND u.role = 'STUDENT'
WHERE NOT EXISTS (SELECT 1 FROM org_members om
                  WHERE om.org_id = tc.org_id AND om.user_id = cs.student_id)
  AND NOT EXISTS (SELECT 1 FROM org_members x
                  WHERE x.user_id = cs.student_id AND x.status = 'ACTIVE' AND x.org_id <> tc.org_id)
ON CONFLICT (org_id, user_id) DO NOTHING;

-- ── Bước 3: đồng bộ users.org_id với membership ACTIVE vừa cấp ─────────────
UPDATE users u
SET org_id = om.org_id
FROM org_members om
WHERE om.user_id = u.id AND om.status = 'ACTIVE' AND om.role = 'STUDENT'
  AND u.org_id IS NULL;

-- ── Bước 4: soát lại — kỳ vọng 0 row "trong lớp org mà không có ghế" ───────
SELECT tc.org_id, COUNT(DISTINCT cs.student_id) AS still_missing
FROM class_students cs
JOIN teacher_classes tc ON tc.id = cs.class_id AND tc.org_id IS NOT NULL
JOIN users u ON u.id = cs.student_id AND u.role = 'STUDENT'
LEFT JOIN org_members om ON om.org_id = tc.org_id AND om.user_id = cs.student_id AND om.status = 'ACTIVE'
WHERE om.user_id IS NULL
GROUP BY tc.org_id;

-- Chỉ COMMIT khi: bước 0 không lộ xung đột bất ngờ, seat_limit không bị vượt, bước 4 trả 0 row
-- (hoặc chỉ còn đúng các case xung đột đã biết). Ngược lại: ROLLBACK;
COMMIT;
