package com.deutschflow.organization;

import com.deutschflow.common.exception.OrgReadOnlyException;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.organization.service.OrgLicenseState;
import com.deutschflow.organization.service.OrgMembershipService;
import com.deutschflow.organization.service.OrgQuotaService;
import com.deutschflow.teacher.dto.CreateAssignmentRequest;
import com.deutschflow.teacher.service.TeacherService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * G-10 / D5 trên Postgres THẬT, theo luật owner chốt 09/09/2026: trung tâm bị đình chỉ HOẶC đã hết
 * hạn thì mất quyền ghi NGAY — KHÔNG tạo mới, KHÔNG tiêu token AI — nhưng VẪN XEM được. 7 ngày ân
 * hạn là quãng chỉ-đọc trước khi CẮT quyền lợi, không phải quãng còn ghi được.
 *
 * <p>Hai thứ chỉ Postgres mới chứng minh được: (1) {@code ensureStudentSeat} ném giữa chừng thì ghế
 * vừa cấp ROLLBACK theo, không đẻ ra thành viên không quyền lợi; (2) cổng nằm TRƯỚC câu
 * conditional-upsert của pool nên counter token không hề nhúc nhích.
 */
@SpringBootTest
@DisplayName("Chế độ chỉ đọc của trung tâm (D5)")
class OrgReadOnlyGateIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private OrgMembershipService orgMembershipService;
    @Autowired private OrgQuotaService orgQuotaService;
    @Autowired private OrgGuard orgGuard;
    @Autowired private TeacherService teacherService;

    private static final String EMAIL_PREFIX = "readonly-it-";
    private static final String SLUG_PREFIX = "readonly-it-";

    @AfterEach
    void tearDown() {
        String owned = "(SELECT id FROM users WHERE email LIKE '" + EMAIL_PREFIX + "%')";
        String orgs = "(SELECT id FROM organizations WHERE slug LIKE '" + SLUG_PREFIX + "%')";
        String classes = "(SELECT id FROM teacher_classes WHERE teacher_id IN " + owned + ")";
        jdbcTemplate.update("DELETE FROM class_assignments WHERE class_id IN " + classes);
        jdbcTemplate.update("DELETE FROM class_teachers WHERE class_id IN " + classes);
        jdbcTemplate.update("DELETE FROM teacher_classes WHERE teacher_id IN " + owned);
        jdbcTemplate.update("DELETE FROM org_monthly_token_counters WHERE org_id IN " + orgs);
        jdbcTemplate.update("DELETE FROM user_subscriptions WHERE user_id IN " + owned);
        jdbcTemplate.update("DELETE FROM org_members WHERE user_id IN " + owned);
        jdbcTemplate.update("DELETE FROM users WHERE email LIKE '" + EMAIL_PREFIX + "%'");
        // Bỏ qua trung tâm nào đã có VẾT trỏ vào: `audit_logs` là bảng chỉ-ghi-thêm (trigger
        // trg_audit_logs_immutable — C14) nên không xoá được dòng vết, mà `audit_logs.org_id` lại
        // có khoá ngoại tới `organizations(id)`. Các ca E1 (gỡ thành viên / đổi vai / chuyển quyền
        // / tự rời) đều ghi vết, nên xoá thẳng như trước là ném FK và đánh đỏ NGUYÊN bộ ở tearDown
        // dù mọi assert đã xanh. Vài dòng org sót lại trong DB test cục bộ là cái giá đúng: slug
        // mang nanoTime nên lần chạy sau không đụng phải chúng.
        jdbcTemplate.update("DELETE FROM organizations WHERE slug LIKE '" + SLUG_PREFIX + "%'"
                + " AND id NOT IN (SELECT org_id FROM audit_logs WHERE org_id IS NOT NULL)");
    }

    // ------------------------------------------------------------------ helpers

    private Long newUser(String tag) {
        return userRepository.save(User.builder()
                .email(EMAIL_PREFIX + tag + "-" + System.nanoTime() + "@test.com")
                .passwordHash("$2a$10$h").displayName("Chỉ đọc IT")
                .role(User.Role.STUDENT).build()).getId();
    }

    /** Trung tâm có gói bán và pool token, đặt sẵn trạng thái + hạn giấy phép cần kiểm. */
    private Long newOrg(String status, Instant validUntil) {
        // Đình chỉ thì mặc định đóng mốc neo NGAY BÂY GIỜ — đúng như Organization.changeStatus làm.
        return newOrg(status, validUntil, "ACTIVE".equals(status) ? null : Instant.now());
    }

    private Long newOrg(String status, Instant validUntil, Instant suspendedAt) {
        Timestamp now = Timestamp.from(Instant.now());
        return jdbcTemplate.queryForObject("""
                INSERT INTO organizations
                    (name, slug, status, seat_limit, plan_code, monthly_token_pool, pool_unlimited,
                     valid_until, suspended_at, created_at, updated_at)
                VALUES (?, ?, ?, 0, 'PRO', 100000, false, ?, ?, ?, ?) RETURNING id
                """, Long.class, "Trung tâm chỉ đọc", SLUG_PREFIX + System.nanoTime(), status,
                validUntil == null ? null : Timestamp.from(validUntil),
                suspendedAt == null ? null : Timestamp.from(suspendedAt), now, now);
    }

    private void member(Long orgId, Long userId, String role) {
        jdbcTemplate.update("""
                INSERT INTO org_members (org_id, user_id, role, status, joined_at)
                VALUES (?, ?, ?, 'ACTIVE', now())
                """, orgId, userId, role);
    }

    private int activeMembers(Long orgId) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM org_members WHERE org_id = ? AND status = 'ACTIVE'",
                Integer.class, orgId);
        return n == null ? 0 : n;
    }

    private long tokensUsed(Long orgId) {
        Long n = jdbcTemplate.query(
                "SELECT COALESCE(SUM(tokens_used), 0) FROM org_monthly_token_counters WHERE org_id = ?",
                rs -> rs.next() ? rs.getLong(1) : 0L, orgId);
        return n == null ? 0L : n;
    }

    private static Instant daysAgo(int days) {
        return Instant.now().minus(days, ChronoUnit.DAYS);
    }

    // ------------------------------------------------- cấp ghế + cấp gói (nợ PR #617)

    @Test
    @DisplayName("ensureStudentSeat: trung tâm ĐÌNH CHỈ → chặn, và ghế vừa cấp ROLLBACK theo")
    void ensureStudentSeat_suspendedOrg_blockedAndRolledBack() {
        Long orgId = newOrg("SUSPENDED", null);
        Long userId = newUser("suspended-seat");

        assertThatThrownBy(() -> orgMembershipService.ensureStudentSeat(orgId, userId))
                .isInstanceOf(OrgReadOnlyException.class);

        assertThat(activeMembers(orgId))
                .as("cấp ghế rồi mới cấp gói: gói chặn thì ghế phải mất theo, "
                        + "không để lại thành viên chiếm chỗ mà không có quyền lợi")
                .isZero();
    }

    @Test
    @DisplayName("ensureStudentSeat: giấy phép hết hạn QUÁ ân hạn → chặn")
    void ensureStudentSeat_expiredPastGrace_blocked() {
        Long orgId = newOrg("ACTIVE", daysAgo(10));
        Long userId = newUser("expired-seat");

        assertThatThrownBy(() -> orgMembershipService.ensureStudentSeat(orgId, userId))
                .isInstanceOf(OrgReadOnlyException.class);
        assertThat(activeMembers(orgId)).isZero();
    }

    @Test
    @DisplayName("ensureStudentSeat: VỪA hết hạn 2 ngày (còn trong ân hạn chỉ-đọc) → vẫn CHẶN")
    void ensureStudentSeat_justExpiredWithinGrace_blocked() {
        Long orgId = newOrg("ACTIVE", daysAgo(2));
        Long userId = newUser("just-expired-seat");

        assertThatThrownBy(() -> orgMembershipService.ensureStudentSeat(orgId, userId))
                .as("owner 09/09: hết hạn là chỉ-đọc NGAY, ân hạn không còn là quãng ghi được")
                .isInstanceOf(OrgReadOnlyException.class);
        assertThat(activeMembers(orgId)).isZero();
    }

    @Test
    @DisplayName("ensureStudentSeat: giấy phép CÒN hạn → cấp ghế + gói bình thường")
    void ensureStudentSeat_stillValid_works() {
        Long orgId = newOrg("ACTIVE", Instant.now().plus(30, ChronoUnit.DAYS));
        Long userId = newUser("valid-seat");

        assertThatCode(() -> orgMembershipService.ensureStudentSeat(orgId, userId))
                .doesNotThrowAnyException();

        assertThat(activeMembers(orgId)).isOne();
    }

    @Test
    @DisplayName("ensureStudentSeat: giấy phép VÔ THỜI HẠN (validUntil null) → vẫn cấp được")
    void ensureStudentSeat_perpetualLicence_works() {
        Long orgId = newOrg("ACTIVE", null);
        Long userId = newUser("perpetual-seat");

        assertThatCode(() -> orgMembershipService.ensureStudentSeat(orgId, userId))
                .doesNotThrowAnyException();
        assertThat(activeMembers(orgId)).isOne();
    }

    // ------------------------------------------------- nhánh tiêu token AI của trung tâm

    @Test
    @DisplayName("pool token: trung tâm đình chỉ → ORG_READ_ONLY và counter KHÔNG nhúc nhích")
    void tokenPool_suspendedOrg_blockedWithoutTouchingCounter() {
        Long orgId = newOrg("SUSPENDED", null);

        assertThatThrownBy(() -> orgQuotaService.tryReserveForOrg(orgId, 500))
                .isInstanceOf(OrgReadOnlyException.class)
                .extracting(ex -> ((OrgReadOnlyException) ex).getReason())
                .isEqualTo(OrgLicenseState.Reason.SUSPENDED);

        assertThat(tokensUsed(orgId)).isZero();
    }

    @Test
    @DisplayName("pool token: hết hạn quá ân hạn → ORG_READ_ONLY (lý do EXPIRED)")
    void tokenPool_expiredPastGrace_blocked() {
        Long orgId = newOrg("ACTIVE", daysAgo(30));

        assertThatThrownBy(() -> orgQuotaService.tryReserveForOrg(orgId, 500))
                .isInstanceOf(OrgReadOnlyException.class)
                .extracting(ex -> ((OrgReadOnlyException) ex).getReason())
                .isEqualTo(OrgLicenseState.Reason.EXPIRED);
    }

    @Test
    @DisplayName("pool token: giấy phép còn hạn → giữ chỗ bình thường")
    void tokenPool_stillValid_reserves() {
        Long orgId = newOrg("ACTIVE", Instant.now().plus(30, ChronoUnit.DAYS));

        assertThat(orgQuotaService.tryReserveForOrg(orgId, 500)).isPresent();
        assertThat(tokensUsed(orgId)).isEqualTo(500L);
    }

    @Test
    @DisplayName("pool token: vừa hết hạn 1 ngày → CHẶN ngay, counter không nhúc nhích")
    void tokenPool_justExpired_blockedWithoutTouchingCounter() {
        Long orgId = newOrg("ACTIVE", daysAgo(1));

        assertThatThrownBy(() -> orgQuotaService.tryReserveForOrg(orgId, 500))
                .isInstanceOf(OrgReadOnlyException.class)
                .extracting(ex -> ((OrgReadOnlyException) ex).getReason())
                .isEqualTo(OrgLicenseState.Reason.EXPIRED);
        assertThat(tokensUsed(orgId)).isZero();
    }

    @Test
    @DisplayName("pool token: đình chỉ CÓ mốc neo lẫn đình chỉ MẤT mốc neo — cả hai đều bị chặn")
    void tokenPool_suspendedWithAndWithoutAnchor_bothBlocked() {
        // Nhánh AI của OrgQuotaService đọc bằng JDBC nên phải tự lấy suspended_at trong câu SELECT.
        // Hai mức READ_ONLY (còn ân hạn) và CUT (mất mốc neo ⇒ coi như hết ân hạn) cùng ném
        // ORG_READ_ONLY, nên điều test này chốt được là: KHÔNG mức nào fail-open ở nhánh AI.
        Long withAnchor = newOrg("SUSPENDED", null, daysAgo(3));
        Long withoutAnchor = newOrg("SUSPENDED", null, null);

        assertThatThrownBy(() -> orgQuotaService.tryReserveForOrg(withAnchor, 500))
                .isInstanceOf(OrgReadOnlyException.class);
        assertThatThrownBy(() -> orgQuotaService.tryReserveForOrg(withoutAnchor, 500))
                .as("dòng dữ liệu cũ / sửa tay vào DB không được thành cửa sau tiêu token")
                .isInstanceOf(OrgReadOnlyException.class);
        assertThat(tokensUsed(withAnchor)).isZero();
        assertThat(tokensUsed(withoutAnchor)).isZero();
    }

    @Test
    @DisplayName("HỌC VIÊN của trung tâm đình chỉ đi kênh ví cá nhân — cổng pool KHÔNG đụng tới")
    void tokenPool_studentChannel_untouched() {
        Long orgId = newOrg("SUSPENDED", null);
        Long studentId = newUser("student-channel");
        member(orgId, studentId, "STUDENT");

        assertThat(orgQuotaService.tryReserve(studentId, 500))
                .contains(OrgQuotaService.OrgReservation.NONE);
    }

    @Test
    @DisplayName("STAFF của trung tâm đình chỉ bị cắt AI ngay tại tryReserve")
    void tokenPool_staffOfSuspendedOrg_blocked() {
        Long orgId = newOrg("SUSPENDED", null);
        Long teacherId = newUser("staff-channel");
        member(orgId, teacherId, "TEACHER");

        assertThatThrownBy(() -> orgQuotaService.tryReserve(teacherId, 500))
                .isInstanceOf(OrgReadOnlyException.class);
    }

    // ------------------------------------------------- đường ĐỌC vẫn phải sống (D5)

    // ------------------------------- Gói 3: các cửa TẠO MỚI của giáo viên trung tâm ----------

    /** Lớp đóng dấu trung tâm + dòng PRIMARY, đúng hình dạng mà cổng theo-lớp đọc. */
    private Long newClass(Long teacherId, Long orgId) {
        Long classId = jdbcTemplate.queryForObject("""
                INSERT INTO teacher_classes (teacher_id, org_id, name, invite_code, created_at, updated_at)
                VALUES (?, ?, 'A1.1 chỉ-đọc', ?, now(), now()) RETURNING id
                """, Long.class, teacherId, orgId, "RO" + (System.nanoTime() % 100000000L));
        jdbcTemplate.update(
                "INSERT INTO class_teachers (class_id, teacher_id, role) VALUES (?, ?, 'PRIMARY')",
                classId, teacherId);
        return classId;
    }

    private int assignmentsOf(Long classId) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM class_assignments WHERE class_id = ?", Integer.class, classId);
        return n == null ? 0 : n;
    }

    private static CreateAssignmentRequest homework() {
        return new CreateAssignmentRequest("Bài về nhà", null, null, null, null, null, null, null, null);
    }

    @Test
    @DisplayName("giao bài: lớp của trung tâm ĐÌNH CHỈ → ORG_READ_ONLY, không dòng bài nào được ghi")
    void createAssignment_suspendedOrgClass_blocked() {
        Long orgId = newOrg("SUSPENDED", null);
        Long teacherId = newUser("assign-suspended");
        member(orgId, teacherId, "TEACHER");
        Long classId = newClass(teacherId, orgId);

        assertThatThrownBy(() -> teacherService.createAssignment(teacherId, classId, homework()))
                .isInstanceOf(OrgReadOnlyException.class)
                .extracting(ex -> ((OrgReadOnlyException) ex).getReason())
                .isEqualTo(OrgLicenseState.Reason.SUSPENDED);

        assertThat(assignmentsOf(classId)).isZero();
    }

    @Test
    @DisplayName("giao bài: lớp của trung tâm hết hạn 2 ngày (còn ân hạn) → vẫn CHẶN")
    void createAssignment_justExpiredOrgClass_blocked() {
        Long orgId = newOrg("ACTIVE", daysAgo(2));
        Long teacherId = newUser("assign-expired");
        member(orgId, teacherId, "TEACHER");
        Long classId = newClass(teacherId, orgId);

        assertThatThrownBy(() -> teacherService.createAssignment(teacherId, classId, homework()))
                .isInstanceOf(OrgReadOnlyException.class)
                .extracting(ex -> ((OrgReadOnlyException) ex).getReason())
                .isEqualTo(OrgLicenseState.Reason.EXPIRED);
        assertThat(assignmentsOf(classId)).isZero();
    }

    @Test
    @DisplayName("giao bài: trung tâm KHOẺ → giao được như cũ (cổng không chặn nhầm)")
    void createAssignment_healthyOrgClass_works() {
        Long orgId = newOrg("ACTIVE", Instant.now().plus(30, ChronoUnit.DAYS));
        Long teacherId = newUser("assign-healthy");
        member(orgId, teacherId, "TEACHER");
        Long classId = newClass(teacherId, orgId);

        assertThatCode(() -> teacherService.createAssignment(teacherId, classId, homework()))
                .doesNotThrowAnyException();

        assertThat(assignmentsOf(classId)).isOne();
    }

    @Test
    @DisplayName("giao bài: lớp B2C (org_id null) của giáo viên tự do → cổng D5 không đụng tới")
    void createAssignment_b2cClass_notGated() {
        Long teacherId = newUser("assign-b2c");
        Long classId = newClass(teacherId, null);

        assertThatCode(() -> teacherService.createAssignment(teacherId, classId, homework()))
                .doesNotThrowAnyException();
        assertThat(assignmentsOf(classId)).isOne();
    }

    @Test
    @DisplayName("ĐƯỜNG ĐỌC vẫn sống: lớp của trung tâm đình chỉ vẫn xem được danh sách bài (D5)")
    void readAssignments_suspendedOrgClass_stillReadable() {
        Long orgId = newOrg("ACTIVE", Instant.now().plus(30, ChronoUnit.DAYS));
        Long teacherId = newUser("read-assign");
        member(orgId, teacherId, "TEACHER");
        Long classId = newClass(teacherId, orgId);
        teacherService.createAssignment(teacherId, classId, homework());   // giao lúc còn khoẻ

        // …rồi trung tâm bị đình chỉ.
        jdbcTemplate.update("UPDATE organizations SET status = 'SUSPENDED', suspended_at = now() WHERE id = ?", orgId);

        assertThatCode(() -> teacherService.getClassAssignments(teacherId, classId))
                .doesNotThrowAnyException();
        assertThat(teacherService.getClassAssignments(teacherId, classId)).hasSize(1);
        assertThatThrownBy(() -> teacherService.createAssignment(teacherId, classId, homework()))
                .as("cùng một lớp: ĐỌC sống, GHI chặn — đó chính là 'chỉ-đọc'")
                .isInstanceOf(OrgReadOnlyException.class);
    }

    @Test
    @DisplayName("cổng theo LỚP: lớp thuộc org nào thì theo giấy phép org ĐÓ, không theo org của người gõ")
    void classGate_followsClassOrg_notCallerOrg() {
        Long sickOrg = newOrg("SUSPENDED", null);
        Long healthyOrg = newOrg("ACTIVE", Instant.now().plus(30, ChronoUnit.DAYS));
        Long teacherId = newUser("two-orgs");
        member(healthyOrg, teacherId, "TEACHER");          // người gõ thuộc trung tâm KHOẺ
        Long sickClass = newClass(teacherId, sickOrg);     // nhưng lớp thuộc trung tâm ỐM

        assertThatThrownBy(() -> orgGuard.assertClassOrgWritable(sickClass))
                .isInstanceOf(OrgReadOnlyException.class);
        assertThatCode(() -> orgGuard.assertClassOrgWritable(newClass(teacherId, healthyOrg)))
                .doesNotThrowAnyException();
    }

    // ------------------------------- E1: những đường GHI VẪN PHẢI CHẠY khi chỉ-đọc ----------
    //
    // Danh mục ngoại lệ E1 (owner chốt): chốt điểm, bảng công, điểm danh, gỡ thành viên, đổi vai,
    // chuyển quyền giám đốc, tự rời trung tâm. Lý do chung: đều là "hoàn tất việc đã nhận" hoặc
    // "GIẢM ghế". Khoá nhầm nhóm này còn hại hơn để lọt một nút tạo mới — nó giam người dùng trong
    // một trung tâm họ không rời được, và chặn đúng thao tác làm hoá đơn nhỏ đi. Bốn ca dưới đây
    // chốt cứng bằng một trung tâm ĐÌNH CHỈ thật, để một bản vá "quét cổng cho đủ" sau này đỏ ngay.

    @Test
    @DisplayName("E1 — gỡ thành viên: trung tâm đình chỉ VẪN gỡ được (gỡ là GIẢM ghế, không phải tạo mới)")
    void e1_removeMember_stillAllowedOnSuspendedOrg() {
        Long orgId = newOrg("SUSPENDED", null);
        Long ownerId = newUser("e1-rm-owner");
        Long teacherId = newUser("e1-rm-teacher");
        member(orgId, ownerId, "OWNER");
        member(orgId, teacherId, "TEACHER");

        assertThatCode(() -> orgMembershipService.removeMember(orgId, teacherId, actor(ownerId)))
                .doesNotThrowAnyException();

        assertThat(memberStatus(orgId, teacherId)).isNotEqualTo("ACTIVE");
    }

    @Test
    @DisplayName("E1 — đổi vai: trung tâm đình chỉ VẪN đổi được vai thành viên")
    void e1_changeRole_stillAllowedOnSuspendedOrg() {
        Long orgId = newOrg("SUSPENDED", null);
        Long ownerId = newUser("e1-role-owner");
        Long teacherId = newUser("e1-role-teacher");
        member(orgId, ownerId, "OWNER");
        member(orgId, teacherId, "TEACHER");

        assertThatCode(() -> orgMembershipService.changeRole(orgId, teacherId, "MANAGER", actor(ownerId)))
                .doesNotThrowAnyException();

        assertThat(memberRole(orgId, teacherId)).isEqualTo("MANAGER");
    }

    @Test
    @DisplayName("E1 — chuyển quyền giám đốc: trung tâm hết hạn VẪN chuyển được (G-08 không được chết theo D5)")
    void e1_transferOwnership_stillAllowedOnExpiredOrg() {
        Long orgId = newOrg("ACTIVE", daysAgo(2));
        Long ownerId = newUser("e1-tr-owner");
        Long managerId = newUser("e1-tr-manager");
        member(orgId, ownerId, "OWNER");
        member(orgId, managerId, "MANAGER");

        assertThatCode(() -> orgMembershipService.transferOwnership(orgId, actor(ownerId), managerId))
                .doesNotThrowAnyException();

        assertThat(memberRole(orgId, managerId)).isEqualTo("OWNER");
    }

    @Test
    @DisplayName("E1 — tự rời: trung tâm đình chỉ KHÔNG được giam người ở lại")
    void e1_selfLeave_stillAllowedOnSuspendedOrg() {
        Long orgId = newOrg("SUSPENDED", null);
        Long ownerId = newUser("e1-leave-owner");
        Long teacherId = newUser("e1-leave-teacher");
        member(orgId, ownerId, "OWNER");
        member(orgId, teacherId, "TEACHER");

        assertThatCode(() -> orgMembershipService.selfLeave(orgId, actor(teacherId)))
                .doesNotThrowAnyException();

        assertThat(memberStatus(orgId, teacherId)).isNotEqualTo("ACTIVE");
    }

    private com.deutschflow.common.audit.AuditActor actor(Long userId) {
        return com.deutschflow.common.audit.AuditActor.of(userRepository.findById(userId).orElseThrow());
    }

    private String memberStatus(Long orgId, Long userId) {
        return jdbcTemplate.queryForObject(
                "SELECT status FROM org_members WHERE org_id = ? AND user_id = ?", String.class, orgId, userId);
    }

    private String memberRole(Long orgId, Long userId) {
        return jdbcTemplate.queryForObject(
                "SELECT role FROM org_members WHERE org_id = ? AND user_id = ?", String.class, orgId, userId);
    }

    @Test
    @DisplayName("đường ĐỌC không bị chặn: quản lý trung tâm đình chỉ vẫn assertOrgAdmin được")
    void readPath_stillAllowedOnSuspendedOrg() {
        Long orgId = newOrg("SUSPENDED", null);
        Long managerId = newUser("read-path");
        member(orgId, managerId, "MANAGER");

        assertThatCode(() -> orgGuard.assertOrgAdmin(managerId, orgId)).doesNotThrowAnyException();
        assertThatCode(() -> orgGuard.assertMember(managerId, orgId)).doesNotThrowAnyException();

        assertThatThrownBy(() -> orgGuard.assertOrgAdminForWrite(managerId, orgId))
                .isInstanceOf(OrgReadOnlyException.class);
    }
}
