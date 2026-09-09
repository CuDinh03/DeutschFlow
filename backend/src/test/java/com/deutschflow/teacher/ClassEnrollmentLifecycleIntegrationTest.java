package com.deutschflow.teacher;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.organization.service.OrgMembershipService;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.ClassTeacherId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.teacher.service.ClassEnrollmentService;
import com.deutschflow.teacher.service.StudentClassroomService;
import com.deutschflow.teacher.service.TeacherService;
import com.deutschflow.admin.service.AdminManagementService;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Gói 1 Đợt 4 trên PostgreSQL thật: V316 áp được, và vòng đời ghi danh cư xử đúng ba quyết định
 * của owner — D1 (bảo lưu vẫn giữ chỗ, vẫn xem được), D2 (gỡ khỏi lớp KHÔNG xoá dữ liệu học tập),
 * G-03 (rời trung tâm là cắt luôn quyền vào lớp của trung tâm ấy, không đụng lớp B2C).
 */
@SpringBootTest
@DisplayName("Class enrollment lifecycle Integration Tests (V316, G-01…G-03)")
class ClassEnrollmentLifecycleIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private ClassEnrollmentService enrollmentService;
    @Autowired private ClassStudentRepository classStudentRepository;
    @Autowired private ClassTeacherRepository classTeacherRepository;
    @Autowired private TeacherClassRepository classRepo;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository memberRepo;
    @Autowired private OrgMembershipService membershipService;
    @Autowired private StudentClassroomService studentClassroomService;
    @Autowired private TeacherService teacherService;
    @Autowired private UserNotificationService userNotificationService;
    @Autowired private AdminManagementService adminManagementService;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    // ── V316 ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("V316(a): dòng ghi danh mới mặc định ACTIVE; CHECK chặn trạng thái lạ")
    void migration_defaultActive_andCheckConstraint() {
        Fixture f = fixture();
        enrollmentService.enroll(f.orgClass.getId(), f.student.getId());

        ClassStudent row = classStudentRepository
                .findById(new ClassStudentId(f.orgClass.getId(), f.student.getId())).orElseThrow();
        assertThat(row.getStatus()).isEqualTo(ClassStudent.STATUS_ACTIVE);
        assertThat(row.getEndedAt()).isNull();

        assertThatThrownBy(() -> jdbcTemplate.update(
                "UPDATE class_students SET status = 'NGHI_HOC' WHERE class_id = ? AND student_id = ?",
                f.orgClass.getId(), f.student.getId()))
                .hasMessageContaining("chk_class_students_status");
    }

    @Test
    @DisplayName("V316(b): cột can_teach NOT NULL mặc định false, và câu backfill chỉ bật đúng vai TEACHER")
    void migration_canTeachColumnAndBackfill() {
        Fixture f = fixture();

        // Hình dạng cột: NOT NULL + DEFAULT false. Dòng mới (sau migration) nhận false, đúng như
        // thiết kế — đợt này KHÔNG đổi hành vi, cột chỉ để PR sau của Đợt 4 dùng.
        assertThat(jdbcTemplate.queryForObject("""
                SELECT is_nullable || '|' || column_default FROM information_schema.columns
                WHERE table_name = 'org_members' AND column_name = 'can_teach'
                """, String.class)).isEqualTo("NO|false");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT can_teach FROM org_members WHERE org_id = ? AND user_id = ?",
                Boolean.class, f.org.getId(), f.teacher.getId())).isFalse();

        // Backfill: chạy lại ĐÚNG câu UPDATE của migration trên các dòng vừa tạo (không thể dựng
        // dòng "có trước migration" trong một IT) — bật TEACHER, không đụng vai khác.
        int flipped = jdbcTemplate.update(
                "UPDATE org_members SET can_teach = true WHERE role = 'TEACHER' AND can_teach = false");
        assertThat(flipped).isGreaterThanOrEqualTo(2);   // teacher + assistant của fixture
        assertThat(jdbcTemplate.queryForObject(
                "SELECT can_teach FROM org_members WHERE org_id = ? AND user_id = ?",
                Boolean.class, f.org.getId(), f.teacher.getId())).isTrue();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT can_teach FROM org_members WHERE org_id = ? AND user_id = ?",
                Boolean.class, f.org.getId(), f.student.getId())).isFalse();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT can_teach FROM org_members WHERE org_id = ? AND user_id = ?",
                Boolean.class, f.org.getId(), f.owner.getId())).isFalse();
        // Idempotent: chạy lần hai không đổi dòng nào.
        assertThat(jdbcTemplate.update(
                "UPDATE org_members SET can_teach = true WHERE role = 'TEACHER' AND can_teach = false"))
                .isZero();
    }

    @Test
    @DisplayName("V316(c): bảng org_member_history tồn tại và nhận được một dòng append-only")
    void migration_orgMemberHistoryTableExists() {
        Fixture f = fixture();
        jdbcTemplate.update("""
                INSERT INTO org_member_history (org_id, user_id, action, from_role, to_role, actor_user_id)
                VALUES (?, ?, 'JOINED', NULL, 'STUDENT', ?)
                """, f.org.getId(), f.student.getId(), f.owner.getId());

        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM org_member_history WHERE org_id = ? AND user_id = ?",
                Long.class, f.org.getId(), f.student.getId())).isEqualTo(1L);
    }

    @Test
    @DisplayName("V316(d): organizations.suspended_at là TIMESTAMPTZ nullable, không DEFAULT; trung tâm ACTIVE để NULL")
    void migration_suspendedAtColumnShape() {
        Fixture f = fixture();

        Map<String, Object> col = jdbcTemplate.queryForMap("""
                SELECT is_nullable, data_type, column_default FROM information_schema.columns
                WHERE table_name = 'organizations' AND column_name = 'suspended_at'
                """);
        assertThat(col.get("is_nullable")).isEqualTo("YES");
        // Phải khớp kiểu valid_until để máy trạng thái giấy phép so hai mốc được.
        assertThat(col.get("data_type")).isEqualTo("timestamp with time zone");
        // KHÔNG DEFAULT: NULL = không bị đình chỉ, và ADD COLUMN khỏi viết lại bảng.
        assertThat(col.get("column_default")).isNull();

        // Trung tâm ACTIVE: không có mốc neo đình chỉ.
        assertThat(organizationRepo.findById(f.org.getId()).orElseThrow().getSuspendedAt()).isNull();

        // Entity ghi/đọc được mốc, và nó thật sự nằm ở cột suspended_at.
        Instant anchorAt = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        Organization org = organizationRepo.findById(f.org.getId()).orElseThrow();
        org.setSuspendedAt(anchorAt);
        organizationRepo.saveAndFlush(org);

        assertThat(jdbcTemplate.queryForObject(
                "SELECT suspended_at FROM organizations WHERE id = ?", Timestamp.class, f.org.getId())
                .toInstant()).isEqualTo(anchorAt);
    }

    @Test
    @DisplayName("V316(d): backfill đóng mốc now() cho trung tâm đang bị đình chỉ, chừa ACTIVE, chạy lại là no-op")
    void migration_suspendedAtBackfill() {
        Fixture f = fixture();
        Organization suspended = organizationRepo.save(Organization.builder()
                .name("TT dinh chi " + UUID.randomUUID().toString().substring(0, 8))
                .slug("org-susp-" + UUID.randomUUID())
                .seatLimit(0)
                .status("SUSPENDED")
                .build());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT suspended_at FROM organizations WHERE id = ?", Timestamp.class,
                suspended.getId())).isNull();

        Instant beforeBackfill = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        // Chạy lại ĐÚNG câu backfill của migration — không dựng được dòng "có trước V316" trong IT.
        //
        // 🪤 Có thêm `AND id = ?`: cơ sở dữ liệu của lớp IT này DÙNG CHUNG giữa các ca và
        // AbstractPostgresIntegrationTest không bọc transaction để rollback. Chạy câu UPDATE ở phạm
        // vi TOÀN CỤC thì ca này ghi đè dữ liệu của ca khác, và bất kỳ ca nào sau này dựng một trung
        // tâm không-ACTIVE rồi kỳ vọng suspended_at NULL sẽ đỏ NGẪU NHIÊN theo thứ tự chạy — kiểu
        // đỏ tốn nhiều giờ nhất để truy. Chốt "chừa trung tâm ACTIVE" vẫn được kiểm bên dưới bằng
        // một câu ĐỌC, không cần tới phạm vi ghi.
        jdbcTemplate.update("UPDATE organizations SET suspended_at = now() "
                + "WHERE status <> 'ACTIVE' AND suspended_at IS NULL AND id = ?", suspended.getId());

        Timestamp anchored = jdbcTemplate.queryForObject(
                "SELECT suspended_at FROM organizations WHERE id = ?", Timestamp.class,
                suspended.getId());
        assertThat(anchored).isNotNull();
        // now() chứ KHÔNG phải mốc quá khứ: ân hạn 7 ngày đếm TỪ LÚC DEPLOY, không cắt ngay.
        assertThat(anchored.toInstant()).isAfterOrEqualTo(beforeBackfill);

        // Trung tâm ACTIVE không bị đụng tới.
        assertThat(jdbcTemplate.queryForObject(
                "SELECT suspended_at FROM organizations WHERE id = ?", Timestamp.class,
                f.org.getId())).isNull();

        // Idempotent: chạy lần hai KHÔNG đè lên mốc đã có.
        jdbcTemplate.update("UPDATE organizations SET suspended_at = now() "
                + "WHERE status <> 'ACTIVE' AND suspended_at IS NULL");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT suspended_at FROM organizations WHERE id = ?", Timestamp.class,
                suspended.getId()).toInstant()).isEqualTo(anchored.toInstant());
    }

    // ── G-01: hai tập "còn chiếm ghế" vs "đang học" ──────────────────────────

    @Test
    @DisplayName("G-01/D1: bảo lưu VẪN tính sĩ số và VẪN xem được lớp; người đã rời thì không")
    void seatSetVsAttendingSet() {
        Fixture f = fixture();
        Long classId = f.orgClass.getId();
        enrollmentService.enroll(classId, f.student.getId());
        enrollmentService.enroll(classId, f.student2.getId());
        enrollmentService.enroll(classId, f.student3.getId());
        setStatus(classId, f.student2.getId(), ClassStudent.STATUS_RESERVED);

        // student1 ACTIVE, student2 RESERVED, student3 ACTIVE
        assertThat(classStudentRepository.countByIdClassId(classId)).isEqualTo(3);
        assertThat(classStudentRepository.findActiveByIdClassId(classId)).hasSize(2);
        // D1: người bảo lưu vẫn qua được biên "thuộc lớp" → vẫn đọc được nội dung.
        assertThat(classStudentRepository
                .existsByIdClassIdAndIdStudentId(classId, f.student2.getId())).isTrue();

        // Gỡ student3 → tụt khỏi CẢ hai tập, nhưng dòng vẫn còn.
        enrollmentService.endByTeacher(f.teacher.getId(), classId, f.student3.getId(), actor(f.teacher));
        assertThat(classStudentRepository.countByIdClassId(classId)).isEqualTo(2);
        assertThat(classStudentRepository.findActiveByIdClassId(classId)).hasSize(1);
        assertThat(classStudentRepository
                .existsByIdClassIdAndIdStudentId(classId, f.student3.getId())).isFalse();
        assertThat(classStudentRepository
                .findById(new ClassStudentId(classId, f.student3.getId()))).isPresent();

        // findByIdClassIdIn (đường batch) lọc cùng một luật.
        assertThat(classStudentRepository.findByIdClassIdIn(List.of(classId))).hasSize(2);
    }

    // ── G-02: gỡ MỘT học viên khỏi MỘT lớp ───────────────────────────────────

    @Test
    @DisplayName("G-02/D2: gỡ khỏi lớp KHÔNG xoá dòng — nhận xét và điểm kỹ năng còn nguyên")
    void endByTeacher_keepsLearningData() {
        Fixture f = fixture();
        Long classId = f.orgClass.getId();
        enrollmentService.enroll(classId, f.student.getId());
        ClassStudentId key = new ClassStudentId(classId, f.student.getId());
        ClassStudent graded = classStudentRepository.findById(key).orElseThrow();
        graded.setSkillHoren(new BigDecimal("8.5"));
        graded.setTeacherComment("Tiến bộ đều");
        classStudentRepository.saveAndFlush(graded);

        enrollmentService.endByTeacher(f.teacher.getId(), classId, f.student.getId(), actor(f.teacher));

        ClassStudent after = classStudentRepository.findById(key).orElseThrow();
        assertThat(after.getStatus()).isEqualTo(ClassStudent.STATUS_ENDED);
        assertThat(after.getEndReason()).isEqualTo(ClassStudent.END_REASON_BY_TEACHER);
        assertThat(after.getEndedAt()).isNotNull();
        assertThat(after.getSkillHoren()).isEqualByComparingTo("8.5");
        assertThat(after.getTeacherComment()).isEqualTo("Tiến bộ đều");
    }

    @Test
    @DisplayName("G-02: ghi danh lại người đã rời lớp thì MỞ LẠI dòng cũ, không xoá điểm cũ")
    void reEnroll_reopensWithoutWipingGrades() {
        Fixture f = fixture();
        Long classId = f.orgClass.getId();
        enrollmentService.enroll(classId, f.student.getId());
        ClassStudentId key = new ClassStudentId(classId, f.student.getId());
        ClassStudent graded = classStudentRepository.findById(key).orElseThrow();
        graded.setSkillLesen(new BigDecimal("7.0"));
        classStudentRepository.saveAndFlush(graded);
        enrollmentService.endByTeacher(f.teacher.getId(), classId, f.student.getId(), actor(f.teacher));

        assertThat(enrollmentService.enroll(classId, f.student.getId())).isTrue();

        ClassStudent back = classStudentRepository.findById(key).orElseThrow();
        assertThat(back.getStatus()).isEqualTo(ClassStudent.STATUS_ACTIVE);
        assertThat(back.getEndedAt()).isNull();
        assertThat(back.getEndReason()).isNull();
        assertThat(back.getSkillLesen()).isEqualByComparingTo("7.0");
    }

    @Test
    @DisplayName("D1: enroll() KHÔNG được huỷ bảo lưu — người đang RESERVED giữ nguyên trạng thái")
    void enroll_doesNotCancelReservation() {
        Fixture f = fixture();
        Long classId = f.orgClass.getId();
        enrollmentService.enroll(classId, f.student.getId());
        ClassStudentId key = new ClassStudentId(classId, f.student.getId());

        // Đặt bảo lưu thẳng trên cơ sở dữ liệu: đợt này chưa có API bảo lưu, nhưng cột đã tồn tại
        // và nhập lại roster CSV là đường sẽ vấp ngay khi đợt sau mở API.
        jdbcTemplate.update("UPDATE class_students SET status = 'RESERVED' "
                + "WHERE class_id = ? AND student_id = ?", classId, f.student.getId());

        // Gọi lại enroll như khi nhập lại roster: KHÔNG được lật về ACTIVE, và phải trả false
        // ("lượt này không đưa ai trở lại lớp") để cờ `enrolled` của kết quả nhập đếm đúng.
        assertThat(enrollmentService.enroll(classId, f.student.getId())).isFalse();

        ClassStudent after = classStudentRepository.findById(key).orElseThrow();
        assertThat(after.getStatus()).isEqualTo(ClassStudent.STATUS_RESERVED);
    }

    @Test
    @DisplayName("G-02: trợ giảng bị chặn; org-admin gỡ được; lớp trung tâm KHÁC trả 404 (chống IDOR)")
    void removalAuthorization() {
        Fixture f = fixture();
        Fixture other = fixture();
        Long classId = f.orgClass.getId();
        enrollmentService.enroll(classId, f.student.getId());

        assertThatThrownBy(() -> enrollmentService.endByTeacher(
                f.assistant.getId(), classId, f.student.getId(), actor(f.assistant)))
                .isInstanceOf(ForbiddenException.class);

        assertThatThrownBy(() -> enrollmentService.endByOrgAdmin(
                other.org.getId(), classId, f.student.getId(), actor(other.owner)))
                .isInstanceOf(NotFoundException.class);
        assertThat(classStudentRepository.existsByIdClassIdAndIdStudentId(classId, f.student.getId()))
                .isTrue();

        enrollmentService.endByOrgAdmin(f.org.getId(), classId, f.student.getId(), actor(f.owner));
        assertThat(classStudentRepository.findById(new ClassStudentId(classId, f.student.getId()))
                .orElseThrow().getEndReason()).isEqualTo(ClassStudent.END_REASON_BY_ORG);
    }

    @Test
    @DisplayName("G-02: gỡ học viên có ghi vết audit mang org_id của lớp")
    void removal_writesAuditWithOrgId() {
        Fixture f = fixture();
        Long classId = f.orgClass.getId();
        enrollmentService.enroll(classId, f.student.getId());

        enrollmentService.endByOrgAdmin(f.org.getId(), classId, f.student.getId(), actor(f.owner));

        assertThat(jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM audit_logs
                WHERE event_name = 'class_student_removed' AND target_id = ?
                """, Long.class, classId + ":" + f.student.getId())).isEqualTo(1L);
    }

    // ── G-03: rời trung tâm = mất quyền vào lớp của trung tâm ấy ─────────────

    @Test
    @DisplayName("G-03: rời trung tâm đóng ghi danh lớp CỦA TRUNG TÂM ẤY — lớp B2C không bị đụng")
    void leavingOrg_endsOrgEnrollmentsOnly() {
        Fixture f = fixture();
        enrollmentService.enroll(f.orgClass.getId(), f.student.getId());
        enrollmentService.enroll(f.personalClass.getId(), f.student.getId());
        assertThat(studentClassroomService.listMyClasses(f.student.getId())).hasSize(2);

        membershipService.selfLeave(f.org.getId(), actor(f.student));

        assertThat(classStudentRepository
                .existsByIdClassIdAndIdStudentId(f.orgClass.getId(), f.student.getId())).isFalse();
        assertThat(classStudentRepository
                .findById(new ClassStudentId(f.orgClass.getId(), f.student.getId()))
                .orElseThrow().getEndReason()).isEqualTo(ClassStudent.END_REASON_LEFT_ORG);
        // Lớp B2C của chính học viên: KHÔNG bị đụng.
        assertThat(classStudentRepository
                .existsByIdClassIdAndIdStudentId(f.personalClass.getId(), f.student.getId())).isTrue();
        assertThat(studentClassroomService.listMyClasses(f.student.getId()))
                .extracting(c -> c.id())
                .containsExactly(f.personalClass.getId());
    }

    @Test
    @DisplayName("G-03: trung tâm gỡ thành viên cũng cắt quyền vào lớp, và lớp trung tâm KHÁC còn nguyên")
    void removeMember_endsEnrollments_otherOrgUntouched() {
        Fixture f = fixture();
        Fixture other = fixture();
        enrollmentService.enroll(f.orgClass.getId(), f.student.getId());
        enrollmentService.enroll(other.orgClass.getId(), f.student.getId());

        membershipService.removeMember(f.org.getId(), f.student.getId(), actor(f.owner));

        assertThat(classStudentRepository
                .existsByIdClassIdAndIdStudentId(f.orgClass.getId(), f.student.getId())).isFalse();
        assertThat(classStudentRepository
                .existsByIdClassIdAndIdStudentId(other.orgClass.getId(), f.student.getId())).isTrue();
    }

    // ── G-01b: các đường KHÔNG đi qua repository (SQL trần) cũng phải lọc ────

    @Test
    @DisplayName("G-01b: người đã bị gỡ khỏi lớp KHÔNG còn nhận thông báo của lớp; bảo lưu thì vẫn nhận")
    void announcement_skipsRemovedStudent_keepsReserved() {
        Fixture f = fixture();
        Long classId = f.orgClass.getId();
        enrollmentService.enroll(classId, f.student.getId());
        enrollmentService.enroll(classId, f.student2.getId());
        enrollmentService.enroll(classId, f.student3.getId());
        setStatus(classId, f.student2.getId(), ClassStudent.STATUS_RESERVED);
        enrollmentService.endByTeacher(f.teacher.getId(), classId, f.student3.getId(), actor(f.teacher));

        int sent = userNotificationService.announceToClass(
                f.teacher.getId(), "GV", classId, "A1", "Mai nghỉ học");

        // student1 (ACTIVE) + student2 (RESERVED, D1 vẫn xem được) = 2; student3 đã rời lớp thì KHÔNG.
        assertThat(sent).isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_notifications WHERE recipient_user_id = ?",
                Long.class, f.student3.getId())).isZero();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_notifications WHERE recipient_user_id = ?",
                Long.class, f.student2.getId())).isEqualTo(1L);
    }

    @Test
    @DisplayName("G-01b: sĩ số trên THẺ LỚP (SQL trần) khớp countByIdClassId sau khi gỡ học viên")
    void classCardStudentCount_matchesRepositoryCount() {
        Fixture f = fixture();
        Long classId = f.orgClass.getId();
        enrollmentService.enroll(classId, f.student.getId());
        enrollmentService.enroll(classId, f.student2.getId());
        enrollmentService.endByTeacher(f.teacher.getId(), classId, f.student2.getId(), actor(f.teacher));

        long fromCard = teacherService.getClassesForTeacher(f.teacher.getId()).stream()
                .filter(c -> c.id().equals(classId))
                .findFirst().orElseThrow().studentCount();

        assertThat(fromCard).isEqualTo(1L);
        assertThat(fromCard).isEqualTo(classStudentRepository.countByIdClassId(classId));
    }

    @Test
    @DisplayName("G-01b: admin nền tảng xếp lại học viên đã rời lớp thì MỞ LẠI dòng cũ, không im lặng bỏ qua")
    void adminBulkAssign_reopensEndedEnrollment() {
        Fixture f = fixture();
        Long classId = f.orgClass.getId();
        enrollmentService.enroll(classId, f.student.getId());
        ClassStudentId key = new ClassStudentId(classId, f.student.getId());
        ClassStudent graded = classStudentRepository.findById(key).orElseThrow();
        graded.setSkillLesen(new java.math.BigDecimal("6.5"));
        classStudentRepository.saveAndFlush(graded);
        enrollmentService.endByTeacher(f.teacher.getId(), classId, f.student.getId(), actor(f.teacher));

        Object assigned = adminManagementService
                .bulkAssignStudents(classId, List.of(f.student.getId())).get("assignedCount");

        assertThat(assigned).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT status FROM class_students WHERE class_id = ? AND student_id = ?",
                String.class, classId, f.student.getId())).isEqualTo(ClassStudent.STATUS_ACTIVE);
        // D2: mở lại KHÔNG được xoá điểm cũ.
        assertThat(jdbcTemplate.queryForObject(
                "SELECT skill_lesen FROM class_students WHERE class_id = ? AND student_id = ?",
                java.math.BigDecimal.class, classId, f.student.getId()))
                .isEqualByComparingTo("6.5");
    }

    // ── fixtures ─────────────────────────────────────────────────────────────

    private record Fixture(Organization org, User owner, User teacher, User assistant,
                           User student, User student2, User student3,
                           TeacherClass orgClass, TeacherClass personalClass) {}

    private Fixture fixture() {
        Organization org = organizationRepo.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug("org-" + UUID.randomUUID())
                .seatLimit(0)
                .status("ACTIVE")
                .build());
        User owner = member(org, "OWNER", User.Role.OWNER);
        User teacher = member(org, "TEACHER", User.Role.TEACHER);
        User assistant = member(org, "TEACHER", User.Role.TEACHER);
        User student = member(org, "STUDENT", User.Role.STUDENT);
        User student2 = member(org, "STUDENT", User.Role.STUDENT);
        User student3 = member(org, "STUDENT", User.Role.STUDENT);

        TeacherClass orgClass = newClass(teacher.getId(), org.getId());
        classTeacherRepository.save(ClassTeacher.builder()
                .id(new ClassTeacherId(orgClass.getId(), teacher.getId())).role("PRIMARY").build());
        classTeacherRepository.save(ClassTeacher.builder()
                .id(new ClassTeacherId(orgClass.getId(), assistant.getId())).role("ASSISTANT").build());

        // Lớp B2C (org_id NULL) của chính học viên — biên kiểm "đừng đụng lớp ngoài trung tâm".
        TeacherClass personalClass = newClass(teacher.getId(), null);
        return new Fixture(org, owner, teacher, assistant, student, student2, student3,
                orgClass, personalClass);
    }

    private User member(Organization org, String orgRole, User.Role userRole) {
        User u = userRepository.save(User.builder()
                .email("cel-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Lifecycle " + orgRole)
                .role(userRole)
                .build());
        u.setOrgId(org.getId());
        userRepository.save(u);
        OrgMember m = new OrgMember();
        m.setId(new OrgMemberId(org.getId(), u.getId()));
        m.setRole(orgRole);
        m.setStatus("ACTIVE");
        m.setJoinedAt(Instant.now());
        memberRepo.save(m);
        return u;
    }

    private TeacherClass newClass(Long teacherId, Long orgId) {
        return classRepo.save(TeacherClass.builder()
                .teacherId(teacherId)
                .orgId(orgId)
                .name("A1 — " + UUID.randomUUID().toString().substring(0, 8))
                .inviteCode("INV-" + UUID.randomUUID())
                .createdAt(LocalDateTime.now())
                .build());
    }

    private void setStatus(Long classId, Long studentId, String status) {
        jdbcTemplate.update("UPDATE class_students SET status = ? WHERE class_id = ? AND student_id = ?",
                status, classId, studentId);
    }

    private AuditActor actor(User u) {
        return new AuditActor(u.getId(), u.getEmail(), u.getRole().name());
    }
}
