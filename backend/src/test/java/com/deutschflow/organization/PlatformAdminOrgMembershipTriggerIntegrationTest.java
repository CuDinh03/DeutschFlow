package com.deutschflow.organization;

import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * AC-ORG-CT-01, <b>nửa DB</b> (DEC-13 / ORG-18, migration V318) — hai trigger giữ bất biến "admin nền
 * tảng không bao giờ là thành viên trung tâm" ngay cả khi mọi guard Java bị đi vòng.
 *
 * <p>{@link AdminOrgMemberGuardIntegrationTest} chứng minh nửa Java: đi qua HTTP → service thì bị chặn.
 * Lớp này cố ý đi VÒNG service — {@link JdbcTemplate} thô và {@code memberRepo.save(...)} thẳng, đúng
 * cách V234:62-71 từng ghi {@code org_members} — vì đó là đường mà chỉ tầng DB mới cản được. Mỗi ca
 * soi cả ba thứ: ném đúng loại ({@link DataIntegrityViolationException} — tức Spring dịch được, HTTP
 * sẽ là 409 chứ không 500), đúng SQLSTATE {@code 23514}, và bảng KHÔNG đổi sau khi ném.
 *
 * <p>Nửa còn lại của lớp này quan trọng không kém: những gì trigger <b>không được</b> chặn — cập nhật
 * cột khác của user (mệnh đề WHEN), nâng OWNER/MANAGER (giá trị hợp lệ của {@code users.role} khi có
 * membership), và CASCADE khi xoá user/trung tâm (bài học V319). Một trigger "chặn quá tay" làm hỏng
 * đặt lại mật khẩu, push token, xoá tài khoản — không có các ca này thì lớp vẫn xanh khi điều đó xảy ra.
 *
 * <p>Tự bỏ qua khi không có Postgres — xem {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("AC-ORG-CT-01 (nửa DB, V318): trigger chặn admin nền tảng làm thành viên trung tâm")
class PlatformAdminOrgMembershipTriggerIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String MEMBERS_TRIGGER = "trg_org_members_no_platform_admin";
    private static final String USERS_TRIGGER = "trg_users_no_admin_with_membership";

    /**
     * SQLSTATE {@code check_violation}. Khoá cứng lựa chọn của V318: lớp 23 là thứ Spring dịch thành
     * {@link DataIntegrityViolationException} → GlobalExceptionHandler trả 409; một mã tự đặt ('DF001')
     * sẽ rơi vào UncategorizedSQLException → 500 "ERR-x".
     */
    private static final String CHECK_VIOLATION = "23514";

    /** Đúng ba trạng thái mà OrgMember ghi chú: ACTIVE | REVOKED (admin gỡ) | LEFT (tự rời). */
    private static final List<String> MEMBER_STATUSES = List.of("ACTIVE", "REVOKED", "LEFT");

    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private UserRepository userRepository;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository memberRepo;

    private Organization org;

    @BeforeEach
    void seedOrg() {
        org = newOrg();
    }

    // ── (g) migration + trigger có mặt ───────────────────────────────────────

    @Test
    @DisplayName("V318 áp thành công, không migration nào success=false, hai trigger đang bật")
    void v318Applied_noFailedMigration_bothTriggersEnabled() {
        // queryForObject ném EmptyResultDataAccessException nếu V318 vắng — đỏ to, không đỏ ngầm.
        Boolean v318 = jdbcTemplate.queryForObject(
                "SELECT success FROM flyway_schema_history WHERE version = '318'", Boolean.class);
        assertThat(v318).isTrue();

        // Cố ý KHÔNG khẳng định "318 là mới nhất": nhánh Gói 1 (V319/V320) sẽ gộp lên trên.
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE success = false", Long.class)).isZero();

        assertThat(enabledTriggers("org_members", MEMBERS_TRIGGER)).isEqualTo(1L);
        assertThat(enabledTriggers("users", USERS_TRIGGER)).isEqualTo(1L);
    }

    // ── (a) INSERT thô / INSERT qua repository cho admin ────────────────────

    @Test
    @DisplayName("INSERT thô org_members cho admin nền tảng ⇒ ném, với MỌI status, bảng không có dòng")
    void rawInsert_forPlatformAdmin_isRejected_forEveryStatus() {
        User admin = account(User.Role.ADMIN);

        for (String status : MEMBER_STATUSES) {
            assertThatThrownBy(() -> jdbcTemplate.update("""
                    INSERT INTO org_members (org_id, user_id, role, status, joined_at)
                    VALUES (?, ?, 'OWNER', ?, now())
                    """, org.getId(), admin.getId(), status))
                    .as("status=%s", status)
                    .isInstanceOf(DataIntegrityViolationException.class)
                    .satisfies(ex -> assertBlockedBy(ex, MEMBERS_TRIGGER, admin.getId()));
        }

        assertThat(membershipRows(admin)).isZero();
        assertThat(reload(admin).getRole()).isEqualTo(User.Role.ADMIN);
    }

    @Test
    @DisplayName("memberRepo.save(...) thẳng cho admin (đi vòng OrgMembershipService) ⇒ ném, không có dòng")
    void repositorySave_forPlatformAdmin_isRejected() {
        User admin = account(User.Role.ADMIN);

        OrgMember m = new OrgMember();
        m.setId(new OrgMemberId(org.getId(), admin.getId()));
        m.setRole("TEACHER");
        m.setStatus("ACTIVE");
        m.setJoinedAt(Instant.now());

        assertThatThrownBy(() -> memberRepo.save(m))
                .isInstanceOf(DataIntegrityViolationException.class)
                .satisfies(ex -> assertBlockedBy(ex, MEMBERS_TRIGGER, admin.getId()));

        assertThat(membershipRows(admin)).isZero();
    }

    // ── (b) đổi user_id của dòng có sẵn sang admin ───────────────────────────

    @Test
    @DisplayName("UPDATE org_members.user_id trỏ sang admin ⇒ ném, dòng vẫn thuộc giáo viên cũ")
    void rawUpdate_reassigningRowToPlatformAdmin_isRejected() {
        User teacher = memberOf(org, "TEACHER"); // đối chứng: INSERT cho người thường đi qua trigger
        User admin = account(User.Role.ADMIN);
        assertThat(membershipRows(teacher)).isEqualTo(1L);

        assertThatThrownBy(() -> jdbcTemplate.update(
                "UPDATE org_members SET user_id = ? WHERE org_id = ? AND user_id = ?",
                admin.getId(), org.getId(), teacher.getId()))
                .isInstanceOf(DataIntegrityViolationException.class)
                .satisfies(ex -> assertBlockedBy(ex, MEMBERS_TRIGGER, admin.getId()));

        assertThat(membershipRows(admin)).isZero();
        assertThat(membershipRows(teacher)).isEqualTo(1L);
    }

    // ── (c) nâng người đang có membership ACTIVE lên ADMIN ───────────────────

    @Test
    @DisplayName("UPDATE users SET role='ADMIN' cho thành viên ACTIVE ⇒ ném, vai trò giữ nguyên")
    void rawPromotion_ofActiveMember_isRejected() {
        User teacher = memberOf(org, "TEACHER");

        assertThatThrownBy(() -> jdbcTemplate.update(
                "UPDATE users SET role = 'ADMIN' WHERE id = ?", teacher.getId()))
                .isInstanceOf(DataIntegrityViolationException.class)
                .satisfies(ex -> assertBlockedBy(ex, USERS_TRIGGER, teacher.getId()));

        assertThat(reload(teacher).getRole()).isEqualTo(User.Role.TEACHER);
        assertThat(memberStatus(teacher)).isEqualTo("ACTIVE");
    }

    @Test
    @DisplayName("userRepository.save(role=ADMIN) — câu UPDATE mọi-cột của Hibernate — cũng bị chặn")
    void ormPromotion_ofActiveMember_isRejected() {
        User teacher = memberOf(org, "TEACHER");

        User promoted = reload(teacher);
        promoted.setRole(User.Role.ADMIN);
        assertThatThrownBy(() -> userRepository.save(promoted))
                .isInstanceOf(DataIntegrityViolationException.class)
                .satisfies(ex -> assertBlockedBy(ex, USERS_TRIGGER, teacher.getId()));

        assertThat(reload(teacher).getRole()).isEqualTo(User.Role.TEACHER);
    }

    // ── (d) mệnh đề WHEN: các UPDATE users khác đi qua ──────────────────────

    @Test
    @DisplayName("Thành viên ACTIVE đổi cột khác — thô, thô-có-role-không-đổi, và qua Hibernate — KHÔNG ném")
    void otherUpdates_onActiveMember_passThrough() {
        User teacher = memberOf(org, "TEACHER");

        // 1) UPDATE thô không đụng role — không lọt cả `UPDATE OF role`.
        jdbcTemplate.update("UPDATE users SET display_name = ? WHERE id = ?", "Đổi tên 1", teacher.getId());

        // 2) UPDATE thô CÓ role trong SET nhưng giá trị không đổi — chính dạng câu Hibernate phát ra;
        //    `UPDATE OF role` bắn, chỉ WHEN (`OLD.role IS DISTINCT FROM NEW.role`) mới lọc được.
        jdbcTemplate.update("UPDATE users SET role = role, display_name = ? WHERE id = ?",
                "Đổi tên 2", teacher.getId());

        // 3) Đường ORM thật: save() ghi mọi cột kể cả role.
        User edited = reload(teacher);
        edited.setDisplayName("Đổi tên 3");
        userRepository.save(edited);

        User after = reload(teacher);
        assertThat(after.getDisplayName()).isEqualTo("Đổi tên 3");
        assertThat(after.getRole()).isEqualTo(User.Role.TEACHER);
        assertThat(memberStatus(teacher)).isEqualTo("ACTIVE");
    }

    @Test
    @DisplayName("Thành viên ACTIVE lên MANAGER/OWNER nền tảng (đường syncPlatformRole) — KHÔNG ném, chỉ ADMIN bị chặn")
    void promotionToManagerOrOwner_onActiveMember_passThrough() {
        User member = memberOf(org, "MANAGER");

        jdbcTemplate.update("UPDATE users SET role = 'MANAGER' WHERE id = ?", member.getId());
        assertThat(reload(member).getRole()).isEqualTo(User.Role.MANAGER);

        jdbcTemplate.update("UPDATE users SET role = 'OWNER' WHERE id = ?", member.getId());
        assertThat(reload(member).getRole()).isEqualTo(User.Role.OWNER);

        // Hạ ADMIN xuống cũng đi qua: WHEN chỉ so NEW.role = 'ADMIN'.
        User admin = account(User.Role.ADMIN);
        jdbcTemplate.update("UPDATE users SET role = 'TEACHER' WHERE id = ?", admin.getId());
        assertThat(reload(admin).getRole()).isEqualTo(User.Role.TEACHER);
    }

    // ── (e) không membership ACTIVE ⇒ nâng được; bia mộ không sống lại ───────

    @Test
    @DisplayName("Không membership ⇒ nâng ADMIN được; đã rời (LEFT) ⇒ vẫn nâng được, nhưng bia mộ không ACTIVE lại được")
    void userWithoutActiveMembership_canBecomeAdmin_andTombstoneStaysDead() {
        User loner = account(User.Role.TEACHER);
        jdbcTemplate.update("UPDATE users SET role = 'ADMIN' WHERE id = ?", loner.getId());
        assertThat(reload(loner).getRole()).isEqualTo(User.Role.ADMIN);

        // Từng là học viên, đã rời — cùng ngữ nghĩa hasActiveMembership của guard Java.
        User former = memberOf(org, "STUDENT");
        jdbcTemplate.update("UPDATE org_members SET status = 'LEFT', left_at = now() WHERE org_id = ? AND user_id = ?",
                org.getId(), former.getId());
        jdbcTemplate.update("UPDATE users SET role = 'ADMIN' WHERE id = ?", former.getId());
        assertThat(reload(former).getRole()).isEqualTo(User.Role.ADMIN);

        // Trigger 1 bắt UPDATE OF status: bia mộ của một admin không được sống lại.
        assertThatThrownBy(() -> jdbcTemplate.update(
                "UPDATE org_members SET status = 'ACTIVE' WHERE org_id = ? AND user_id = ?",
                org.getId(), former.getId()))
                .isInstanceOf(DataIntegrityViolationException.class)
                .satisfies(ex -> assertBlockedBy(ex, MEMBERS_TRIGGER, former.getId()));
        assertThat(memberStatus(former)).isEqualTo("LEFT");
    }

    // ── (f) CASCADE không bị trigger cản (bài học V319) ─────────────────────

    @Test
    @DisplayName("Xoá user thường có membership ⇒ ON DELETE CASCADE vẫn dọn org_members; xoá trung tâm cũng vậy")
    void deletingUserOrOrganization_stillCascades() {
        User teacher = memberOf(org, "TEACHER");
        jdbcTemplate.update("DELETE FROM users WHERE id = ?", teacher.getId());
        assertThat(membershipRows(teacher)).isZero();
        assertThat(userRepository.findById(teacher.getId())).isEmpty();

        Organization doomed = newOrg();
        User student = memberOf(doomed, "STUDENT");
        // users.org_id trỏ tới trung tâm sắp xoá là FK không CASCADE — gỡ trước, đúng như service làm.
        jdbcTemplate.update("UPDATE users SET org_id = NULL WHERE id = ?", student.getId());
        jdbcTemplate.update("DELETE FROM organizations WHERE id = ?", doomed.getId());
        assertThat(membershipRows(student)).isZero();
        assertThat(reload(student).getRole()).isEqualTo(User.Role.TEACHER); // user còn nguyên
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    /**
     * Ném từ trigger phải: (1) gốc là SQLException với SQLSTATE 23514, (2) thông điệp có dấu vết grep
     * được — 'DEC-13', tên trigger, user_id — và (3) KHÔNG rò email vào log.
     */
    private static void assertBlockedBy(Throwable ex, String trigger, Long userId) {
        Throwable root = NestedExceptionUtils.getMostSpecificCause(ex);
        assertThat(root).as("nguyên nhân gốc phải là SQLException từ Postgres").isInstanceOf(SQLException.class);
        SQLException sql = (SQLException) root;
        assertThat(sql.getSQLState()).isEqualTo(CHECK_VIOLATION);
        assertThat(sql.getMessage())
                .contains("DEC-13")
                .contains(trigger)
                .contains("user_id=" + userId)
                .doesNotContain("@test.local");
    }

    private Long enabledTriggers(String table, String trigger) {
        return jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                  FROM pg_trigger t
                  JOIN pg_class c ON c.oid = t.tgrelid
                 WHERE c.relname = ?
                   AND t.tgname = ?
                   AND NOT t.tgisinternal
                   AND t.tgenabled <> 'D'
                """, Long.class, table, trigger);
    }

    private Organization newOrg() {
        return organizationRepo.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug("v318-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
    }

    private User account(User.Role role) {
        return userRepository.save(User.builder()
                .email("v318-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("V318 " + role.name())
                .role(role)
                .build());
    }

    /** Thành viên ACTIVE (người thường, users.role=TEACHER) với vai org đã cho — cùng khuôn các IT khác. */
    private User memberOf(Organization o, String orgRole) {
        User u = account(User.Role.TEACHER);
        u.setOrgId(o.getId());
        u = userRepository.save(u);

        OrgMember m = new OrgMember();
        m.setId(new OrgMemberId(o.getId(), u.getId()));
        m.setRole(orgRole);
        m.setStatus("ACTIVE");
        m.setJoinedAt(Instant.now());
        memberRepo.save(m);
        return u;
    }

    private User reload(User u) {
        return userRepository.findById(u.getId()).orElseThrow();
    }

    private Long membershipRows(User u) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM org_members WHERE user_id = ?", Long.class, u.getId());
    }

    private String memberStatus(User u) {
        return jdbcTemplate.queryForObject(
                "SELECT status FROM org_members WHERE user_id = ?", String.class, u.getId());
    }
}
