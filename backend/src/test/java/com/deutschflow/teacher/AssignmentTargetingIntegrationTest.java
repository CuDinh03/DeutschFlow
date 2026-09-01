package com.deutschflow.teacher;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.organization.dto.AssignCurriculumRequest;
import com.deutschflow.organization.dto.CreateCurriculumRequest;
import com.deutschflow.organization.dto.CurriculumItemInput;
import com.deutschflow.organization.dto.ReplaceItemsRequest;
import com.deutschflow.organization.dto.UpsertLektionRequest;
import com.deutschflow.organization.entity.OrgAcademicApprover;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgAcademicApproverRepository;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.organization.service.OrgCurriculumAssignmentService;
import com.deutschflow.organization.service.OrgCurriculumService;
import com.deutschflow.teacher.dto.ClassAssignmentDto;
import com.deutschflow.teacher.dto.CreateAssignmentRequest;
import com.deutschflow.teacher.dto.StudentAssignmentDto;
import com.deutschflow.teacher.dto.UpdateSessionRequest;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.ClassSession;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.ClassTeacherId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.ClassSessionRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.teacher.service.AssignmentBackfillService;
import com.deutschflow.teacher.service.ClassScheduleService;
import com.deutschflow.teacher.service.ScheduleChangeRequestService;
import com.deutschflow.teacher.service.StudentClassroomService;
import com.deutschflow.teacher.service.TeacherService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * PR-8 (GĐ4) trên PostgreSQL thật: giao bài theo NGƯỜI NHẬN (AC14) + nháp→công bố (P06) +
 * backfill late-joiner chỉ áp bài cả-lớp + bài nháp gắn buổi tự dời hạn khi buổi dời qua duyệt.
 */
@SpringBootTest
@DisplayName("Assignment targeting Integration Tests (V297, AC14/P06)")
class AssignmentTargetingIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private TeacherService teacherService;
    @Autowired private StudentClassroomService studentClassroomService;
    @Autowired private AssignmentBackfillService backfillService;
    @Autowired private ClassScheduleService scheduleService;
    @Autowired private ScheduleChangeRequestService requestService;
    @Autowired private OrgCurriculumService curriculumService;
    @Autowired private OrgCurriculumAssignmentService assignmentService;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository orgMemberRepo;
    @Autowired private OrgAcademicApproverRepository approverRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private TeacherClassRepository classRepo;
    @Autowired private ClassTeacherRepository classTeacherRepo;
    @Autowired private ClassStudentRepository classStudentRepo;
    @Autowired private ClassSessionRepository sessionRepo;
    @Autowired private ClassAssignmentRepository assignmentRepo;
    @Autowired private StudentAssignmentRepository studentAssignmentRepo;
    @Autowired private JdbcTemplate jdbcTemplate;

    // ── AC14: giao theo người nhận ──────────────────────────────────────────

    @Test
    @DisplayName("AC14: bài giao cho [A] — chỉ A có StudentAssignment + notification + thấy trong list; B thì không")
    void targeted_onlyRecipientsReceive() throws InterruptedException {
        Fixture f = fixture();
        ClassAssignmentDto dto = teacherService.createAssignment(f.teacher.getId(), f.klass.getId(),
                req("Bài riêng A", "PUBLISHED", List.of(f.studentA.getId()), null));

        assertThat(dto.status()).isEqualTo("PUBLISHED");
        assertThat(dto.recipientCount()).isEqualTo(1);
        assertThat(rowsOf(dto.id())).containsExactly(f.studentA.getId());
        awaitNotifications(f.studentA.getId(), 1);
        assertThat(notificationsFor(f.studentB.getId())).isZero();

        assertThat(topics(f.studentA.getId(), f.klass.getId())).contains("Bài riêng A");
        assertThat(topics(f.studentB.getId(), f.klass.getId())).doesNotContain("Bài riêng A");
    }

    @Test
    @DisplayName("Cả lớp (không recipients): mọi học viên nhận và thấy — hành vi cũ nguyên vẹn")
    void wholeClass_everyoneReceives() {
        Fixture f = fixture();
        ClassAssignmentDto dto = teacherService.createAssignment(f.teacher.getId(), f.klass.getId(),
                req("Bài cả lớp", null, null, null));

        assertThat(dto.recipientCount()).isZero();
        assertThat(rowsOf(dto.id())).containsExactlyInAnyOrder(f.studentA.getId(), f.studentB.getId());
        assertThat(topics(f.studentA.getId(), f.klass.getId())).contains("Bài cả lớp");
        assertThat(topics(f.studentB.getId(), f.klass.getId())).contains("Bài cả lớp");
    }

    // ── P06: nháp → công bố ─────────────────────────────────────────────────

    @Test
    @DisplayName("P06: bài NHÁP vô hình (không row/notification/list); công bố → xuất hiện + notify; công bố lần hai 409")
    void draft_invisibleUntilPublished() throws InterruptedException {
        Fixture f = fixture();
        ClassAssignmentDto draft = teacherService.createAssignment(f.teacher.getId(), f.klass.getId(),
                req("Bài nháp", "DRAFT", null, null));

        assertThat(draft.status()).isEqualTo("DRAFT");
        assertThat(draft.publishedAt()).isNull();
        assertThat(rowsOf(draft.id())).isEmpty();
        assertThat(notificationsFor(f.studentA.getId())).isZero();
        assertThat(topics(f.studentA.getId(), f.klass.getId())).doesNotContain("Bài nháp");

        ClassAssignmentDto published = teacherService.publishAssignment(
                f.teacher.getId(), f.klass.getId(), draft.id());
        assertThat(published.status()).isEqualTo("PUBLISHED");
        assertThat(published.publishedAt()).isNotNull();
        assertThat(rowsOf(draft.id())).containsExactlyInAnyOrder(f.studentA.getId(), f.studentB.getId());
        awaitNotifications(f.studentA.getId(), 1);
        assertThat(topics(f.studentA.getId(), f.klass.getId())).contains("Bài nháp");

        assertThatThrownBy(() -> teacherService.publishAssignment(f.teacher.getId(), f.klass.getId(), draft.id()))
                .isInstanceOf(ConflictException.class);
    }

    // ── Late-joiner backfill ────────────────────────────────────────────────

    @Test
    @DisplayName("Backfill người vào sau: nhận bài cả-lớp PUBLISHED; KHÔNG nhận bài nháp, KHÔNG nhận bài giao người khác")
    void backfill_respectsAudience() {
        Fixture f = fixture();
        teacherService.createAssignment(f.teacher.getId(), f.klass.getId(), req("Cả lớp cũ", null, null, null));
        teacherService.createAssignment(f.teacher.getId(), f.klass.getId(), req("Nháp cũ", "DRAFT", null, null));
        teacherService.createAssignment(f.teacher.getId(), f.klass.getId(),
                req("Riêng A cũ", "PUBLISHED", List.of(f.studentA.getId()), null));

        User late = newUser(User.Role.STUDENT);
        classStudentRepo.save(ClassStudent.builder()
                .id(new ClassStudentId(f.klass.getId(), late.getId()))
                .joinedAt(LocalDateTime.now())
                .build());
        int created = backfillService.ensureAssignmentsForStudent(f.klass.getId(), late.getId());

        assertThat(created).isEqualTo(1); // chỉ "Cả lớp cũ"
        List<String> lateTopics = topics(late.getId(), f.klass.getId());
        assertThat(lateTopics).contains("Cả lớp cũ");
        assertThat(lateTopics).doesNotContain("Nháp cũ", "Riêng A cũ");
    }

    // ── Buổi dời qua duyệt: bài NHÁP tự dời hạn, bài CÔNG BỐ giữ nguyên ─────

    @Test
    @DisplayName("Buổi dời qua duyệt: bài NHÁP gắn buổi dời hạn theo cùng delta; bài CÔNG BỐ giữ hạn; impact đếm bài công bố")
    void movedSession_shiftsDraftDueDates() {
        Fixture f = fixture();
        ClassSession s = saveSession(f.klass.getId(), nextMonday().atTime(8, 0));
        LocalDateTime due = nextMonday().atTime(23, 0);
        ClassAssignmentDto draft = teacherService.createAssignment(f.teacher.getId(), f.klass.getId(),
                req("Nháp theo buổi", "DRAFT", null, s.getId(), due));
        ClassAssignmentDto published = teacherService.createAssignment(f.teacher.getId(), f.klass.getId(),
                req("Công bố theo buổi", "PUBLISHED", null, s.getId(), due));

        // Dời buổi +2 ngày (qua luồng duyệt của lớp giáo trình)
        Long reqId = scheduleService.updateSession(f.teacher.getId(), s.getId(),
                new UpdateSessionRequest(nextMonday().plusDays(2).atTime(8, 0), null, null, "P.101", null))
                .pendingRequestId();
        var request = requestService.listForTeacher(f.teacher.getId(), f.klass.getId()).stream()
                .filter(r -> r.id().equals(reqId)).findFirst().orElseThrow();
        assertThat(request.impactSnapshot().get("publishedAssignmentsOnSession"))
                .isEqualTo(1); // người duyệt thấy 1 bài công bố bị chạm
        requestService.approve(f.owner.getId(), f.org.getId(), reqId);

        ClassAssignment draftAfter = assignmentRepo.findById(draft.id()).orElseThrow();
        ClassAssignment publishedAfter = assignmentRepo.findById(published.id()).orElseThrow();
        assertThat(draftAfter.getDueDate()).isEqualTo(due.plusDays(2));   // nháp dời theo
        assertThat(publishedAfter.getDueDate()).isEqualTo(due);           // công bố đứng yên — GV quyết
    }

    // ── Hợp đồng student không đổi ──────────────────────────────────────────

    @Test
    @DisplayName("P08: shape StudentAssignmentDto của bài cả-lớp không đổi khi lớp có thêm bài nháp/bài giao riêng")
    void studentContract_unchanged() {
        Fixture f = fixture();
        teacherService.createAssignment(f.teacher.getId(), f.klass.getId(), req("Bài thường", null, null, null));
        List<StudentAssignmentDto> before = studentClassroomService.listAssignments(f.studentB.getId(), f.klass.getId());

        teacherService.createAssignment(f.teacher.getId(), f.klass.getId(), req("Nháp", "DRAFT", null, null));
        teacherService.createAssignment(f.teacher.getId(), f.klass.getId(),
                req("Riêng A", "PUBLISHED", List.of(f.studentA.getId()), null));

        List<StudentAssignmentDto> after = studentClassroomService.listAssignments(f.studentB.getId(), f.klass.getId());
        assertThat(after).isEqualTo(before); // B không thấy gì mới — và bài cũ giữ nguyên từng field
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    private record Fixture(Organization org, User owner, User teacher, User studentA, User studentB,
                           TeacherClass klass) {}

    private Fixture fixture() {
        Organization org = organizationRepo.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug("org-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
        User owner = newUser(User.Role.TEACHER);
        User teacher = newUser(User.Role.TEACHER);
        User studentA = newUser(User.Role.STUDENT);
        User studentB = newUser(User.Role.STUDENT);
        member(org.getId(), owner.getId(), "OWNER");
        member(org.getId(), teacher.getId(), "TEACHER");
        approverRepo.save(OrgAcademicApprover.builder()
                .orgId(org.getId()).userId(owner.getId()).scope("ORG")
                .grantedBy(owner.getId()).grantedAt(LocalDateTime.now()).build());

        TeacherClass klass = classRepo.save(TeacherClass.builder()
                .teacherId(teacher.getId())
                .orgId(org.getId())
                .name("A1 · " + UUID.randomUUID().toString().substring(0, 8))
                .inviteCode("INV-" + UUID.randomUUID())
                .createdAt(LocalDateTime.now())
                .build());
        classTeacherRepo.save(ClassTeacher.builder()
                .id(new ClassTeacherId(klass.getId(), teacher.getId()))
                .role("PRIMARY")
                .joinedAt(LocalDateTime.now())
                .build());
        for (User st : List.of(studentA, studentB)) {
            classStudentRepo.save(ClassStudent.builder()
                    .id(new ClassStudentId(klass.getId(), st.getId()))
                    .joinedAt(LocalDateTime.now())
                    .build());
        }

        // Gắn giáo trình để bật gate duyệt lịch (ca dời buổi qua duyệt).
        var curriculum = curriculumService.create(owner.getId(), org.getId(),
                new CreateCurriculumRequest("Bộ PR-8 " + UUID.randomUUID().toString().substring(0, 6), "A1", null));
        Long versionId = curriculum.versions().get(0).id();
        var lektion = curriculumService.addLektion(org.getId(), versionId,
                new UpsertLektionRequest("Lektion 1", null));
        curriculumService.replaceItems(org.getId(), lektion.id(), new ReplaceItemsRequest(List.of(
                new CurriculumItemInput("Mục A", null, "GRAMMATIK", 60))));
        curriculumService.publish(owner.getId(), org.getId(), versionId);
        assignmentService.assign(owner.getId(), org.getId(), klass.getId(), new AssignCurriculumRequest(versionId));
        return new Fixture(org, owner, teacher, studentA, studentB, klass);
    }

    private static CreateAssignmentRequest req(String topic, String status, List<Long> recipients, Long sessionId) {
        return req(topic, status, recipients, sessionId, null);
    }

    private static CreateAssignmentRequest req(String topic, String status, List<Long> recipients,
                                               Long sessionId, LocalDateTime dueDate) {
        return new CreateAssignmentRequest(topic, "Mô tả", "GENERAL", "GENERAL", null, dueDate, null,
                null, null, status, sessionId, null, null, recipients);
    }

    private List<Long> rowsOf(Long assignmentId) {
        return studentAssignmentRepo.findByAssignmentIds(List.of(assignmentId)).stream()
                .map(sa -> sa.getStudentId())
                .toList();
    }

    private List<String> topics(Long studentId, Long classId) {
        return studentClassroomService.listAssignments(studentId, classId).stream()
                .map(StudentAssignmentDto::topic)
                .toList();
    }

    /** Notification bắn @Async — chờ tới khi đạt số mong đợi (tối đa ~4s) thay vì assert tức thì. */
    private void awaitNotifications(Long userId, int expected) throws InterruptedException {
        for (int i = 0; i < 20; i++) {
            if (notificationsFor(userId) == expected) return;
            Thread.sleep(200);
        }
        assertThat(notificationsFor(userId)).isEqualTo(expected);
    }

    private int notificationsFor(Long userId) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_notifications WHERE recipient_user_id = ? AND notification_type = 'NEW_CLASS_ASSIGNMENT'",
                Integer.class, userId);
        return n == null ? 0 : n;
    }

    private void member(Long orgId, Long userId, String role) {
        orgMemberRepo.save(OrgMember.builder()
                .id(new OrgMemberId(orgId, userId))
                .role(role)
                .status("ACTIVE")
                .joinedAt(java.time.Instant.now())
                .build());
    }

    private User newUser(User.Role role) {
        return userRepository.save(User.builder()
                .email("at-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x").displayName("AT Tester").role(role).build());
    }

    private ClassSession saveSession(Long classId, LocalDateTime startAt) {
        return sessionRepo.save(ClassSession.builder()
                .classId(classId)
                .startAt(startAt)
                .durationMinutes(195)
                .teachingMinutes(180)
                .breakMinutes(15)
                .mode(ClassSession.Mode.OFFLINE)
                .room("P.101")
                .status(ClassSession.Status.SCHEDULED)
                .overridden(true)
                .build());
    }

    private static LocalDate nextMonday() {
        return LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.MONDAY));
    }
}
