-- Gói 0 PR-0A (DEC-13 / ORG-18, owner chốt 09/09/2026) — CHỐT TẦNG DB: tài khoản `users.role = 'ADMIN'`
-- (admin nền tảng) KHÔNG BAO GIỜ là thành viên trung tâm.
--
-- Vì sao cần chốt DB dù commit 4c72f56c đã đặt 5 guard Java (OrgMembershipService.upsertMember +
-- ensureStudentSeat, AdminOrgService.addMember + attachOwner, OrgRosterRowImporter) và
-- AdminManagementService.updateUserRole chặn chiều ngược (nâng người đang có membership lên ADMIN):
--   • Guard Java chỉ phủ đường đi QUA service. Tiền lệ có thật ngay trong repo: V234:62-71 ghi THẲNG
--     `org_members` (INSERT … ON CONFLICT DO UPDATE) và `users.org_id` bằng SQL thô, không qua
--     OrgMembershipService. Một migration/psql/JdbcTemplate/`memberRepo.save(...)` sau này làm y vậy
--     với một tài khoản ADMIN thì guard Java không thấy gì.
--   • Hệ quả nếu lọt (4c72f56c): MỘT dòng org_members là mở trọn console /api/org/** (OrgGuard chỉ
--     đọc org_members), lượt dùng AI của admin bị trừ vào pool token của trung tâm, và nếu ở vai OWNER
--     thì KHÔNG AI gỡ được (removeMember/selfLeave từ chối mọi OWNER, transferOwnership chỉ chính
--     OWNER đó gọi được).
--
-- Cổng kiểm ct01 (backend/scripts/ct01-check-admin-org-membership.sql, chỉ đọc) đã chạy trên PRODUCTION
-- ngày 10/09/2026 ~13:40: PASS, 0 dòng — không admin nào có dòng org_members, users.org_id của mọi
-- admin đều NULL. ⇒ Migration này CHỈ gắn trigger chặn, KHÔNG có bước dọn dữ liệu. Khối DO đầu tiên
-- khẳng định lại tiền điều kiện ấy đúng lúc áp: trên một môi trường bẩn nó ném và chuyến deploy DỪNG —
-- có chủ đích, vì dọn thế nào (đặc biệt với vai OWNER) là quyết định của owner, không phải của migration.
--
-- Hai trigger = hai chiều của cùng một bất biến:
--   (1) trg_org_members_no_platform_admin — BEFORE INSERT OR UPDATE OF user_id, status ON org_members:
--       không dòng org_members nào được trỏ tới một user đang là ADMIN — BẤT KỂ status. DEC-13 nói
--       "không bao giờ là thành viên", nên kể cả một bia mộ LEFT/REVOKED cũng không được sinh ra cho
--       admin; `UPDATE OF status` bịt luôn đường làm sống lại bia mộ cũ của người vừa được nâng lên ADMIN.
--   (2) trg_users_no_admin_with_membership — BEFORE UPDATE OF role ON users: không nâng một user lên
--       ADMIN khi họ còn membership ACTIVE. Cùng ngữ nghĩa với OrgMembershipService.hasActiveMembership
--       mà AdminManagementService.updateUserRole dùng: đã rời trung tâm (LEFT/REVOKED) thì vẫn nâng được,
--       và sau khi nâng, trigger (1) giữ cho bia mộ đó không bao giờ ACTIVE trở lại.
--
-- 🔴 Mệnh đề WHEN của trigger (2) là BẮT BUỘC, không phải tối ưu. Hibernate KHÔNG dùng @DynamicUpdate:
--    mọi `userRepository.save(user)` phát ra `UPDATE users SET <TẤT CẢ cột>, role = ?, … WHERE id = ?`,
--    tức `UPDATE OF role` KHÔNG lọc được gì trước Hibernate (cột role luôn có mặt trong SET dù giá trị
--    không đổi). Thiếu WHEN, thân hàm chạy ở MỌI lần lưu user: đổi push token, đặt lại mật khẩu, cập
--    nhật streak, đăng nhập… Với WHEN `(NEW.role = 'ADMIN' AND OLD.role IS DISTINCT FROM NEW.role)`
--    Postgres loại ngay ở tầng trigger; thân hàm chỉ chạy đúng lúc CÓ phép nâng lên ADMIN. `UPDATE OF
--    role` vẫn giữ để câu UPDATE thô không đụng role (kiểu V230 `SET created_via`, V204 `SET org_id`)
--    được bỏ qua sớm hơn nữa. Lưu ý WHEN chỉ so 'ADMIN': OWNER/MANAGER cũng là giá trị của users.role
--    (V235) và HỢP LỆ khi có membership — syncPlatformRole ghi chúng thường xuyên, không được chặn.
--
-- Vì sao KHÔNG cần `WHEN (pg_trigger_depth() = 0)` (bài học V319, bảng student_consents): V319 chặn
-- UPDATE OR DELETE, mà Postgres thi hành `ON DELETE CASCADE` bằng `DELETE FROM ONLY …` và
-- `ON DELETE SET NULL` bằng `UPDATE ONLY …` — nên trigger ấy khoá cứng luôn việc xoá user. Hai trigger
-- ở đây thì khác:
--   • không bắt DELETE ⇒ `DELETE FROM users` / `DELETE FROM organizations` vẫn CASCADE xuống org_members
--     bình thường (PlatformAdminOrgMembershipTriggerIntegrationTest chứng minh trên Postgres thật);
--   • org_members chỉ có hai khoá ngoại — org_id, user_id (V204) — cả hai ON DELETE CASCADE; KHÔNG có
--     cột nào ON DELETE SET NULL trỏ tới users (đã rà V204/V226/V229/V316: các cột còn lại là role,
--     status, joined_at, left_at, can_teach — không phải FK) ⇒ không có `UPDATE ONLY org_members` nào
--     do FK sinh ra. Và dù mai sau có, (1) chỉ bắt UPDATE OF user_id, status và chỉ soi NEW.user_id;
--   • trigger (2) chỉ bắt UPDATE OF role ⇒ mọi `UPDATE ONLY users SET <fk> = NULL` do FK từ bảng khác
--     (ON DELETE SET NULL trỏ tới users) không đi qua nó.
--
-- Vì sao ERRCODE = check_violation (23514) chứ không mã tự đặt kiểu 'DF001': Spring dịch lớp 23 thành
-- DataIntegrityViolationException và GlobalExceptionHandler map thành 409 "Vi phạm ràng buộc dữ liệu";
-- một mã ngoài danh sách rơi vào UncategorizedSQLException → 500 "ERR-x" và một cảnh báo giả trong
-- alert. Về bản chất đây đúng là ràng buộc toàn vẹn — chỉ khác CHECK thường ở chỗ soi hai bảng. Dấu
-- vết để grep log nằm trong thông điệp: 'DEC-13' + tên trigger + user_id; KHÔNG nêu email (log không
-- rò PII). USING TABLE/CONSTRAINT để pgjdbc/Hibernate đọc được tên chốt như một constraint thường.
--
-- users.org_id (bản sao nhanh, V204) CỐ Ý không gắn trigger: cổng thật là dòng org_members (OrgGuard),
-- và AdminOrgMemberGuardIntegrationTest.stampedOrgId_withoutMembershipRow_isStillForbidden dán tay
-- cột này để chứng minh đúng điều đó. ct01 vẫn liệt kê nó như một nguồn lệch để soi định kỳ.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0) Tiền điều kiện — môi trường phải sạch như production ngày 10/09/2026.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_member_rows BIGINT;
    v_org_id_rows BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_member_rows
      FROM org_members m
      JOIN users u ON u.id = m.user_id
     WHERE u.role = 'ADMIN';

    SELECT COUNT(*) INTO v_org_id_rows
      FROM users u
     WHERE u.role = 'ADMIN'
       AND u.org_id IS NOT NULL;

    IF v_member_rows > 0 OR v_org_id_rows > 0 THEN
        RAISE EXCEPTION 'V318 (DEC-13): môi trường này còn admin nền tảng dính trung tâm — % dòng org_members, % dòng users.org_id. Migration CHỈ gắn trigger, không dọn hộ.',
                        v_member_rows, v_org_id_rows
            USING ERRCODE = 'check_violation',
                  HINT    = 'Chạy backend/scripts/ct01-check-admin-org-membership.sql để thấy đích danh; owner quyết cách dọn (nhất là vai OWNER — không có đường gỡ trong sản phẩm) RỒI áp lại. Không sửa migration này để đi qua.';
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) org_members: không dòng nào trỏ tới admin nền tảng — INSERT hay đổi user_id/status đều bị chặn.
-- ─────────────────────────────────────────────────────────────────────────────
-- Thân hàm là một tra cứu theo khoá chính của users — rẻ. Nó CÓ chạy ở mỗi UPDATE org_members qua
-- Hibernate (status luôn nằm trong SET), nhưng bảng này chỉ đổi khi vào/ra/đổi vai — hiếm.
CREATE OR REPLACE FUNCTION org_members_block_platform_admin() RETURNS trigger AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.user_id AND u.role = 'ADMIN') THEN
        RAISE EXCEPTION 'DEC-13: quản trị viên nền tảng (user_id=%) không được là thành viên trung tâm — % trên org_members (org_id=%, role=%, status=%) bị chặn bởi trg_org_members_no_platform_admin',
                        NEW.user_id, TG_OP, NEW.org_id, NEW.role, NEW.status
            USING ERRCODE    = 'check_violation',
                  TABLE      = 'org_members',
                  CONSTRAINT = 'trg_org_members_no_platform_admin',
                  HINT       = 'Admin nền tảng giữ quyền kỹ thuật, không có ghế trong trung tâm. Muốn kết nạp: hạ users.role trước (AdminManagementService.updateUserRole), rồi thêm qua OrgMembershipService.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_org_members_no_platform_admin ON org_members;

CREATE TRIGGER trg_org_members_no_platform_admin
    BEFORE INSERT OR UPDATE OF user_id, status ON org_members
    FOR EACH ROW
    EXECUTE FUNCTION org_members_block_platform_admin();

COMMENT ON TRIGGER trg_org_members_no_platform_admin ON org_members IS
    'DEC-13/ORG-18 (V318): chặn mọi dòng org_members trỏ tới users.role=ADMIN — kể cả bia mộ, kể cả '
    'đổi user_id/status. Chiều còn lại là trg_users_no_admin_with_membership trên users.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) users: không nâng lên ADMIN khi còn membership ACTIVE.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION users_block_admin_with_membership() RETURNS trigger AS $$
DECLARE
    v_org_id BIGINT;
BEGIN
    SELECT m.org_id INTO v_org_id
      FROM org_members m
     WHERE m.user_id = NEW.id
       AND m.status  = 'ACTIVE'
     LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'DEC-13: user_id=% đang là thành viên ACTIVE của trung tâm org_id=% — không nâng lên ADMIN nền tảng được, bị chặn bởi trg_users_no_admin_with_membership',
                        NEW.id, v_org_id
            USING ERRCODE    = 'check_violation',
                  TABLE      = 'users',
                  CONSTRAINT = 'trg_users_no_admin_with_membership',
                  HINT       = 'Gỡ người này khỏi trung tâm trước (OrgMembershipService.removeMember / selfLeave), rồi mới đổi vai trò.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_no_admin_with_membership ON users;

-- WHEN là bắt buộc — xem khối 🔴 ở đầu tệp. Không có nó, thân hàm chạy ở mọi lần Hibernate lưu user.
CREATE TRIGGER trg_users_no_admin_with_membership
    BEFORE UPDATE OF role ON users
    FOR EACH ROW
    WHEN (NEW.role = 'ADMIN' AND OLD.role IS DISTINCT FROM NEW.role)
    EXECUTE FUNCTION users_block_admin_with_membership();

COMMENT ON TRIGGER trg_users_no_admin_with_membership ON users IS
    'DEC-13/ORG-18 (V318): chặn nâng users.role lên ADMIN khi còn org_members ACTIVE (cùng nghĩa với '
    'OrgMembershipService.hasActiveMembership). WHEN chỉ bắt phép đổi SANG ADMIN — không chạy ở các '
    'UPDATE users khác. Chiều còn lại là trg_org_members_no_platform_admin trên org_members.';
