package com.deutschflow.teacher;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.organization.dto.AssignCurriculumRequest;
import com.deutschflow.organization.dto.CreateCurriculumRequest;
import com.deutschflow.organization.dto.CurriculumItemInput;
import com.deutschflow.organization.dto.ReplaceItemsRequest;
import com.deutschflow.organization.dto.ReplaceObjectivesRequest;
import com.deutschflow.organization.dto.UpsertLektionRequest;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.organization.service.OrgCurriculumAssignmentService;
import com.deutschflow.organization.service.OrgCurriculumService;
import com.deutschflow.organization.service.OrgSettingsService;
import com.deutschflow.teacher.dto.FourAxisReportDto;
import com.deutschflow.teacher.dto.ObjectiveAssessRequest;
import com.deutschflow.teacher.entity.ClassSession;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.ClassTeacherId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassSessionRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.teacher.service.FourAxisReportService;
import com.deutschflow.teacher.service.ObjectiveAssessmentService;
import com.deutschflow.teacher.service.TeacherTimesheetService;
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
 * PR-10 (GĐ5) trên PostgreSQL thật: P04 — chính sách tính công đọc từ org_settings đổi được PHÚT
 * GỢI Ý (không hồi tố record); key lạ bị từ chối; báo cáo 4 trục tổng hợp đúng từ dữ liệu các PR
 * trước (không bảng mới).
 */
@SpringBootTest
@DisplayName("Org settings + four-axis report Integration Tests (PR-10, P04/§7)")
class OrgSettingsAndFourAxisIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private OrgSettingsService settingsService;
    @Autowired private TeacherTimesheetService timesheetService;
    @Autowired private FourAxisReportService fourAxisReportService;
    @Autowired private ObjectiveAssessmentService objectiveAssessmentService;
    @Autowired private OrgCurriculumService curriculumService;
    @Autowired private OrgCurriculumAssignmentService assignmentService;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository orgMemberRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private TeacherClassRepository classRepo;
    @Autowired private ClassTeacherRepository classTeacherRepo;
    @Autowired private ClassStudentRepository classStudentRepo;
    @Autowired private ClassSessionRepository sessionRepo;

    @Test
    @DisplayName("P04: default gợi ý công = 195′ (gồm nghỉ — hành vi cũ); org tắt break_included → gợi ý 180′ phút học")
    void timesheetSuggestion_followsOrgPolicy() {
        Fixture f = fixture();
        ClassSession past = saveSession(f.klass.getId(), LocalDateTime.now().minusDays(1).withHour(8));

        var before = timesheetService.suggestions(f.teacher.getId(),
                LocalDateTime.now().minusDays(3), LocalDateTime.now());
        assertThat(before).anySatisfy(sg -> {
            assertThat(sg.sessionId()).isEqualTo(past.getId());
            assertThat(sg.plannedDurationMinutes()).isEqualTo(195); // default: gồm giờ nghỉ
        });

        settingsService.put(f.org.getId(), OrgSettingsService.TIMESHEET_BREAK_INCLUDED, "false", f.owner.getId());

        var after = timesheetService.suggestions(f.teacher.getId(),
                LocalDateTime.now().minusDays(3), LocalDateTime.now());
        assertThat(after).anySatisfy(sg -> {
            assertThat(sg.sessionId()).isEqualTo(past.getId());
            assertThat(sg.plannedDurationMinutes()).isEqualTo(180); // phút HỌC (D04)
        });

        // Key lạ bị từ chối — org_settings không thành bãi rác key-value.
        assertThatThrownBy(() -> settingsService.put(f.org.getId(), "khoa_la", "1", f.owner.getId()))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("Báo cáo 4 trục: tổng hợp nội dung/nhịp độ/tham gia/mục tiêu đúng từ dữ liệu sẵn có")
    void fourAxis_aggregates() {
        Fixture f = fixture();
        saveSession(f.klass.getId(), LocalDateTime.now().plusDays(3).withHour(8)); // khung tương lai

        // Trục 4: một học viên cần luyện một mục tiêu.
        objectiveAssessmentService.assess(f.teacher.getId(), f.klass.getId(),
                new ObjectiveAssessRequest(f.student.getId(), f.objectiveId, "NEEDS_PRACTICE", null));

        FourAxisReportDto r = fourAxisReportService.report(f.teacher.getId(), f.klass.getId());

        assertThat(r.content().totalItems()).isEqualTo(1);
        assertThat(r.content().totalLessons()).isEqualTo(1);   // 1 Lektion → 1 bài giáo trình
        assertThat(r.content().taughtItems()).isZero();        // chưa xác nhận gì
        assertThat(r.pacing().remainingMinutes()).isEqualTo(60);
        assertThat(r.pacing().availableMinutes()).isEqualTo(180);
        assertThat(r.pacing().projectedEndDate()).isNotNull();
        assertThat(r.participation().totalPastSessions()).isZero();
        assertThat(r.objectives().needsPractice()).isEqualTo(1);
        assertThat(r.objectives().totalObjectives()).isEqualTo(1);
        assertThat(r.objectives().studentsNeedingSupport()).hasSize(1);
    }

    // ── fixtures (khuôn PR-9, 1 item 60′ + 1 objective) ─────────────────────

    private record Fixture(Organization org, User owner, User teacher, User student,
                           TeacherClass klass, Long objectiveId) {}

    private Fixture fixture() {
        Organization org = organizationRepo.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug("org-" + UUID.randomUUID())
                .seatLimit(50).status("ACTIVE").build());
        User owner = newUser(User.Role.TEACHER);
        User teacher = newUser(User.Role.TEACHER);
        User student = newUser(User.Role.STUDENT);
        member(org.getId(), owner.getId(), "OWNER");
        member(org.getId(), teacher.getId(), "TEACHER");

        TeacherClass klass = classRepo.save(TeacherClass.builder()
                .teacherId(teacher.getId()).orgId(org.getId())
                .name("A1 · " + UUID.randomUUID().toString().substring(0, 8))
                .inviteCode("INV-" + UUID.randomUUID())
                .createdAt(LocalDateTime.now()).build());
        classTeacherRepo.save(ClassTeacher.builder()
                .id(new ClassTeacherId(klass.getId(), teacher.getId()))
                .role("PRIMARY").joinedAt(LocalDateTime.now()).build());
        classStudentRepo.save(ClassStudent.builder()
                .id(new ClassStudentId(klass.getId(), student.getId()))
                .joinedAt(LocalDateTime.now()).build());

        var curriculum = curriculumService.create(owner.getId(), org.getId(),
                new CreateCurriculumRequest("Bộ PR-10 " + UUID.randomUUID().toString().substring(0, 6), "A1", null));
        Long versionId = curriculum.versions().get(0).id();
        var lektion = curriculumService.addLektion(org.getId(), versionId,
                new UpsertLektionRequest("Lektion 1", null));
        curriculumService.replaceItems(org.getId(), lektion.id(), new ReplaceItemsRequest(List.of(
                new CurriculumItemInput("Mục A", null, "GRAMMATIK", 60))));
        var objectives = curriculumService.replaceObjectives(org.getId(), lektion.id(),
                new ReplaceObjectivesRequest(List.of(
                        new com.deutschflow.organization.dto.CurriculumObjectiveInput(
                                "Kann sich vorstellen", "A1", "SPRECHEN"))));
        curriculumService.publish(owner.getId(), org.getId(), versionId);
        assignmentService.assign(owner.getId(), org.getId(), klass.getId(), new AssignCurriculumRequest(versionId));
        return new Fixture(org, owner, teacher, student, klass, objectives.get(0).id());
    }

    private void member(Long orgId, Long userId, String role) {
        orgMemberRepo.save(OrgMember.builder()
                .id(new OrgMemberId(orgId, userId))
                .role(role).status("ACTIVE").joinedAt(java.time.Instant.now()).build());
    }

    private User newUser(User.Role role) {
        return userRepository.save(User.builder()
                .email("fa-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x").displayName("FA " + UUID.randomUUID().toString().substring(0, 4))
                .role(role).build());
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
