package com.deutschflow.teacher;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.notification.entity.NotificationOutbox;
import com.deutschflow.notification.repository.NotificationOutboxRepository;
import com.deutschflow.notification.service.NotificationOutboxService;
import com.deutschflow.organization.dto.AssignCurriculumRequest;
import com.deutschflow.organization.dto.CreateCurriculumRequest;
import com.deutschflow.organization.entity.OrgAcademicApprover;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgAcademicApproverRepository;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.organization.service.OrgCurriculumAssignmentService;
import com.deutschflow.organization.service.OrgCurriculumService;
import com.deutschflow.teacher.dto.CreateSessionRequest;
import com.deutschflow.teacher.dto.ScheduleChangeRequestDto;
import com.deutschflow.teacher.dto.SessionSaveResult;
import com.deutschflow.teacher.dto.StudentSessionDto;
import com.deutschflow.teacher.dto.UpdateSessionRequest;
import com.deutschflow.teacher.dto.UpsertPatternRequest;
import com.deutschflow.teacher.entity.ClassScheduleChangeRequest;
import com.deutschflow.teacher.entity.ClassSession;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.ClassTeacherId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassScheduleChangeRequestRepository;
import com.deutschflow.teacher.repository.ClassSessionRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.teacher.service.ClassScheduleService;
import com.deutschflow.teacher.service.ScheduleChangeRequestService;
import com.deutschflow.teacher.service.StudentClassroomService;
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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * PR-5 (GĐ3) trên PostgreSQL thật: lớp trung tâm có giáo trình — mutation lịch vào hàng chờ duyệt
 * (AC18), duyệt nguyên tử + chống nền lỗi thời (AC10), cuối tuần đòi OWNER (AC19/AC20/AC23),
 * từ chối giữ lịch (AC22), buổi hủy không hồi sinh qua job (AC11), buổi bù giữ khung 195′ (AC21),
 * thông báo học viên qua OUTBOX ghi-trong-giao-dịch (G2), lớp cá nhân giữ đường ghi cũ, và hợp
 * đồng student sessions không đổi khi có đề xuất PENDING (P08).
 */
@SpringBootTest
@DisplayName("Schedule change request Integration Tests (V294, AC03/04/10/11/18–23)")
class ScheduleChangeRequestIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private ClassScheduleService scheduleService;
    @Autowired private ScheduleChangeRequestService requestService;
    @Autowired private NotificationOutboxService outboxService;
    @Autowired private OrgCurriculumService curriculumService;
    @Autowired private OrgCurriculumAssignmentService assignmentService;
    @Autowired private StudentClassroomService studentClassroomService;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository orgMemberRepo;
    @Autowired private OrgAcademicApproverRepository approverRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private TeacherClassRepository classRepo;
    @Autowired private ClassTeacherRepository classTeacherRepo;
    @Autowired private ClassStudentRepository classStudentRepo;
    @Autowired private ClassSessionRepository sessionRepo;
    @Autowired private ClassScheduleChangeRequestRepository requestRepo;
    @Autowired private NotificationOutboxRepository outboxRepo;
    @Autowired private JdbcTemplate jdbcTemplate;

    // ── AC18: mutation lớp gated vào hàng chờ, lịch + thông báo đứng yên ────

    @Test
    @DisplayName("AC18: dời buổi lớp giáo trình → đề xuất PENDING, buổi không đổi, KHÔNG outbox/notification")
    void gatedUpdate_goesToQueue() {
        Fixture f = fixture();
        ClassSession s = saveSession(f.klass.getId(), nextMonday().atTime(8, 0));
        LocalDateTime newStart = nextMonday().atTime(9, 0);

        SessionSaveResult out = scheduleService.updateSession(f.teacher.getId(), s.getId(),
                new UpdateSessionRequest(newStart, null, null, "P.101", null));

        assertThat(out.pendingRequestId()).isNotNull();
        assertThat(sessionRepo.findById(s.getId()).orElseThrow().getStartAt())
                .isEqualTo(nextMonday().atTime(8, 0)); // buổi CHƯA đổi
        ClassScheduleChangeRequest r = requestRepo.findById(out.pendingRequestId()).orElseThrow();
        assertThat(r.getStatus()).isEqualTo(ClassScheduleChangeRequest.Status.PENDING);
        assertThat(r.getRequestType()).isEqualTo(ClassScheduleChangeRequest.Type.MOVE_SESSION);
        assertThat(r.getImpactSnapshot()).containsKey("affectedSessionIds");
        assertThat(outboxOfClass(f.klass.getId())).isZero();
        assertThat(countNotifications(f.student.getId())).isZero();
    }

    // ── AC03/AC04 + G2: duyệt áp lịch + outbox trong giao dịch, gửi idempotent ──

    @Test
    @DisplayName("Duyệt: buổi đổi + version tăng + outbox 1 dòng/học viên; deliver idempotent (không gửi đôi)")
    void approve_appliesAndQueuesOutbox() {
        Fixture f = fixture();
        ClassSession s = saveSession(f.klass.getId(), nextMonday().atTime(8, 0));
        LocalDateTime newStart = nextMonday().atTime(9, 30);
        Long reqId = scheduleService.updateSession(f.teacher.getId(), s.getId(),
                new UpdateSessionRequest(newStart, null, null, "P.101", null)).pendingRequestId();

        ScheduleChangeRequestDto approved = requestService.approve(f.leadTeacher.getId(), f.org.getId(), reqId);

        assertThat(approved.status()).isEqualTo("APPROVED");
        assertThat(approved.appliedAt()).isNotNull();
        assertThat(sessionRepo.findById(s.getId()).orElseThrow().getStartAt()).isEqualTo(newStart);
        assertThat(classRepo.findById(f.klass.getId()).orElseThrow().getScheduleVersion()).isEqualTo(1L);

        List<NotificationOutbox> rows = outboxRepo.findAll().stream()
                .filter(o -> f.klass.getId().equals(o.getClassId())).toList();
        assertThat(rows).hasSize(1); // lớp có đúng 1 học viên
        assertThat(rows.get(0).getRecipientId()).isEqualTo(f.student.getId());
        assertThat(rows.get(0).getDedupKey()).isEqualTo("request:" + reqId + ":v1:u" + f.student.getId());

        // Worker gửi: 1 notification; chạy lại lượt nữa vẫn 1 (SENT bỏ qua — không gửi đôi).
        outboxService.deliver(rows.get(0).getId());
        assertThat(countNotifications(f.student.getId())).isEqualTo(1);
        outboxService.deliver(rows.get(0).getId());
        assertThat(countNotifications(f.student.getId())).isEqualTo(1);
    }

    // ── AC10: đua hai người duyệt — một thắng; nền lỗi thời — 409 ───────────

    @Test
    @DisplayName("AC10: hai người duyệt cùng lúc → đúng MỘT người thắng, người kia nhận Conflict")
    void approve_race_oneWins() throws Exception {
        Fixture f = fixture();
        ClassSession s = saveSession(f.klass.getId(), nextMonday().atTime(8, 0));
        Long reqId = scheduleService.updateSession(f.teacher.getId(), s.getId(),
                new UpdateSessionRequest(nextMonday().atTime(10, 0), null, null, "P.101", null)).pendingRequestId();

        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger wins = new AtomicInteger();
        AtomicInteger conflicts = new AtomicInteger();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Runnable attempt = () -> {
                try {
                    start.await();
                    requestService.approve(f.owner.getId(), f.org.getId(), reqId);
                    wins.incrementAndGet();
                } catch (ConflictException e) {
                    conflicts.incrementAndGet();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            };
            Future<?> a = pool.submit(attempt);
            Future<?> b = pool.submit(attempt);
            start.countDown();
            a.get();
            b.get();
        } finally {
            pool.shutdownNow();
        }

        assertThat(wins.get()).isEqualTo(1);
        assertThat(conflicts.get()).isEqualTo(1);
        assertThat(classRepo.findById(f.klass.getId()).orElseThrow().getScheduleVersion()).isEqualTo(1L);
    }

    @Test
    @DisplayName("AC10: duyệt trên nền lỗi thời (một đề xuất khác đã áp trước) → 409, đề xuất còn PENDING")
    void approve_staleBaseVersion_conflicts() {
        Fixture f = fixture();
        ClassSession s1 = saveSession(f.klass.getId(), nextMonday().atTime(8, 0));
        ClassSession s2 = saveSession(f.klass.getId(), nextMonday().plusDays(2).atTime(8, 0));
        Long reqA = scheduleService.updateSession(f.teacher.getId(), s1.getId(),
                new UpdateSessionRequest(nextMonday().atTime(9, 0), null, null, "P.101", null)).pendingRequestId();
        Long reqB = scheduleService.updateSession(f.teacher.getId(), s2.getId(),
                new UpdateSessionRequest(nextMonday().plusDays(2).atTime(9, 0), null, null, "P.101", null)).pendingRequestId();

        requestService.approve(f.owner.getId(), f.org.getId(), reqA); // version 0 → 1

        assertThatThrownBy(() -> requestService.approve(f.owner.getId(), f.org.getId(), reqB))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("thay đổi");
        ClassScheduleChangeRequest b = requestRepo.findById(reqB).orElseThrow();
        assertThat(b.getStatus()).isEqualTo(ClassScheduleChangeRequest.Status.PENDING); // rollback trọn
        assertThat(sessionRepo.findById(s2.getId()).orElseThrow().getStartAt())
                .isEqualTo(nextMonday().plusDays(2).atTime(8, 0));
    }

    // ── AC19/AC20/AC23: cuối tuần chỉ OWNER ─────────────────────────────────

    @Test
    @DisplayName("AC19/20/23: buổi bù Thứ 7 → has_weekend; giáo viên trưởng duyệt bị 403, OWNER duyệt được")
    void weekend_requiresOwner() {
        Fixture f = fixture();
        LocalDate saturday = nextMonday().plusDays(5);
        Long reqId = scheduleService.createSession(f.teacher.getId(), f.klass.getId(),
                new CreateSessionRequest(saturday.atTime(8, 0), 195, "OFFLINE", "P.101")).pendingRequestId();

        assertThat(requestRepo.findById(reqId).orElseThrow().isHasWeekend()).isTrue();
        assertThatThrownBy(() -> requestService.approve(f.leadTeacher.getId(), f.org.getId(), reqId))
                .isInstanceOf(ForbiddenException.class);
        assertThat(requestRepo.findById(reqId).orElseThrow().getStatus())
                .isEqualTo(ClassScheduleChangeRequest.Status.PENDING);

        requestService.approve(f.owner.getId(), f.org.getId(), reqId);
        assertThat(sessionRepo.findAll().stream()
                .anyMatch(x -> f.klass.getId().equals(x.getClassId())
                        && x.getStartAt().equals(saturday.atTime(8, 0)))).isTrue();
    }

    // ── AC22: từ chối giữ lịch; xử lý hai lần → Conflict ────────────────────

    @Test
    @DisplayName("AC22: từ chối kèm lý do — lịch hiệu lực đứng yên; từ chối/duyệt lần hai → Conflict")
    void reject_keepsSchedule() {
        Fixture f = fixture();
        ClassSession s = saveSession(f.klass.getId(), nextMonday().atTime(8, 0));
        Long reqId = scheduleService.updateSession(f.teacher.getId(), s.getId(),
                new UpdateSessionRequest(nextMonday().atTime(9, 0), null, null, "P.101", null)).pendingRequestId();

        assertThatThrownBy(() -> requestService.reject(f.leadTeacher.getId(), f.org.getId(), reqId, "  "))
                .isInstanceOf(BadRequestException.class); // lý do bắt buộc

        ScheduleChangeRequestDto rejected =
                requestService.reject(f.leadTeacher.getId(), f.org.getId(), reqId, "Trùng lịch phòng");
        assertThat(rejected.status()).isEqualTo("REJECTED");
        assertThat(rejected.rejectReason()).isEqualTo("Trùng lịch phòng");
        assertThat(sessionRepo.findById(s.getId()).orElseThrow().getStartAt())
                .isEqualTo(nextMonday().atTime(8, 0));
        assertThat(classRepo.findById(f.klass.getId()).orElseThrow().getScheduleVersion()).isZero();

        assertThatThrownBy(() -> requestService.approve(f.owner.getId(), f.org.getId(), reqId))
                .isInstanceOf(ConflictException.class);
    }

    // ── AC11 + job guard: buổi hủy qua duyệt không bị job hồi sinh ──────────

    @Test
    @DisplayName("AC11: hủy buổi qua duyệt → CANCELLED; job roll-forward không hồi sinh, không sinh buổi trùng ô")
    void cancelledSession_notResurrectedByJob() {
        Fixture f = fixture();
        // Pattern coi như ĐÃ DUYỆT từ trước (đường áp-sau-duyệt) — sinh các buổi tương lai.
        LocalDate effective = nextMonday();
        scheduleService.applyUpsertPattern(f.teacher.getId(), f.klass.getId(),
                new UpsertPatternRequest((short) 1, java.time.LocalTime.of(8, 0), 195, "OFFLINE", "P.101",
                        effective, null, null, null));
        ClassSession target = sessionRepo.findAll().stream()
                .filter(x -> f.klass.getId().equals(x.getClassId()))
                .findFirst().orElseThrow();
        long before = sessionCountOfClass(f.klass.getId());

        Long reqId = scheduleService.updateSession(f.teacher.getId(), target.getId(),
                new UpdateSessionRequest(null, null, null, null, "CANCELLED")).pendingRequestId();
        requestService.approve(f.owner.getId(), f.org.getId(), reqId);
        assertThat(sessionRepo.findById(target.getId()).orElseThrow().getStatus())
                .isEqualTo(ClassSession.Status.CANCELLED);

        scheduleService.rollForwardActivePatterns();

        ClassSession after = sessionRepo.findById(target.getId()).orElseThrow();
        assertThat(after.getStatus()).isEqualTo(ClassSession.Status.CANCELLED); // không hồi sinh
        assertThat(sessionCountOfClass(f.klass.getId())).isEqualTo(before);     // không buổi ma trùng ô
    }

    // ── AC21: buổi bù lớp trung tâm giữ khung 195′; trùng giờ chặn lúc áp ───

    @Test
    @DisplayName("AC21: buổi bù ≠195′ bị 400 ngay khi nộp; trùng giờ giáo viên chặn lúc DUYỆT (rollback, còn PENDING)")
    void makeup_budgetAndConflictGuards() {
        Fixture f = fixture();
        assertThatThrownBy(() -> scheduleService.createSession(f.teacher.getId(), f.klass.getId(),
                new CreateSessionRequest(nextMonday().atTime(8, 0), 120, "OFFLINE", "P.101")))
                .isInstanceOf(BadRequestException.class);

        LocalDateTime slot = nextMonday().atTime(8, 0);
        Long reqId = scheduleService.createSession(f.teacher.getId(), f.klass.getId(),
                new CreateSessionRequest(slot, 195, "OFFLINE", "P.101")).pendingRequestId();
        // Giữa lúc chờ duyệt, giáo viên có buổi khác chiếm đúng giờ đó (lớp cá nhân — ghi thẳng).
        TeacherClass personal = newClass(f.teacher.getId(), null);
        link(personal.getId(), f.teacher.getId());
        scheduleService.createSession(f.teacher.getId(), personal.getId(),
                new CreateSessionRequest(slot, 90, "ONLINE", null));

        // Guard trùng giờ của đường ghi cũ chạy lại trong giao dịch duyệt (BadRequest như cũ)…
        assertThatThrownBy(() -> requestService.approve(f.owner.getId(), f.org.getId(), reqId))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Trùng lịch");
        // …và toàn bộ giao dịch duyệt rollback: đề xuất còn PENDING, version không tăng, không outbox.
        assertThat(requestRepo.findById(reqId).orElseThrow().getStatus())
                .isEqualTo(ClassScheduleChangeRequest.Status.PENDING);
        assertThat(classRepo.findById(f.klass.getId()).orElseThrow().getScheduleVersion()).isZero();
        assertThat(outboxOfClass(f.klass.getId())).isZero();
    }

    // ── Lớp cá nhân giữ đường ghi trực tiếp ─────────────────────────────────

    @Test
    @DisplayName("Lớp cá nhân (không org/giáo trình): mutation áp NGAY như cũ, không sinh đề xuất")
    void personalClass_directWrite() {
        User t = newTeacher();
        TeacherClass personal = newClass(t.getId(), null);
        link(personal.getId(), t.getId());
        ClassSession s = saveSession(personal.getId(), nextMonday().atTime(14, 0));

        SessionSaveResult out = scheduleService.updateSession(t.getId(), s.getId(),
                new UpdateSessionRequest(nextMonday().atTime(15, 0), null, null, null, null));

        assertThat(out.pendingRequestId()).isNull();
        assertThat(sessionRepo.findById(s.getId()).orElseThrow().getStartAt())
                .isEqualTo(nextMonday().atTime(15, 0));
        assertThat(requestRepo.findByClassIdOrderByRequestedAtDesc(personal.getId())).isEmpty();
    }

    // ── P08: hợp đồng student sessions không đổi khi có PENDING ─────────────

    @Test
    @DisplayName("P08: đề xuất PENDING vô hình với học viên — GET sessions trả y nguyên lịch hiệu lực")
    void studentSessions_contractUnchanged() {
        Fixture f = fixture();
        ClassSession s = saveSession(f.klass.getId(), nextMonday().atTime(8, 0));
        List<StudentSessionDto> before = studentClassroomService.listSessions(f.student.getId(), f.klass.getId());

        scheduleService.updateSession(f.teacher.getId(), s.getId(),
                new UpdateSessionRequest(nextMonday().atTime(9, 0), null, null, "P.101", null));

        List<StudentSessionDto> after = studentClassroomService.listSessions(f.student.getId(), f.klass.getId());
        assertThat(after).isEqualTo(before);
    }

    // ── Quyền gọi thẳng API duyệt ───────────────────────────────────────────

    @Test
    @DisplayName("Quyền: giáo viên thường 403; org khác không thấy đề xuất; STUDENT member 403 (H1)")
    void approve_permissionMatrix() {
        Fixture f = fixture();
        ClassSession s = saveSession(f.klass.getId(), nextMonday().atTime(8, 0));
        Long reqId = scheduleService.updateSession(f.teacher.getId(), s.getId(),
                new UpdateSessionRequest(nextMonday().atTime(9, 0), null, null, "P.101", null)).pendingRequestId();

        // Giáo viên của lớp nhưng KHÔNG được phân công duyệt → 403
        assertThatThrownBy(() -> requestService.approve(f.teacher.getId(), f.org.getId(), reqId))
                .isInstanceOf(ForbiddenException.class);

        // OWNER của org KHÁC: đề xuất không thuộc org đó → NotFound (không lộ tồn tại)
        Fixture other = fixture();
        assertThatThrownBy(() -> requestService.approve(other.owner.getId(), other.org.getId(), reqId))
                .isInstanceOf(NotFoundException.class);

        // STUDENT member có sót phân công cũ vẫn bị chặn (H1)
        member(f.org.getId(), f.student.getId(), "STUDENT");
        approverRepo.save(OrgAcademicApprover.builder()
                .orgId(f.org.getId()).userId(f.student.getId()).scope("ORG")
                .grantedBy(f.owner.getId()).grantedAt(LocalDateTime.now()).build());
        assertThatThrownBy(() -> requestService.approve(f.student.getId(), f.org.getId(), reqId))
                .isInstanceOf(ForbiddenException.class);

        // Người xem không có quyền lớp nào → hàng chờ rỗng (không lộ đề xuất)
        assertThat(requestService.listPendingForOrg(f.teacher.getId(), f.org.getId())).isEmpty();
        assertThat(requestService.listPendingForOrg(f.owner.getId(), f.org.getId())).hasSize(1);
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    private record Fixture(Organization org, User owner, User leadTeacher, User teacher, User student,
                           TeacherClass klass) {}

    /** Org + OWNER + giáo viên trưởng (approver scope ORG) + giáo viên đứng lớp + 1 học viên; lớp đã gắn giáo trình. */
    private Fixture fixture() {
        Organization org = organizationRepo.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug("org-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
        User owner = newTeacher();
        User leadTeacher = newTeacher();
        User teacher = newTeacher();
        User student = userRepository.save(User.builder()
                .email("sv-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x").displayName("Học viên").role(User.Role.STUDENT).build());
        member(org.getId(), owner.getId(), "OWNER");
        member(org.getId(), leadTeacher.getId(), "TEACHER");
        member(org.getId(), teacher.getId(), "TEACHER");
        approverRepo.save(OrgAcademicApprover.builder()
                .orgId(org.getId()).userId(leadTeacher.getId()).scope("ORG")
                .grantedBy(owner.getId()).grantedAt(LocalDateTime.now()).build());

        TeacherClass klass = newClass(teacher.getId(), org.getId());
        link(klass.getId(), teacher.getId());
        classStudentRepo.save(ClassStudent.builder()
                .id(new ClassStudentId(klass.getId(), student.getId()))
                .joinedAt(LocalDateTime.now())
                .build());

        // Gắn giáo trình → bật gate duyệt (requiresApproval).
        var curriculum = curriculumService.create(owner.getId(), org.getId(),
                new CreateCurriculumRequest("Bộ PR-5 " + UUID.randomUUID().toString().substring(0, 6), "A1", null));
        Long versionId = curriculum.versions().get(0).id();
        var lektion = curriculumService.addLektion(org.getId(), versionId,
                new com.deutschflow.organization.dto.UpsertLektionRequest("Lektion 1", null));
        curriculumService.replaceItems(org.getId(), lektion.id(),
                new com.deutschflow.organization.dto.ReplaceItemsRequest(List.of(
                        new com.deutschflow.organization.dto.CurriculumItemInput("Mục A", null, "GRAMMATIK", 60))));
        curriculumService.publish(owner.getId(), org.getId(), versionId);
        assignmentService.assign(owner.getId(), org.getId(), klass.getId(), new AssignCurriculumRequest(versionId));
        return new Fixture(org, owner, leadTeacher, teacher, student, klass);
    }

    private void member(Long orgId, Long userId, String role) {
        orgMemberRepo.save(OrgMember.builder()
                .id(new OrgMemberId(orgId, userId))
                .role(role)
                .status("ACTIVE")
                .joinedAt(java.time.Instant.now())
                .build());
    }

    private User newTeacher() {
        return userRepository.save(User.builder()
                .email("sched-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x").displayName("Sched Tester").role(User.Role.TEACHER).build());
    }

    private TeacherClass newClass(Long teacherId, Long orgId) {
        return classRepo.save(TeacherClass.builder()
                .teacherId(teacherId)
                .orgId(orgId)
                .name("A1 · " + UUID.randomUUID().toString().substring(0, 8))
                .inviteCode("INV-" + UUID.randomUUID())
                .createdAt(LocalDateTime.now())
                .build());
    }

    private void link(Long classId, Long teacherId) {
        classTeacherRepo.save(ClassTeacher.builder()
                .id(new ClassTeacherId(classId, teacherId))
                .role("PRIMARY")
                .joinedAt(LocalDateTime.now())
                .build());
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

    private long sessionCountOfClass(Long classId) {
        return sessionRepo.findAll().stream().filter(s -> classId.equals(s.getClassId())).count();
    }

    private long outboxOfClass(Long classId) {
        return outboxRepo.findAll().stream().filter(o -> classId.equals(o.getClassId())).count();
    }

    private int countNotifications(Long userId) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_notifications WHERE recipient_user_id = ?", Integer.class, userId);
        return n == null ? 0 : n;
    }

    /** Thứ 2 tuần sau — mốc tương lai ổn định, không rơi cuối tuần ngoài ý muốn. */
    private static LocalDate nextMonday() {
        return LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.MONDAY));
    }
}
