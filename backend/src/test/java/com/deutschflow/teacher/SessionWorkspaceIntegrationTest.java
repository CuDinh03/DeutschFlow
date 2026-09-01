package com.deutschflow.teacher;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.entity.OrgAcademicApprover;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgAcademicApproverRepository;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.teacher.dto.ClassLessonLogDto;
import com.deutschflow.teacher.dto.CreateLessonLogRequest;
import com.deutschflow.teacher.dto.SessionWorkspaceDto;
import com.deutschflow.teacher.entity.ClassRecordRevision;
import com.deutschflow.teacher.entity.ClassSession;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.ClassTeacherId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassRecordRevisionRepository;
import com.deutschflow.teacher.repository.ClassRecordUnlockRepository;
import com.deutschflow.teacher.repository.ClassSessionRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.teacher.service.LessonLogService;
import com.deutschflow.teacher.service.RecordUnlockService;
import com.deutschflow.teacher.service.SessionWorkspaceService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * PR-7 (GĐ4) trên PostgreSQL thật: màn làm việc theo buổi + CHỐT buổi (V292 completed_at/by —
 * buổi qua giờ không tự thành "đã dạy"), cửa sổ sửa hồi tố 7 ngày + mở khóa 24h (V296, P07),
 * lịch sử before/after append-only, và cờ "cần bù riêng" khi vắng (AC13).
 */
@SpringBootTest
@DisplayName("Session workspace Integration Tests (V296, P07/AC13/§2.3)")
class SessionWorkspaceIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private SessionWorkspaceService workspaceService;
    @Autowired private LessonLogService lessonLogService;
    @Autowired private RecordUnlockService unlockService;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository orgMemberRepo;
    @Autowired private OrgAcademicApproverRepository approverRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private TeacherClassRepository classRepo;
    @Autowired private ClassTeacherRepository classTeacherRepo;
    @Autowired private ClassStudentRepository classStudentRepo;
    @Autowired private ClassSessionRepository sessionRepo;
    @Autowired private ClassRecordRevisionRepository revisionRepo;
    @Autowired private ClassRecordUnlockRepository unlockRepo;

    // ── §2.3: chốt buổi ─────────────────────────────────────────────────────

    @Test
    @DisplayName("Chốt buổi: đặt completed_at/by + ghi lịch sử; chốt hai lần Conflict; buổi tương lai chưa chốt được; bỏ chốt trong cửa sổ")
    void completeSession_flow() {
        Fixture f = fixture();
        ClassSession past = saveSession(f.klass.getId(), LocalDateTime.now().minusDays(1));
        ClassSession future = saveSession(f.klass.getId(), LocalDateTime.now().plusDays(3));

        SessionWorkspaceDto done = workspaceService.complete(f.teacher.getId(), past.getId());
        assertThat(done.completedAt()).isNotNull();
        assertThat(done.completedByTeacherId()).isEqualTo(f.teacher.getId());
        assertThat(revisionRepo.findByEntityTypeAndEntityIdOrderByChangedAtDesc(
                ClassRecordRevision.EntityType.SESSION_COMPLETION, past.getId())).hasSize(1);

        assertThatThrownBy(() -> workspaceService.complete(f.teacher.getId(), past.getId()))
                .isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> workspaceService.complete(f.teacher.getId(), future.getId()))
                .isInstanceOf(BadRequestException.class);

        SessionWorkspaceDto undone = workspaceService.uncomplete(f.teacher.getId(), past.getId());
        assertThat(undone.completedAt()).isNull();
        assertThat(revisionRepo.findByEntityTypeAndEntityIdOrderByChangedAtDesc(
                ClassRecordRevision.EntityType.SESSION_COMPLETION, past.getId())).hasSize(2);
    }

    // ── P07: cửa sổ 7 ngày + mở khóa 24h ────────────────────────────────────

    @Test
    @DisplayName("P07: sửa/xoá nhật ký buổi quá 7 ngày bị khóa; mở khóa 24h mở lại (kèm lịch sử); hết hạn khóa lại")
    void editWindow_unlockReopens() {
        Fixture f = fixture();
        ClassSession old = saveSession(f.klass.getId(), LocalDateTime.now().minusDays(10));
        ClassLessonLogDto log = lessonLogService.createLog(f.teacher.getId(), f.klass.getId(),
                logReq(old.getStartAt().toLocalDate(), old.getId(), "Chủ đề cũ"));

        CreateLessonLogRequest edit = new CreateLessonLogRequest(
                old.getStartAt().toLocalDate(), null, "Chủ đề SỬA", null, null, List.of(),
                null, old.getId(), "bổ sung nội dung thiếu");
        assertThatThrownBy(() -> lessonLogService.updateLog(f.teacher.getId(), f.klass.getId(), log.id(), edit))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("mở khóa");
        assertThatThrownBy(() -> lessonLogService.deleteLog(f.teacher.getId(), f.klass.getId(), log.id()))
                .isInstanceOf(ForbiddenException.class);

        // Người duyệt học vụ cấp mở khóa 24h → sửa được, lịch sử before/after + lý do được ghi.
        unlockService.grant(f.leadTeacher.getId(), f.org.getId(), new RecordUnlockService.GrantRequest(
                f.klass.getId(), f.teacher.getId(), old.getId(), "GV nhập thiếu nội dung buổi 10 ngày trước"));
        ClassLessonLogDto updated = lessonLogService.updateLog(f.teacher.getId(), f.klass.getId(), log.id(), edit);
        assertThat(updated.topic()).isEqualTo("Chủ đề SỬA");
        List<ClassRecordRevision> revs = revisionRepo.findByEntityTypeAndEntityIdOrderByChangedAtDesc(
                ClassRecordRevision.EntityType.LESSON_LOG, log.id());
        assertThat(revs).isNotEmpty();
        assertThat(revs.get(0).getBeforeState().get("topic")).isEqualTo("Chủ đề cũ");
        assertThat(revs.get(0).getAfterState().get("topic")).isEqualTo("Chủ đề SỬA");
        assertThat(revs.get(0).getReason()).isEqualTo("bổ sung nội dung thiếu");

        // Mở khóa hết hạn → khóa lại (không cần chờ 24h thật: chỉnh expires_at về quá khứ).
        unlockRepo.findAll().forEach(u -> { u.setExpiresAt(LocalDateTime.now().minusMinutes(1)); unlockRepo.save(u); });
        assertThatThrownBy(() -> lessonLogService.updateLog(f.teacher.getId(), f.klass.getId(), log.id(), edit))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("P07: sửa nhật ký TRONG cửa sổ 7 ngày tự do như cũ — vẫn để lại lịch sử")
    void editInsideWindow_stillFree() {
        Fixture f = fixture();
        ClassSession recent = saveSession(f.klass.getId(), LocalDateTime.now().minusDays(2));
        ClassLessonLogDto log = lessonLogService.createLog(f.teacher.getId(), f.klass.getId(),
                logReq(recent.getStartAt().toLocalDate(), recent.getId(), "Buổi mới"));

        ClassLessonLogDto updated = lessonLogService.updateLog(f.teacher.getId(), f.klass.getId(), log.id(),
                new CreateLessonLogRequest(recent.getStartAt().toLocalDate(), null, "Buổi mới (sửa)",
                        null, null, List.of(), null, recent.getId(), null));
        assertThat(updated.topic()).isEqualTo("Buổi mới (sửa)");
        assertThat(revisionRepo.findByEntityTypeAndEntityIdOrderByChangedAtDesc(
                ClassRecordRevision.EntityType.LESSON_LOG, log.id())).hasSize(1);
    }

    // ── AC13: vắng → cờ "cần bù riêng" ──────────────────────────────────────

    @Test
    @DisplayName("AC13: ABSENT mặc định mang needsMakeup; PRESENT thì không; giáo viên bỏ cờ tường minh được")
    void absence_setsNeedsMakeup() {
        Fixture f = fixture();
        ClassSession s = saveSession(f.klass.getId(), LocalDateTime.now().minusDays(1));
        ClassLessonLogDto log = lessonLogService.createLog(f.teacher.getId(), f.klass.getId(),
                new CreateLessonLogRequest(s.getStartAt().toLocalDate(), null, "Điểm danh", null, null,
                        List.of(new CreateLessonLogRequest.AttendanceInput(f.student.getId(), "ABSENT", null),
                                new CreateLessonLogRequest.AttendanceInput(f.student2.getId(), "PRESENT", null)),
                        null, s.getId(), null));

        assertThat(log.attendance()).hasSize(2);
        assertThat(entry(log, f.student.getId()).needsMakeup()).isTrue();   // vắng → cần bù riêng
        assertThat(entry(log, f.student2.getId()).needsMakeup()).isFalse();

        // Giáo viên chủ động bỏ cờ (đã bù xong) — gửi tường minh needsMakeup=false với ABSENT.
        ClassLessonLogDto updated = lessonLogService.updateLog(f.teacher.getId(), f.klass.getId(), log.id(),
                new CreateLessonLogRequest(s.getStartAt().toLocalDate(), null, "Điểm danh", null, null,
                        List.of(new CreateLessonLogRequest.AttendanceInput(f.student.getId(), "ABSENT", null, false),
                                new CreateLessonLogRequest.AttendanceInput(f.student2.getId(), "PRESENT", null, null)),
                        null, s.getId(), null));
        assertThat(entry(updated, f.student.getId()).needsMakeup()).isFalse();
    }

    // ── Workspace gom đủ ba khối ────────────────────────────────────────────

    @Test
    @DisplayName("Workspace: một response gom session + contents + nhật ký của buổi + roster + cửa sổ sửa + forecast")
    void workspace_aggregates() {
        Fixture f = fixture();
        ClassSession s = saveSession(f.klass.getId(), LocalDateTime.now().minusDays(1));
        lessonLogService.createLog(f.teacher.getId(), f.klass.getId(),
                logReq(s.getStartAt().toLocalDate(), s.getId(), "Buổi hôm qua"));

        SessionWorkspaceDto ws = workspaceService.workspace(f.teacher.getId(), s.getId());

        assertThat(ws.sessionId()).isEqualTo(s.getId());
        assertThat(ws.className()).isEqualTo(f.klass.getName());
        assertThat(ws.editable()).isTrue();
        assertThat(ws.unlockActive()).isFalse();
        assertThat(ws.editWindowDays()).isEqualTo(7);
        assertThat(ws.contents().sessionId()).isEqualTo(s.getId());
        assertThat(ws.log()).isNotNull();
        assertThat(ws.log().topic()).isEqualTo("Buổi hôm qua");
        assertThat(ws.roster()).extracting(SessionWorkspaceDto.RosterStudent::studentId)
                .containsExactlyInAnyOrder(f.student.getId(), f.student2.getId());
        assertThat(ws.forecast()).isNotNull();

        // Giáo viên lớp khác không mở được workspace của buổi này.
        User outsider = newUser(User.Role.TEACHER);
        assertThatThrownBy(() -> workspaceService.workspace(outsider.getId(), s.getId()))
                .isInstanceOf(ForbiddenException.class);
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    private record Fixture(Organization org, User owner, User leadTeacher, User teacher,
                           User student, User student2, TeacherClass klass) {}

    private Fixture fixture() {
        Organization org = organizationRepo.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug("org-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
        User owner = newUser(User.Role.TEACHER);
        User leadTeacher = newUser(User.Role.TEACHER);
        User teacher = newUser(User.Role.TEACHER);
        User student = newUser(User.Role.STUDENT);
        User student2 = newUser(User.Role.STUDENT);
        member(org.getId(), owner.getId(), "OWNER");
        member(org.getId(), leadTeacher.getId(), "TEACHER");
        member(org.getId(), teacher.getId(), "TEACHER");
        approverRepo.save(OrgAcademicApprover.builder()
                .orgId(org.getId()).userId(leadTeacher.getId()).scope("ORG")
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
        for (User st : List.of(student, student2)) {
            classStudentRepo.save(ClassStudent.builder()
                    .id(new ClassStudentId(klass.getId(), st.getId()))
                    .joinedAt(LocalDateTime.now())
                    .build());
        }
        return new Fixture(org, owner, leadTeacher, teacher, student, student2, klass);
    }

    private static ClassLessonLogDto.AttendanceEntry entry(ClassLessonLogDto log, Long studentId) {
        return log.attendance().stream().filter(a -> a.studentId().equals(studentId)).findFirst().orElseThrow();
    }

    private static CreateLessonLogRequest logReq(java.time.LocalDate date, Long sessionId, String topic) {
        return new CreateLessonLogRequest(date, null, topic, null, null, List.of(), null, sessionId, null);
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
                .email("ws-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x").displayName("WS Tester").role(role).build());
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
}
