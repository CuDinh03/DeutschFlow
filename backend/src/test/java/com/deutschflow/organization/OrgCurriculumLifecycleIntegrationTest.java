package com.deutschflow.organization;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.AssignCurriculumRequest;
import com.deutschflow.organization.dto.ClassCurriculumLinkDto;
import com.deutschflow.organization.dto.CreateCurriculumRequest;
import com.deutschflow.organization.dto.CurriculumAssignmentImpactDto;
import com.deutschflow.organization.dto.CurriculumItemInput;
import com.deutschflow.organization.dto.CurriculumLektionDto;
import com.deutschflow.organization.dto.CurriculumObjectiveInput;
import com.deutschflow.organization.dto.CurriculumVersionDetailDto;
import com.deutschflow.organization.dto.OrgCurriculumSummaryDto;
import com.deutschflow.organization.dto.ReplaceItemsRequest;
import com.deutschflow.organization.dto.ReplaceObjectivesRequest;
import com.deutschflow.organization.dto.UpsertLektionRequest;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.organization.service.OrgCurriculumAssignmentService;
import com.deutschflow.organization.service.OrgCurriculumService;
import com.deutschflow.teacher.dto.ClassLessonDto;
import com.deutschflow.teacher.dto.CreateLessonRequest;
import com.deutschflow.teacher.dto.UpdateLessonRequest;
import com.deutschflow.teacher.entity.ClassLessonLog;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.ClassTeacherId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassLessonLogRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.teacher.service.ClassLessonService;
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
 * PR-1 (GĐ1): vòng đời giáo trình trung tâm trên PostgreSQL thật — schema V289/V290 áp được,
 * PUBLISHED bất biến, gán phiên bản sinh bài + knowledge point + can-do, guard AC01 phía giáo
 * viên, và trace-guard chặn đổi/gỡ khi đã có dấu vết giảng dạy.
 */
@SpringBootTest
@DisplayName("Org curriculum lifecycle Integration Tests (V289/V290, AC01)")
class OrgCurriculumLifecycleIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private OrgCurriculumService curriculumService;
    @Autowired private OrgCurriculumAssignmentService assignmentService;
    @Autowired private ClassLessonService classLessonService;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private TeacherClassRepository classRepo;
    @Autowired private ClassTeacherRepository classTeacherRepo;
    @Autowired private ClassLessonLogRepository lessonLogRepo;

    @Test
    @DisplayName("vòng đời: DRAFT soạn được → publish → nội dung bất biến → bản nháp mới sao chép nội dung")
    void lifecycle_publishFreezesContent() {
        Fixture f = fixture();
        Long versionId = createOneLektionCurriculum(f.admin, f.org, "Bộ B1 nội bộ");

        curriculumService.publish(f.admin.getId(), f.org.getId(), versionId);

        CurriculumVersionDetailDto published = curriculumService.getVersionDetail(f.org.getId(), versionId);
        assertThat(published.status()).isEqualTo("PUBLISHED");
        Long lektionId = published.lektionen().get(0).id();

        // PUBLISHED bất biến: mọi đường sửa nội dung đều 409
        assertThatThrownBy(() -> curriculumService.addLektion(f.org.getId(), versionId,
                new UpsertLektionRequest("Lektion lậu", null)))
                .isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> curriculumService.updateLektion(f.org.getId(), lektionId,
                new UpsertLektionRequest("Đổi tên", null)))
                .isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> curriculumService.replaceItems(f.org.getId(), lektionId,
                new ReplaceItemsRequest(List.of(new CurriculumItemInput("mục mới", null, null, null)))))
                .isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> curriculumService.deleteVersion(f.org.getId(), versionId))
                .isInstanceOf(ConflictException.class);

        // Sửa = tạo bản nháp mới, nội dung được sao chép nguyên vẹn
        CurriculumVersionDetailDto draft2 = curriculumService.createVersion(f.org.getId(),
                published.curriculumId(), null);
        assertThat(draft2.versionNo()).isEqualTo(2);
        assertThat(draft2.status()).isEqualTo("DRAFT");
        assertThat(draft2.lektionen()).hasSize(1);
        assertThat(draft2.lektionen().get(0).items()).hasSize(2);
        assertThat(draft2.lektionen().get(0).objectives()).hasSize(1);

        // Mỗi bộ chỉ một bản nháp
        assertThatThrownBy(() -> curriculumService.createVersion(f.org.getId(), published.curriculumId(), null))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    @DisplayName("publish chặn giáo trình rỗng và Lektion chưa có mục bắt buộc")
    void publish_requiresContent() {
        Fixture f = fixture();
        OrgCurriculumSummaryDto empty = curriculumService.create(f.admin.getId(), f.org.getId(),
                new CreateCurriculumRequest("Bộ rỗng", "A1", null));
        Long emptyVersionId = empty.versions().get(0).id();
        assertThatThrownBy(() -> curriculumService.publish(f.admin.getId(), f.org.getId(), emptyVersionId))
                .isInstanceOf(BadRequestException.class);

        CurriculumLektionDto lektion = curriculumService.addLektion(f.org.getId(), emptyVersionId,
                new UpsertLektionRequest("Lektion 1", null));
        assertThatThrownBy(() -> curriculumService.publish(f.admin.getId(), f.org.getId(), emptyVersionId))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Lektion 1");
        assertThat(lektion.id()).isNotNull();
    }

    @Test
    @DisplayName("cách ly trung tâm: org B không đọc/sửa được giáo trình của org A (đoán id)")
    void crossOrg_isolated() {
        Fixture a = fixture();
        Fixture b = fixture();
        Long versionA = createOneLektionCurriculum(a.admin, a.org, "Bộ của A");

        assertThatThrownBy(() -> curriculumService.getVersionDetail(b.org.getId(), versionA))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> curriculumService.addLektion(b.org.getId(), versionA,
                new UpsertLektionRequest("Xâm nhập", null)))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("gán phiên bản PUBLISHED: sinh bài đúng thứ tự kèm knowledge point + can-do; DRAFT bị chặn")
    void assign_generatesLessons() {
        Fixture f = fixture();
        Long versionId = createOneLektionCurriculum(f.admin, f.org, "Bộ gán lớp");

        // DRAFT chưa công bố → không gán được (P03)
        assertThatThrownBy(() -> assignmentService.assign(f.admin.getId(), f.org.getId(), f.klass.getId(),
                new AssignCurriculumRequest(versionId)))
                .isInstanceOf(ConflictException.class);

        curriculumService.publish(f.admin.getId(), f.org.getId(), versionId);
        ClassCurriculumLinkDto link = assignmentService.assign(f.admin.getId(), f.org.getId(),
                f.klass.getId(), new AssignCurriculumRequest(versionId));
        assertThat(link.versionId()).isEqualTo(versionId);

        List<ClassLessonDto> lessons = classLessonService.listForTeacher(f.teacher.getId(), f.klass.getId());
        assertThat(lessons).hasSize(1);
        ClassLessonDto generated = lessons.get(0);
        assertThat(generated.lektionId()).isNotNull();
        assertThat(generated.supplementary()).isFalse();
        assertThat(generated.title()).isEqualTo("Lektion 1 — Test");
        assertThat(generated.knowledgePoints()).hasSize(2);
        assertThat(generated.canDoStatements()).hasSize(1);
        assertThat(generated.description()).contains("Mục A").contains("Mục B");

        // Gán lại đúng phiên bản đang dùng = idempotent, không nhân đôi bài
        assignmentService.assign(f.admin.getId(), f.org.getId(), f.klass.getId(),
                new AssignCurriculumRequest(versionId));
        assertThat(classLessonService.listForTeacher(f.teacher.getId(), f.klass.getId())).hasSize(1);

        // Lớp ngoài trung tâm không gán được
        TeacherClass outside = newClass(f.teacher.getId(), null);
        assertThatThrownBy(() -> assignmentService.assign(f.admin.getId(), f.org.getId(), outside.getId(),
                new AssignCurriculumRequest(versionId)))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("AC01 end-to-end: GV không sửa/xóa bài giáo trình; thêm bài bổ trợ được và mang cờ supplementary")
    void ac01_teacherCannotMutateCurriculumLessons() {
        Fixture f = fixture();
        Long versionId = createOneLektionCurriculum(f.admin, f.org, "Bộ AC01");
        curriculumService.publish(f.admin.getId(), f.org.getId(), versionId);
        assignmentService.assign(f.admin.getId(), f.org.getId(), f.klass.getId(),
                new AssignCurriculumRequest(versionId));

        Long lessonId = classLessonService.listForTeacher(f.teacher.getId(), f.klass.getId()).get(0).id();

        assertThatThrownBy(() -> classLessonService.update(f.teacher.getId(), f.klass.getId(), lessonId,
                new UpdateLessonRequest("Sửa trộm", null, null, null, null, null, null, null, null, null, null)))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> classLessonService.delete(f.teacher.getId(), f.klass.getId(), lessonId))
                .isInstanceOf(ForbiddenException.class);

        // Trường phân phối vẫn sửa được
        ClassLessonDto updated = classLessonService.update(f.teacher.getId(), f.klass.getId(), lessonId,
                new UpdateLessonRequest(null, null, null, null, LocalDate.of(2026, 9, 14), null, null, null, null, null, null));
        assertThat(updated.plannedDate()).isEqualTo(LocalDate.of(2026, 9, 14));

        // Bài bổ trợ: được phép, mang cờ supplementary
        ClassLessonDto extra = classLessonService.create(f.teacher.getId(), f.klass.getId(),
                new CreateLessonRequest("Bài bổ trợ", "Ôn số đếm", null, null, null, null, null));
        assertThat(extra.supplementary()).isTrue();
        assertThat(extra.lektionId()).isNull();
    }

    @Test
    @DisplayName("trace-guard: có nhật ký gắn bài giáo trình → đổi/gỡ phiên bản bị 409; impact báo đúng")
    void relink_blockedByTraces() {
        Fixture f = fixture();
        Long v1 = createOneLektionCurriculum(f.admin, f.org, "Bộ v1");
        curriculumService.publish(f.admin.getId(), f.org.getId(), v1);
        assignmentService.assign(f.admin.getId(), f.org.getId(), f.klass.getId(),
                new AssignCurriculumRequest(v1));
        Long generatedLessonId = classLessonService
                .listForTeacher(f.teacher.getId(), f.klass.getId()).get(0).id();

        // Bộ thứ hai đã công bố để thử đổi sang
        Long v2 = createOneLektionCurriculum(f.admin, f.org, "Bộ v2");
        curriculumService.publish(f.admin.getId(), f.org.getId(), v2);

        // Chưa có dấu vết → impact cho phép
        CurriculumAssignmentImpactDto before = assignmentService.impact(f.org.getId(), f.klass.getId(), v2);
        assertThat(before.canApply()).isTrue();

        // Ghi một nhật ký gắn bài sinh ra → thành dấu vết
        lessonLogRepo.save(ClassLessonLog.builder()
                .classId(f.klass.getId())
                .lessonId(generatedLessonId)
                .sessionDate(LocalDate.now().minusDays(1))
                .topic("Buổi 1")
                .createdBy(f.teacher.getId())
                .build());

        CurriculumAssignmentImpactDto after = assignmentService.impact(f.org.getId(), f.klass.getId(), v2);
        assertThat(after.canApply()).isFalse();
        assertThat(after.logCount()).isEqualTo(1);

        assertThatThrownBy(() -> assignmentService.assign(f.admin.getId(), f.org.getId(), f.klass.getId(),
                new AssignCurriculumRequest(v2)))
                .isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> assignmentService.unassign(f.org.getId(), f.klass.getId()))
                .isInstanceOf(ConflictException.class);

        // Xoá bộ đang được lớp dùng cũng bị chặn
        CurriculumVersionDetailDto v1Detail = curriculumService.getVersionDetail(f.org.getId(), v1);
        assertThatThrownBy(() -> curriculumService.delete(f.org.getId(), v1Detail.curriculumId()))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    @DisplayName("chưa có dấu vết: đổi phiên bản thay bài sạch sẽ, gỡ giáo trình dọn bài sinh ra")
    void relink_and_unassign_whenClean() {
        Fixture f = fixture();
        Long v1 = createOneLektionCurriculum(f.admin, f.org, "Bộ sạch v1");
        curriculumService.publish(f.admin.getId(), f.org.getId(), v1);
        assignmentService.assign(f.admin.getId(), f.org.getId(), f.klass.getId(),
                new AssignCurriculumRequest(v1));
        Long lektionIdFromV1 = classLessonService
                .listForTeacher(f.teacher.getId(), f.klass.getId()).get(0).lektionId();

        Long v2 = createOneLektionCurriculum(f.admin, f.org, "Bộ sạch v2");
        curriculumService.publish(f.admin.getId(), f.org.getId(), v2);

        assignmentService.assign(f.admin.getId(), f.org.getId(), f.klass.getId(),
                new AssignCurriculumRequest(v2));
        List<ClassLessonDto> afterSwap = classLessonService.listForTeacher(f.teacher.getId(), f.klass.getId());
        assertThat(afterSwap).hasSize(1);
        assertThat(afterSwap.get(0).lektionId()).isNotEqualTo(lektionIdFromV1); // bài của v2 thay bài của v1

        assignmentService.unassign(f.org.getId(), f.klass.getId());
        assertThat(classLessonService.listForTeacher(f.teacher.getId(), f.klass.getId())).isEmpty();
        assertThat(assignmentService.getLink(f.org.getId(), f.klass.getId())).isNull();
    }

    @Test
    @DisplayName("bộ mẫu A1: 3 Lektion tự soạn, publish + gán chạy trọn luồng; nhãn sample=true")
    void sampleA1_endToEnd() {
        Fixture f = fixture();
        OrgCurriculumSummaryDto sample = curriculumService.createSampleA1(f.admin.getId(), f.org.getId());
        assertThat(sample.sample()).isTrue();
        Long versionId = sample.versions().get(0).id();

        CurriculumVersionDetailDto detail = curriculumService.getVersionDetail(f.org.getId(), versionId);
        assertThat(detail.lektionen()).hasSize(3);
        assertThat(detail.lektionen().get(0).items()).isNotEmpty();
        assertThat(detail.lektionen().get(0).objectives()).isNotEmpty();

        curriculumService.publish(f.admin.getId(), f.org.getId(), versionId);
        assignmentService.assign(f.admin.getId(), f.org.getId(), f.klass.getId(),
                new AssignCurriculumRequest(versionId));

        List<ClassLessonDto> lessons = classLessonService.listForTeacher(f.teacher.getId(), f.klass.getId());
        assertThat(lessons).hasSize(3);
        assertThat(lessons).allSatisfy(l -> {
            assertThat(l.lektionId()).isNotNull();
            assertThat(l.knowledgePoints()).isNotEmpty();
            assertThat(l.canDoStatements()).isNotEmpty();
        });
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    private record Fixture(Organization org, User admin, User teacher, TeacherClass klass) {}

    private Fixture fixture() {
        Organization org = organizationRepo.save(Organization.builder()
                .name("TT Đức ngữ " + UUID.randomUUID().toString().substring(0, 8))
                .slug("org-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
        User admin = newUser(User.Role.TEACHER); // vai trò org (OWNER/MANAGER) kiểm ở controller — service nhận orgId đã guard
        User teacher = newUser(User.Role.TEACHER);
        TeacherClass klass = newClass(teacher.getId(), org.getId());
        classTeacherRepo.save(ClassTeacher.builder()
                .id(new ClassTeacherId(klass.getId(), teacher.getId()))
                .role("PRIMARY")
                .joinedAt(LocalDateTime.now())
                .build());
        return new Fixture(org, admin, teacher, klass);
    }

    private User newUser(User.Role role) {
        return userRepository.save(User.builder()
                .email("ocur-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Curriculum Tester")
                .role(role)
                .build());
    }

    private TeacherClass newClass(Long teacherId, Long orgId) {
        return classRepo.save(TeacherClass.builder()
                .teacherId(teacherId)
                .orgId(orgId)
                .name("A1.1 — " + UUID.randomUUID().toString().substring(0, 8))
                .inviteCode("INV-" + UUID.randomUUID())
                .createdAt(LocalDateTime.now())
                .build());
    }

    /** Bộ 1 Lektion ("Lektion 1 — Test", 2 mục + 1 mục tiêu) ở trạng thái DRAFT; trả về versionId. */
    private Long createOneLektionCurriculum(User admin, Organization org, String name) {
        OrgCurriculumSummaryDto curriculum = curriculumService.create(admin.getId(), org.getId(),
                new CreateCurriculumRequest(name, "A1", null));
        Long versionId = curriculum.versions().get(0).id();
        CurriculumLektionDto lektion = curriculumService.addLektion(org.getId(), versionId,
                new UpsertLektionRequest("Lektion 1 — Test", "Mô tả"));
        curriculumService.replaceItems(org.getId(), lektion.id(), new ReplaceItemsRequest(List.of(
                new CurriculumItemInput("Mục A — chào hỏi", "SPRECHEN", "REDEMITTEL", 120),
                new CurriculumItemInput("Mục B — số đếm", null, "WORTSCHATZ", 60))));
        curriculumService.replaceObjectives(org.getId(), lektion.id(), new ReplaceObjectivesRequest(List.of(
                new CurriculumObjectiveInput("Ich kann mich begrüßen.", "A1", "SPRECHEN"))));
        return versionId;
    }
}
