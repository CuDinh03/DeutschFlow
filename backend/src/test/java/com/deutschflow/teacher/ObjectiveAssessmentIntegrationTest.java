package com.deutschflow.teacher;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.dto.AssignCurriculumRequest;
import com.deutschflow.organization.dto.CreateCurriculumRequest;
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
import com.deutschflow.teacher.dto.ObjectiveAssessRequest;
import com.deutschflow.teacher.dto.ObjectiveMatrixDto;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.ClassTeacherId;
import com.deutschflow.teacher.entity.StudentAssignment;
import com.deutschflow.teacher.entity.StudentObjectiveAssessment;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.teacher.repository.StudentObjectiveAssessmentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.teacher.service.ObjectiveAssessmentService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * PR-9 (GĐ5) trên PostgreSQL thật: đánh giá theo mục tiêu — 3 trạng thái + supersede giữ lịch sử,
 * "chờ chấm" trung tính (AC12), gợi ý hỗ trợ theo ngưỡng org (chỉ tính người đã đánh giá), và
 * AC15: đánh giá lớp không chạm roadmap tự học.
 */
@SpringBootTest
@DisplayName("Objective assessment Integration Tests (V298, AC12/AC15/§7)")
class ObjectiveAssessmentIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private ObjectiveAssessmentService service;
    @Autowired private OrgCurriculumService curriculumService;
    @Autowired private OrgCurriculumAssignmentService assignmentService;
    @Autowired private OrgSettingsService orgSettingsService;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository orgMemberRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private TeacherClassRepository classRepo;
    @Autowired private ClassTeacherRepository classTeacherRepo;
    @Autowired private ClassStudentRepository classStudentRepo;
    @Autowired private ClassAssignmentRepository assignmentRepo;
    @Autowired private StudentAssignmentRepository studentAssignmentRepo;
    @Autowired private StudentObjectiveAssessmentRepository assessmentRepo;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("Đánh giá + đánh giá lại: bản mới supersede bản cũ (một bản hiệu lực, lịch sử giữ nguyên)")
    void assess_supersedesKeepingHistory() {
        Fixture f = fixture();
        Long objectiveId = f.objectiveIds.get(0);

        service.assess(f.teacher.getId(), f.klass.getId(),
                new ObjectiveAssessRequest(f.studentA.getId(), objectiveId, "NEEDS_PRACTICE", "phát âm yếu"));
        ObjectiveMatrixDto m = service.assess(f.teacher.getId(), f.klass.getId(),
                new ObjectiveAssessRequest(f.studentA.getId(), objectiveId, "ACHIEVED", "đã vững sau kèm riêng"));

        ObjectiveMatrixDto.StudentRow rowA = m.students().stream()
                .filter(r -> r.studentId().equals(f.studentA.getId())).findFirst().orElseThrow();
        assertThat(rowA.cells().get(0).status()).isEqualTo("ACHIEVED");

        List<StudentObjectiveAssessment> history = assessmentRepo
                .findByClassIdAndStudentIdAndObjectiveIdOrderByAssessedAtDesc(
                        f.klass.getId(), f.studentA.getId(), objectiveId);
        assertThat(history).hasSize(2);
        assertThat(history).filteredOn(a -> !a.isSuperseded()).hasSize(1);
        assertThat(history.stream().filter(a -> !a.isSuperseded()).findFirst().orElseThrow()
                .getSupersedesId()).isNotNull();
    }

    @Test
    @DisplayName("AC12: bài đã nộp chưa chấm = cột 'chờ chấm' riêng — ô mục tiêu vẫn NOT_ASSESSED, không thành yếu")
    void pendingGrading_staysNeutral() {
        Fixture f = fixture();
        ClassAssignment a = assignmentRepo.save(ClassAssignment.builder()
                .classId(f.klass.getId()).topic("Bài 1").assignmentType("GENERAL")
                .createdAt(LocalDateTime.now()).build());
        studentAssignmentRepo.save(StudentAssignment.builder()
                .assignmentId(a.getId()).studentId(f.studentA.getId()).status("SUBMITTED").build());

        ObjectiveMatrixDto m = service.matrix(f.teacher.getId(), f.klass.getId());
        ObjectiveMatrixDto.StudentRow rowA = m.students().stream()
                .filter(r -> r.studentId().equals(f.studentA.getId())).findFirst().orElseThrow();

        assertThat(rowA.pendingGradingCount()).isEqualTo(1);
        assertThat(rowA.cells()).allMatch(c -> "NOT_ASSESSED".equals(c.status()));
        assertThat(m.suggestions()).isEmpty(); // không ai bị kết luận yếu
    }

    @Test
    @DisplayName("Gợi ý §7: 2 học viên yếu → KÈM RIÊNG kèm tên; 3 học viên yếu → ÔN CHUNG; số chưa đánh giá hiện rõ")
    void suggestions_thresholds() {
        Fixture f = fixture(); // 4 học viên A,B,C,D — default: ≤2 riêng, ≥3 chung
        Long obj0 = f.objectiveIds.get(0);
        Long obj1 = f.objectiveIds.get(1);

        // obj0: A,B yếu (2 người → kèm riêng); C,D chưa đánh giá.
        for (User st : List.of(f.studentA, f.studentB)) {
            service.assess(f.teacher.getId(), f.klass.getId(),
                    new ObjectiveAssessRequest(st.getId(), obj0, "NEEDS_PRACTICE", null));
        }
        // obj1: A,B,C yếu (3 người → ôn chung).
        for (User st : List.of(f.studentA, f.studentB, f.studentC)) {
            service.assess(f.teacher.getId(), f.klass.getId(),
                    new ObjectiveAssessRequest(st.getId(), obj1, "NEEDS_PRACTICE", null));
        }

        ObjectiveMatrixDto m = service.matrix(f.teacher.getId(), f.klass.getId());
        ObjectiveMatrixDto.Suggestion s0 = m.suggestions().stream()
                .filter(s -> s.objectiveId().equals(obj0)).findFirst().orElseThrow();
        ObjectiveMatrixDto.Suggestion s1 = m.suggestions().stream()
                .filter(s -> s.objectiveId().equals(obj1)).findFirst().orElseThrow();

        assertThat(s0.kind()).isEqualTo("INDIVIDUAL_SUPPORT");
        assertThat(s0.studentIds()).containsExactlyInAnyOrder(f.studentA.getId(), f.studentB.getId());
        assertThat(s0.unassessedCount()).isEqualTo(2); // C, D chưa đánh giá — phải nhìn thấy
        assertThat(s1.kind()).isEqualTo("GROUP_REVIEW");
    }

    @Test
    @DisplayName("Ngưỡng đọc từ org_settings: hạ review_group_min=2 → 2 học viên yếu thành ÔN CHUNG")
    void thresholds_fromOrgSettings() {
        Fixture f = fixture();
        orgSettingsService.put(f.org.getId(), OrgSettingsService.REVIEW_GROUP_MIN, "2", f.owner.getId());
        Long obj0 = f.objectiveIds.get(0);
        for (User st : List.of(f.studentA, f.studentB)) {
            service.assess(f.teacher.getId(), f.klass.getId(),
                    new ObjectiveAssessRequest(st.getId(), obj0, "NEEDS_PRACTICE", null));
        }

        ObjectiveMatrixDto m = service.matrix(f.teacher.getId(), f.klass.getId());
        assertThat(m.suggestions().stream().filter(s -> s.objectiveId().equals(obj0)).findFirst()
                .orElseThrow().kind()).isEqualTo("GROUP_REVIEW");
    }

    @Test
    @DisplayName("AC15: đánh giá mục tiêu của LỚP không ghi gì vào lộ trình tự học (D11)")
    void assessment_neverTouchesRoadmap() {
        Fixture f = fixture();
        long before = roadmapRowCount();
        service.assess(f.teacher.getId(), f.klass.getId(),
                new ObjectiveAssessRequest(f.studentA.getId(), f.objectiveIds.get(0), "ACHIEVED", null));
        service.assess(f.teacher.getId(), f.klass.getId(),
                new ObjectiveAssessRequest(f.studentA.getId(), f.objectiveIds.get(1), "ACHIEVED", null));
        assertThat(roadmapRowCount()).isEqualTo(before);
    }

    @Test
    @DisplayName("Quyền + validate: trợ giảng xem được nhưng không đánh giá; mục tiêu ngoài giáo trình lớp bị 400")
    void permissions_andValidation() {
        Fixture f = fixture();
        User assistant = newUser(User.Role.TEACHER);
        classTeacherRepo.save(ClassTeacher.builder()
                .id(new ClassTeacherId(f.klass.getId(), assistant.getId()))
                .role("ASSISTANT").joinedAt(LocalDateTime.now()).build());

        assertThat(service.matrix(assistant.getId(), f.klass.getId()).objectives()).isNotEmpty();
        assertThatThrownBy(() -> service.assess(assistant.getId(), f.klass.getId(),
                new ObjectiveAssessRequest(f.studentA.getId(), f.objectiveIds.get(0), "ACHIEVED", null)))
                .isInstanceOf(ForbiddenException.class);

        // Mục tiêu của một giáo trình KHÁC (org khác) không đánh giá được trên lớp này.
        Fixture other = fixture();
        assertThatThrownBy(() -> service.assess(f.teacher.getId(), f.klass.getId(),
                new ObjectiveAssessRequest(f.studentA.getId(), other.objectiveIds.get(0), "ACHIEVED", null)))
                .isInstanceOf(BadRequestException.class);
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    private record Fixture(Organization org, User owner, User teacher,
                           User studentA, User studentB, User studentC, User studentD,
                           TeacherClass klass, List<Long> objectiveIds) {}

    private Fixture fixture() {
        Organization org = organizationRepo.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug("org-" + UUID.randomUUID())
                .seatLimit(50).status("ACTIVE").build());
        User owner = newUser(User.Role.TEACHER);
        User teacher = newUser(User.Role.TEACHER);
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
        User a = newUser(User.Role.STUDENT);
        User b = newUser(User.Role.STUDENT);
        User c = newUser(User.Role.STUDENT);
        User d = newUser(User.Role.STUDENT);
        for (User st : List.of(a, b, c, d)) {
            classStudentRepo.save(ClassStudent.builder()
                    .id(new ClassStudentId(klass.getId(), st.getId()))
                    .joinedAt(LocalDateTime.now()).build());
        }

        var curriculum = curriculumService.create(owner.getId(), org.getId(),
                new CreateCurriculumRequest("Bộ PR-9 " + UUID.randomUUID().toString().substring(0, 6), "A1", null));
        Long versionId = curriculum.versions().get(0).id();
        var lektion = curriculumService.addLektion(org.getId(), versionId,
                new UpsertLektionRequest("Lektion 1", null));
        curriculumService.replaceItems(org.getId(), lektion.id(),
                new com.deutschflow.organization.dto.ReplaceItemsRequest(List.of(
                        new com.deutschflow.organization.dto.CurriculumItemInput("Mục A", null, "GRAMMATIK", 60))));
        var objectives = curriculumService.replaceObjectives(org.getId(), lektion.id(),
                new ReplaceObjectivesRequest(List.of(
                        new com.deutschflow.organization.dto.CurriculumObjectiveInput(
                                "Kann sich vorstellen", "A1", "SPRECHEN"),
                        new com.deutschflow.organization.dto.CurriculumObjectiveInput(
                                "Kann Zahlen verstehen", "A1", "HOEREN"))));
        curriculumService.publish(owner.getId(), org.getId(), versionId);
        assignmentService.assign(owner.getId(), org.getId(), klass.getId(), new AssignCurriculumRequest(versionId));

        return new Fixture(org, owner, teacher, a, b, c, d, klass,
                objectives.stream().map(o -> o.id()).toList());
    }

    /** Tổng dòng của các bảng lộ trình tự học (AC15/D11 — đánh giá lớp không được chạm). */
    private long roadmapRowCount() {
        long n = 0;
        for (String table : List.of("learning_plans", "user_learning_profiles")) {
            Long c = jdbcTemplate.queryForObject(
                    "SELECT COALESCE((SELECT COUNT(*) FROM " + table + "), 0)", Long.class);
            n += c == null ? 0 : c;
        }
        return n;
    }

    private void member(Long orgId, Long userId, String role) {
        orgMemberRepo.save(OrgMember.builder()
                .id(new OrgMemberId(orgId, userId))
                .role(role).status("ACTIVE").joinedAt(java.time.Instant.now()).build());
    }

    private User newUser(User.Role role) {
        return userRepository.save(User.builder()
                .email("oa-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x").displayName("OA " + UUID.randomUUID().toString().substring(0, 4))
                .role(role).build());
    }
}
