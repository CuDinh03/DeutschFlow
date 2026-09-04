package com.deutschflow.teacher;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
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
import com.deutschflow.teacher.dto.ClassMilestoneDto;
import com.deutschflow.teacher.dto.ScheduleForecastDto;
import com.deutschflow.teacher.dto.SchedulePreviewDto;
import com.deutschflow.teacher.dto.UpdateSessionRequest;
import com.deutschflow.teacher.dto.UpsertMilestoneRequest;
import com.deutschflow.teacher.entity.ClassMilestone;
import com.deutschflow.teacher.entity.ClassScheduleChangeRequest;
import com.deutschflow.teacher.entity.ClassSession;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.ClassTeacherId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassMilestoneRepository;
import com.deutschflow.teacher.repository.ClassScheduleChangeRequestRepository;
import com.deutschflow.teacher.repository.ClassSessionRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.teacher.service.ClassMilestoneService;
import com.deutschflow.teacher.service.ClassScheduleService;
import com.deutschflow.teacher.service.ScheduleChangeRequestService;
import com.deutschflow.teacher.service.ScheduleForecastService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * PR-6 (GĐ3) trên PostgreSQL thật: mốc lớp (V295) — dời ngày lớp giáo trình qua đề xuất
 * MOVE_MILESTONE (P05), mốc T7/CN chỉ OWNER duyệt (D14); dự báo AC09/AC17 (thiếu khung → báo
 * thiếu, không tự xử); preview 2 cột cho người duyệt (mô phỏng, không ghi DB).
 */
@SpringBootTest
@DisplayName("Class milestone + forecast Integration Tests (V295, AC09/AC17/P05)")
class ClassMilestoneIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private ClassMilestoneService milestoneService;
    @Autowired private ScheduleChangeRequestService requestService;
    @Autowired private ScheduleForecastService forecastService;
    @Autowired private ClassScheduleService scheduleService;
    @Autowired private OrgCurriculumService curriculumService;
    @Autowired private OrgCurriculumAssignmentService assignmentService;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository orgMemberRepo;
    @Autowired private OrgAcademicApproverRepository approverRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private TeacherClassRepository classRepo;
    @Autowired private ClassTeacherRepository classTeacherRepo;
    @Autowired private ClassSessionRepository sessionRepo;
    @Autowired private ClassMilestoneRepository milestoneRepo;
    @Autowired private ClassScheduleChangeRequestRepository requestRepo;

    // ── P05: dời mốc lớp giáo trình qua duyệt ───────────────────────────────

    @Test
    @DisplayName("P05: lớp giáo trình — đổi NGÀY mốc thành đề xuất MOVE_MILESTONE (ngày chưa đổi); duyệt xong mới đổi")
    void moveMilestone_goesThroughApproval() {
        Fixture f = fixture();
        ClassMilestoneDto exam = milestoneService.create(f.teacher.getId(), f.klass.getId(),
                new UpsertMilestoneRequest("EXAM", "Thi giữa khóa", nextMonday().plusWeeks(4), null));

        LocalDate newDate = nextMonday().plusWeeks(5).plusDays(2); // thứ 4 — không weekend
        ClassMilestoneDto out = milestoneService.update(f.teacher.getId(), f.klass.getId(), exam.id(),
                new UpsertMilestoneRequest(null, null, newDate, null));

        assertThat(out.pendingRequestId()).isNotNull();
        assertThat(milestoneRepo.findById(exam.id()).orElseThrow().getPlannedDate())
                .isEqualTo(nextMonday().plusWeeks(4)); // CHƯA đổi
        ClassScheduleChangeRequest r = requestRepo.findById(out.pendingRequestId()).orElseThrow();
        assertThat(r.getRequestType()).isEqualTo(ClassScheduleChangeRequest.Type.MOVE_MILESTONE);
        assertThat(r.isHasWeekend()).isFalse();

        requestService.approve(f.leadTeacher.getId(), f.org.getId(), out.pendingRequestId());
        assertThat(milestoneRepo.findById(exam.id()).orElseThrow().getPlannedDate()).isEqualTo(newDate);
    }

    @Test
    @DisplayName("D14: mốc dời sang Thứ 7 → has_weekend, giáo viên trưởng 403, OWNER duyệt được; title sửa thẳng")
    void weekendMilestone_needsOwner() {
        Fixture f = fixture();
        ClassMilestoneDto exam = milestoneService.create(f.teacher.getId(), f.klass.getId(),
                new UpsertMilestoneRequest("EXAM", "Thi cuối khóa", nextMonday().plusWeeks(6), null));

        // title/note đổi thẳng, không sinh đề xuất
        ClassMilestoneDto renamed = milestoneService.update(f.teacher.getId(), f.klass.getId(), exam.id(),
                new UpsertMilestoneRequest(null, "Thi cuối khóa (chính thức)", null, null));
        assertThat(renamed.pendingRequestId()).isNull();
        assertThat(renamed.title()).isEqualTo("Thi cuối khóa (chính thức)");

        LocalDate saturday = nextMonday().plusWeeks(6).plusDays(5);
        Long reqId = milestoneService.update(f.teacher.getId(), f.klass.getId(), exam.id(),
                new UpsertMilestoneRequest(null, null, saturday, null)).pendingRequestId();
        assertThat(requestRepo.findById(reqId).orElseThrow().isHasWeekend()).isTrue();

        assertThatThrownBy(() -> requestService.approve(f.leadTeacher.getId(), f.org.getId(), reqId))
                .isInstanceOf(ForbiddenException.class);
        requestService.approve(f.owner.getId(), f.org.getId(), reqId);
        assertThat(milestoneRepo.findById(exam.id()).orElseThrow().getPlannedDate()).isEqualTo(saturday);
    }

    @Test
    @DisplayName("Lớp thường: đổi ngày mốc áp thẳng; COURSE_END trùng → Conflict (một lớp một mốc kết thúc)")
    void personalClass_directAndCourseEndUnique() {
        User t = newTeacher();
        TeacherClass personal = newClass(t.getId(), null);
        link(personal.getId(), t.getId());

        ClassMilestoneDto end = milestoneService.create(t.getId(), personal.getId(),
                new UpsertMilestoneRequest("COURSE_END", "Kết thúc khóa", nextMonday().plusWeeks(8), null));
        ClassMilestoneDto moved = milestoneService.update(t.getId(), personal.getId(), end.id(),
                new UpsertMilestoneRequest(null, null, nextMonday().plusWeeks(9), null));
        assertThat(moved.pendingRequestId()).isNull();
        assertThat(moved.plannedDate()).isEqualTo(nextMonday().plusWeeks(9));

        assertThatThrownBy(() -> milestoneService.create(t.getId(), personal.getId(),
                new UpsertMilestoneRequest("COURSE_END", "Kết thúc lần 2", nextMonday().plusWeeks(10), null)))
                .isInstanceOf(ConflictException.class);
    }

    // ── AC09/AC17: dự báo ───────────────────────────────────────────────────

    @Test
    @DisplayName("AC09/AC17: đủ buổi → projectedEndDate + mốc trước đó atRisk; hủy bớt buổi → shortfall, không tự xử")
    void forecast_endDateAndShortfall() {
        Fixture f = fixture(); // giáo trình 2 mục × 120′ = 240′ còn lại
        ClassSession s1 = saveSession(f.klass.getId(), nextMonday().atTime(8, 0));
        ClassSession s2 = saveSession(f.klass.getId(), nextMonday().plusDays(2).atTime(8, 0));
        milestoneService.create(f.teacher.getId(), f.klass.getId(),
                new UpsertMilestoneRequest("EXAM", "Thi sớm", nextMonday().plusDays(1), null));

        ScheduleForecastDto fc = forecastService.forecastForTeacher(f.teacher.getId(), f.klass.getId());
        assertThat(fc.remainingMinutes()).isEqualTo(240);
        assertThat(fc.availableMinutes()).isEqualTo(360);
        // 180 (buổi 1) < 240 ≤ 360 (buổi 2) → xong ở buổi 2
        assertThat(fc.projectedEndDate()).isEqualTo(nextMonday().plusDays(2));
        assertThat(fc.milestones()).singleElement()
                .satisfies(v -> assertThat(v.atRisk()).isTrue()); // thi trước ngày học xong

        // Hủy buổi 2 (qua duyệt) → chỉ còn 180′ khung cho 240′ nội dung → thiếu 60′, cần thêm 1 buổi
        Long reqId = scheduleService.updateSession(f.teacher.getId(), s2.getId(),
                new UpdateSessionRequest(null, null, null, null, "CANCELLED")).pendingRequestId();
        requestService.approve(f.owner.getId(), f.org.getId(), reqId);

        ScheduleForecastDto after = forecastService.forecastForTeacher(f.teacher.getId(), f.klass.getId());
        assertThat(after.projectedEndDate()).isNull();
        assertThat(after.shortfallMinutes()).isEqualTo(60);
        assertThat(after.suggestedExtraSessions()).isEqualTo(1);
        // buổi 1 vẫn nguyên — hệ thống không tự tạo lịch/bỏ bài
        assertThat(sessionRepo.findById(s1.getId()).orElseThrow().getStatus())
                .isEqualTo(ClassSession.Status.SCHEDULED);
    }

    // ── Preview 2 cột ───────────────────────────────────────────────────────

    @Test
    @DisplayName("Preview: CANCEL_SESSION — cột dự kiến mất khung giờ (shortfall) trong khi DB chưa đổi gì")
    void preview_simulatesWithoutWriting() {
        Fixture f = fixture();
        ClassSession s1 = saveSession(f.klass.getId(), nextMonday().atTime(8, 0));
        ClassSession s2 = saveSession(f.klass.getId(), nextMonday().plusDays(2).atTime(8, 0));
        Long reqId = scheduleService.updateSession(f.teacher.getId(), s2.getId(),
                new UpdateSessionRequest(null, null, null, null, "CANCELLED")).pendingRequestId();

        SchedulePreviewDto pv = requestService.preview(f.leadTeacher.getId(), f.org.getId(), reqId);

        assertThat(pv.current().availableMinutes()).isEqualTo(360);
        assertThat(pv.current().projectedEndDate()).isEqualTo(nextMonday().plusDays(2));
        assertThat(pv.projected().availableMinutes()).isEqualTo(180);
        assertThat(pv.projected().shortfallMinutes()).isEqualTo(60);
        // Mô phỏng thuần: buổi + đề xuất trong DB không suy suyển
        assertThat(sessionRepo.findById(s2.getId()).orElseThrow().getStatus())
                .isEqualTo(ClassSession.Status.SCHEDULED);
        assertThat(requestRepo.findById(reqId).orElseThrow().getStatus())
                .isEqualTo(ClassScheduleChangeRequest.Status.PENDING);
        // Người không có quyền duyệt lớp này không xem được preview
        assertThatThrownBy(() -> requestService.preview(f.teacher.getId(), f.org.getId(), reqId))
                .isInstanceOf(ForbiddenException.class);
    }

    // ── fixtures (khuôn PR-5, giáo trình 2 mục 120′) ────────────────────────

    private record Fixture(Organization org, User owner, User leadTeacher, User teacher, TeacherClass klass) {}

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
        member(org.getId(), owner.getId(), "OWNER");
        member(org.getId(), leadTeacher.getId(), "TEACHER");
        member(org.getId(), teacher.getId(), "TEACHER");
        approverRepo.save(OrgAcademicApprover.builder()
                .orgId(org.getId()).userId(leadTeacher.getId()).scope("ORG")
                .grantedBy(owner.getId()).grantedAt(LocalDateTime.now()).build());

        TeacherClass klass = newClass(teacher.getId(), org.getId());
        link(klass.getId(), teacher.getId());

        var curriculum = curriculumService.create(owner.getId(), org.getId(),
                new CreateCurriculumRequest("Bộ PR-6 " + UUID.randomUUID().toString().substring(0, 6), "A1", null));
        Long versionId = curriculum.versions().get(0).id();
        var lektion = curriculumService.addLektion(org.getId(), versionId,
                new UpsertLektionRequest("Lektion 1", null));
        curriculumService.replaceItems(org.getId(), lektion.id(), new ReplaceItemsRequest(List.of(
                new CurriculumItemInput("Mục A", null, "GRAMMATIK", 120),
                new CurriculumItemInput("Mục B", "SPRECHEN", "REDEMITTEL", 120))));
        curriculumService.publish(owner.getId(), org.getId(), versionId);
        assignmentService.assign(owner.getId(), org.getId(), klass.getId(), new AssignCurriculumRequest(versionId));
        return new Fixture(org, owner, leadTeacher, teacher, klass);
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
                .email("ms-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x").displayName("Milestone Tester").role(User.Role.TEACHER).build());
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

    private static LocalDate nextMonday() {
        return LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.MONDAY));
    }
}
