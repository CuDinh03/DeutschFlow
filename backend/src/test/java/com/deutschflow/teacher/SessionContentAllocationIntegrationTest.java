package com.deutschflow.teacher;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.dto.AssignCurriculumRequest;
import com.deutschflow.organization.dto.CreateCurriculumRequest;
import com.deutschflow.organization.dto.CurriculumItemInput;
import com.deutschflow.organization.dto.CurriculumLektionDto;
import com.deutschflow.organization.dto.OrgCurriculumSummaryDto;
import com.deutschflow.organization.dto.ReplaceItemsRequest;
import com.deutschflow.organization.dto.UpsertLektionRequest;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.organization.service.OrgCurriculumAssignmentService;
import com.deutschflow.organization.service.OrgCurriculumService;
import com.deutschflow.teacher.dto.ClassLessonDto;
import com.deutschflow.teacher.dto.ClassLessonLogDto;
import com.deutschflow.teacher.dto.ConfirmSessionContentsRequest;
import com.deutschflow.teacher.dto.CreateLessonLogRequest;
import com.deutschflow.teacher.dto.PlanSessionContentsRequest;
import com.deutschflow.teacher.dto.SessionContentDto;
import com.deutschflow.teacher.dto.SessionContentsDto;
import com.deutschflow.teacher.dto.UpdateLessonRequest;
import com.deutschflow.teacher.entity.ClassSession;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.ClassTeacherId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassSessionRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.teacher.service.ClassLessonService;
import com.deutschflow.teacher.service.LessonLogService;
import com.deutschflow.teacher.service.SessionContentService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * PR-4 (GĐ2) trên PostgreSQL thật: nhật ký/điểm danh gắn BUỔI (AC05), phân bổ nội dung + phần dở
 * chuyển tiếp đứng đầu buổi kế (AC06), và hoàn-thành-Lektion-theo-xác-nhận thay auto-complete
 * (AC07/AC08) — schema V293 áp trên DB trắng replay đủ chuỗi migration.
 */
@SpringBootTest
@DisplayName("Session content allocation Integration Tests (V293, AC05–AC08)")
class SessionContentAllocationIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private LessonLogService lessonLogService;
    @Autowired private SessionContentService sessionContentService;
    @Autowired private ClassLessonService classLessonService;
    @Autowired private OrgCurriculumService curriculumService;
    @Autowired private OrgCurriculumAssignmentService assignmentService;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private TeacherClassRepository classRepo;
    @Autowired private ClassTeacherRepository classTeacherRepo;
    @Autowired private ClassSessionRepository sessionRepo;

    // ── AC05: nhật ký gắn buổi ───────────────────────────────────────────────

    @Test
    @DisplayName("AC05: hai buổi sáng/chiều cùng ngày = hai nhật ký riêng; không chọn buổi thì 400, không đoán")
    void log_twoSessionsSameDay() {
        Fixture f = fixture();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        ClassSession morning = saveSession(f.klass.getId(), yesterday.atTime(8, 0));
        ClassSession afternoon = saveSession(f.klass.getId(), yesterday.atTime(14, 0));

        // Ngày có 2 buổi mà không gửi sessionId → 400 yêu cầu chọn rõ (không đoán hộ)
        assertThatThrownBy(() -> lessonLogService.createLog(f.teacher.getId(), f.klass.getId(),
                logReq(yesterday, null, null)))
                .isInstanceOf(BadRequestException.class);

        ClassLessonLogDto logMorning = lessonLogService.createLog(f.teacher.getId(), f.klass.getId(),
                logReq(yesterday, null, morning.getId()));
        assertThat(logMorning.sessionId()).isEqualTo(morning.getId());

        // Cùng buổi sáng lần 2 → Conflict (1 nhật ký / buổi)
        assertThatThrownBy(() -> lessonLogService.createLog(f.teacher.getId(), f.klass.getId(),
                logReq(yesterday, null, morning.getId())))
                .isInstanceOf(ConflictException.class);

        // Buổi chiều cùng ngày → hợp lệ: HAI nhật ký/điểm danh riêng cho một ngày
        ClassLessonLogDto logAfternoon = lessonLogService.createLog(f.teacher.getId(), f.klass.getId(),
                logReq(yesterday, null, afternoon.getId()));
        assertThat(logAfternoon.sessionId()).isEqualTo(afternoon.getId());
        assertThat(lessonLogService.getLogs(f.teacher.getId(), f.klass.getId())).hasSize(2);
    }

    @Test
    @DisplayName("AC05: ngày có đúng một buổi → tự gắn; ngày lệch buổi → 400; buổi hủy → 400; lớp không lịch giữ đường cũ")
    void log_autoAttach_andGuards() {
        Fixture f = fixture();
        LocalDate d = LocalDate.now().minusDays(2);
        ClassSession only = saveSession(f.klass.getId(), d.atTime(8, 0));

        ClassLessonLogDto auto = lessonLogService.createLog(f.teacher.getId(), f.klass.getId(),
                logReq(d, null, null));
        assertThat(auto.sessionId()).isEqualTo(only.getId());

        // sessionDate lệch ngày của buổi → 400
        assertThatThrownBy(() -> lessonLogService.createLog(f.teacher.getId(), f.klass.getId(),
                logReq(d.minusDays(1), null, only.getId())))
                .isInstanceOf(BadRequestException.class);

        // Buổi đã hủy → không ghi nhật ký dạy
        ClassSession cancelled = saveSession(f.klass.getId(), d.minusDays(3).atTime(8, 0));
        cancelled.setStatus(ClassSession.Status.CANCELLED);
        sessionRepo.saveAndFlush(cancelled);
        assertThatThrownBy(() -> lessonLogService.createLog(f.teacher.getId(), f.klass.getId(),
                logReq(d.minusDays(3), null, cancelled.getId())))
                .isInstanceOf(BadRequestException.class);

        // Lớp không dùng lịch buổi: đường legacy (ngày + số buổi) nguyên vẹn
        User t2 = newTeacher();
        TeacherClass legacy = newClass(t2.getId(), null);
        link(legacy.getId(), t2.getId());
        ClassLessonLogDto legacyLog = lessonLogService.createLog(t2.getId(), legacy.getId(),
                logReq(d, 1, null));
        assertThat(legacyLog.sessionId()).isNull();
        assertThatThrownBy(() -> lessonLogService.createLog(t2.getId(), legacy.getId(),
                logReq(d, 1, null)))
                .isInstanceOf(ConflictException.class);
    }

    // ── AC06: phân bổ + phần dở chuyển tiếp ─────────────────────────────────

    @Test
    @DisplayName("AC06: PARTIAL sinh dòng chuyển tiếp ĐỨNG ĐẦU buổi kế (liên kết gốc, không nhân bản); TAUGHT dọn kế hoạch thừa")
    void carryOver_partial() {
        Fixture f = curriculumFixture();
        ClassSession s1 = saveSession(f.klass.getId(), LocalDate.now().minusDays(1).atTime(8, 0));
        ClassSession s2 = saveSession(f.klass.getId(), LocalDate.now().plusDays(6).atTime(8, 0));

        // Kế hoạch buổi 1: item A (120′) + item B (60′)
        SessionContentsDto planned = sessionContentService.plan(f.teacher.getId(), s1.getId(),
                new PlanSessionContentsRequest(List.of(
                        new PlanSessionContentsRequest.PlanEntry(f.lesson.id(), f.itemA, 120, null),
                        new PlanSessionContentsRequest.PlanEntry(f.lesson.id(), f.itemB, 60, null))));
        assertThat(planned.contents()).hasSize(2);
        assertThat(planned.plannedTotalMinutes()).isEqualTo(180);
        assertThat(planned.teachingMinutes()).isEqualTo(180); // buổi org 195′ → 180 học (D04)

        Long contentA = planned.contents().get(0).id();
        Long contentB = planned.contents().get(1).id();

        // Xác nhận: A dạy xong, B còn dở 20′ (ví dụ N1 còn 20′ trong spec §5)
        sessionContentService.confirm(f.teacher.getId(), s1.getId(),
                new ConfirmSessionContentsRequest(List.of(
                        new ConfirmSessionContentsRequest.ConfirmEntry(contentA, "TAUGHT", 120, null, null),
                        new ConfirmSessionContentsRequest.ConfirmEntry(contentB, "PARTIAL", 40, 20, null))));

        SessionContentsDto next = sessionContentService.list(f.teacher.getId(), s2.getId());
        assertThat(next.contents()).hasSize(1);
        SessionContentDto carried = next.contents().get(0);
        assertThat(carried.orderIndex()).isZero();               // phần dở đứng đầu buổi kế
        assertThat(carried.carriedFromId()).isEqualTo(contentB); // giữ liên kết gốc, không nhân bản
        assertThat(carried.curriculumItemId()).isEqualTo(f.itemB);
        assertThat(carried.plannedMinutes()).isEqualTo(20);

        // Kế hoạch thêm phần mới cho buổi 2 → phần chuyển tiếp vẫn đứng đầu
        sessionContentService.plan(f.teacher.getId(), s2.getId(),
                new PlanSessionContentsRequest(List.of(
                        new PlanSessionContentsRequest.PlanEntry(f.lesson.id(), null, 160, "phần mới"))));
        SessionContentsDto afterPlan = sessionContentService.list(f.teacher.getId(), s2.getId());
        assertThat(afterPlan.contents()).hasSize(2);
        assertThat(afterPlan.contents().get(0).carriedFromId()).isEqualTo(contentB);

        // Sửa lại: B hoá ra đã dạy xong → dòng chuyển tiếp (còn PLANNED) được dọn
        sessionContentService.confirm(f.teacher.getId(), s1.getId(),
                new ConfirmSessionContentsRequest(List.of(
                        new ConfirmSessionContentsRequest.ConfirmEntry(contentB, "TAUGHT", 60, null, null))));
        SessionContentsDto cleaned = sessionContentService.list(f.teacher.getId(), s2.getId());
        assertThat(cleaned.contents()).hasSize(1);
        assertThat(cleaned.contents().get(0).carriedFromId()).isNull();
    }

    @Test
    @DisplayName("AC06/AC17-nền: PARTIAL ở buổi cuối (không còn buổi kế) → báo phút chưa bố trí, không lặng lẽ nuốt")
    void carryOver_noNextSession() {
        Fixture f = curriculumFixture();
        ClassSession last = saveSession(f.klass.getId(), LocalDate.now().minusDays(1).atTime(8, 0));
        SessionContentsDto planned = sessionContentService.plan(f.teacher.getId(), last.getId(),
                new PlanSessionContentsRequest(List.of(
                        new PlanSessionContentsRequest.PlanEntry(f.lesson.id(), f.itemA, 120, null))));

        SessionContentsDto out = sessionContentService.confirm(f.teacher.getId(), last.getId(),
                new ConfirmSessionContentsRequest(List.of(
                        new ConfirmSessionContentsRequest.ConfirmEntry(
                                planned.contents().get(0).id(), "PARTIAL", 90, 30, null))));
        assertThat(out.unallocatedCarryMinutes()).isEqualTo(30);
    }

    // ── AC07/AC08: hoàn thành theo xác nhận ─────────────────────────────────

    @Test
    @DisplayName("AC07: nhật ký gắn bài giáo trình KHÔNG auto-complete; bài tự do giữ tiện lợi cũ")
    void log_doesNotAutoCompleteCurriculumLesson() {
        Fixture f = curriculumFixture();
        LocalDate d = LocalDate.now().minusDays(1);
        ClassSession s = saveSession(f.klass.getId(), d.atTime(8, 0));

        lessonLogService.createLog(f.teacher.getId(), f.klass.getId(),
                new CreateLessonLogRequest(d, null, "Buổi 1", null, null, List.of(), f.lesson.id(), s.getId()));
        ClassLessonDto after = classLessonService.listForTeacher(f.teacher.getId(), f.klass.getId())
                .stream().filter(l -> l.id().equals(f.lesson.id())).findFirst().orElseThrow();
        assertThat(after.completed()).isFalse(); // AC07: chỉ nhật ký ≠ đã dạy đủ Lektion

        // Bài tự do (lớp không giáo trình) vẫn auto-complete như cũ
        User t2 = newTeacher();
        TeacherClass free = newClass(t2.getId(), null);
        link(free.getId(), t2.getId());
        ClassLessonDto freeLesson = classLessonService.create(t2.getId(), free.getId(),
                new com.deutschflow.teacher.dto.CreateLessonRequest("Bài tự do", "x", null, null, null, null, null));
        lessonLogService.createLog(t2.getId(), free.getId(),
                new CreateLessonLogRequest(d, null, "Dạy xong", null, null, List.of(), freeLesson.id()));
        ClassLessonDto freeAfter = classLessonService.listForTeacher(t2.getId(), free.getId()).get(0);
        assertThat(freeAfter.completed()).isTrue();
    }

    @Test
    @DisplayName("AC08: đủ mọi mục TAUGHT → Lektion hoàn thành; hoàn tác một mục → trở lại còn dở; toggle tay bị chặn")
    void completion_followsConfirmation() {
        Fixture f = curriculumFixture();
        ClassSession s1 = saveSession(f.klass.getId(), LocalDate.now().minusDays(1).atTime(8, 0));
        SessionContentsDto planned = sessionContentService.plan(f.teacher.getId(), s1.getId(),
                new PlanSessionContentsRequest(List.of(
                        new PlanSessionContentsRequest.PlanEntry(f.lesson.id(), f.itemA, 120, null),
                        new PlanSessionContentsRequest.PlanEntry(f.lesson.id(), f.itemB, 60, null))));
        Long cA = planned.contents().get(0).id();
        Long cB = planned.contents().get(1).id();

        // Mới 1/2 mục → chưa hoàn thành (AC08: đủ buổi/log không có nghĩa đã xong)
        sessionContentService.confirm(f.teacher.getId(), s1.getId(),
                new ConfirmSessionContentsRequest(List.of(
                        new ConfirmSessionContentsRequest.ConfirmEntry(cA, "TAUGHT", 120, null, null))));
        assertThat(lessonCompleted(f)).isFalse();

        sessionContentService.confirm(f.teacher.getId(), s1.getId(),
                new ConfirmSessionContentsRequest(List.of(
                        new ConfirmSessionContentsRequest.ConfirmEntry(cB, "TAUGHT", 60, null, null))));
        assertThat(lessonCompleted(f)).isTrue(); // AC07: hoàn thành khi ĐỦ mục được xác nhận

        // Hoàn tác một mục → hết "hoàn thành giả"
        sessionContentService.confirm(f.teacher.getId(), s1.getId(),
                new ConfirmSessionContentsRequest(List.of(
                        new ConfirmSessionContentsRequest.ConfirmEntry(cB, "PLANNED", null, null, null))));
        assertThat(lessonCompleted(f)).isFalse();

        // Toggle tay completed của bài giáo trình → Forbidden (trạng thái suy ra)
        assertThatThrownBy(() -> classLessonService.update(f.teacher.getId(), f.klass.getId(), f.lesson.id(),
                new UpdateLessonRequest(null, null, true, null, null, null, null, null, null, null, null)))
                .isInstanceOf(ForbiddenException.class);
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    private record Fixture(Organization org, User admin, User teacher, TeacherClass klass,
                           ClassLessonDto lesson, Long itemA, Long itemB) {}

    private Fixture fixture() {
        Organization org = organizationRepo.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug("org-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
        User admin = newTeacher();
        User teacher = newTeacher();
        TeacherClass klass = newClass(teacher.getId(), org.getId());
        link(klass.getId(), teacher.getId());
        return new Fixture(org, admin, teacher, klass, null, null, null);
    }

    /** Fixture + giáo trình 1 Lektion (2 mục bắt buộc) đã publish và gán cho lớp. */
    private Fixture curriculumFixture() {
        Fixture f = fixture();
        OrgCurriculumSummaryDto curriculum = curriculumService.create(f.admin.getId(), f.org.getId(),
                new CreateCurriculumRequest("Bộ AC06-08 " + UUID.randomUUID().toString().substring(0, 6), "A1", null));
        Long versionId = curriculum.versions().get(0).id();
        CurriculumLektionDto lektion = curriculumService.addLektion(f.org.getId(), versionId,
                new UpsertLektionRequest("Lektion 1", null));
        List<com.deutschflow.organization.dto.CurriculumItemDto> items =
                curriculumService.replaceItems(f.org.getId(), lektion.id(), new ReplaceItemsRequest(List.of(
                        new CurriculumItemInput("Mục A", "SPRECHEN", "REDEMITTEL", 120),
                        new CurriculumItemInput("Mục B", null, "GRAMMATIK", 60))));
        curriculumService.publish(f.admin.getId(), f.org.getId(), versionId);
        assignmentService.assign(f.admin.getId(), f.org.getId(), f.klass.getId(),
                new AssignCurriculumRequest(versionId));

        ClassLessonDto lesson = classLessonService.listForTeacher(f.teacher.getId(), f.klass.getId()).get(0);
        return new Fixture(f.org, f.admin, f.teacher, f.klass, lesson,
                items.get(0).id(), items.get(1).id());
    }

    private boolean lessonCompleted(Fixture f) {
        return classLessonService.listForTeacher(f.teacher.getId(), f.klass.getId()).stream()
                .filter(l -> l.id().equals(f.lesson.id()))
                .findFirst().orElseThrow()
                .completed();
    }

    private static CreateLessonLogRequest logReq(LocalDate date, Integer number, Long sessionId) {
        return new CreateLessonLogRequest(date, number, "Chủ đề", null, null, List.of(), null, sessionId);
    }

    private User newTeacher() {
        return userRepository.save(User.builder()
                .email("alloc-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Alloc Tester")
                .role(User.Role.TEACHER)
                .build());
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

    /** Buổi lớp trung tâm chuẩn D04: 195′ chiếm lịch = 180 học + 15 nghỉ. */
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
}
