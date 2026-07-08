package com.deutschflow.material.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.material.dto.MaterialDto;
import com.deutschflow.material.entity.LessonMaterial;
import com.deutschflow.material.entity.Material;
import com.deutschflow.material.repository.ClassMaterialRepository;
import com.deutschflow.material.repository.MaterialRepository;
import com.deutschflow.teacher.entity.ClassLesson;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("MaterialService Unit Tests")
class MaterialServiceTest {

    @Mock private MaterialRepository materialRepository;
    @Mock private ClassMaterialRepository classMaterialRepository;
    @Mock private S3StorageService s3StorageService;
    @Mock private TeacherClassRepository teacherClassRepository;
    @Mock private OrgMemberRepository orgMemberRepository;
    @Mock private com.deutschflow.material.repository.LessonMaterialRepository lessonMaterialRepository;
    @Mock private com.deutschflow.teacher.repository.ClassLessonRepository lessonRepository;

    private MaterialService service;

    @BeforeEach
    void setUp() {
        service = new MaterialService(materialRepository, classMaterialRepository,
                s3StorageService, teacherClassRepository, orgMemberRepository,
                lessonMaterialRepository, lessonRepository);
    }

    private User user(long id, Long orgId) {
        User u = User.builder().id(id).build();
        u.setOrgId(orgId);
        return u;
    }

    private OrgMember member(long orgId, long userId, String role, String status) {
        OrgMember m = new OrgMember();
        m.setId(new OrgMemberId(orgId, userId));
        m.setRole(role);
        m.setStatus(status);
        return m;
    }

    private Material personalMaterial(long id, long teacherId) {
        return Material.builder().id(id).ownerScope("PERSONAL").teacherId(teacherId)
                .createdBy(teacherId).title("t").kind("PDF").objectKey("k").status("ACTIVE").build();
    }

    private Material orgMaterial(long id, long orgId, long createdBy) {
        return Material.builder().id(id).ownerScope("ORG").orgId(orgId)
                .createdBy(createdBy).title("t").kind("PDF").objectKey("k").status("ACTIVE").build();
    }

    private MockMultipartFile file(String name) {
        return new MockMultipartFile("file", name, "application/octet-stream", "data".getBytes());
    }

    // --------------------------------------------------------------- create

    @Test
    @DisplayName("create PERSONAL → owner_scope=PERSONAL, teacher_id=caller, org_id null")
    void create_personal() throws Exception {
        User caller = user(7L, null);
        when(s3StorageService.uploadFile(any(), eq("materials")))
                .thenReturn(new S3StorageService.S3UploadResult("materials/k.pdf", "http://x/k.pdf"));
        when(materialRepository.save(any())).thenAnswer(i -> { Material m = i.getArgument(0); m.setId(1L); return m; });
        when(s3StorageService.presignedGetUrl(eq("materials/k.pdf"), any())).thenReturn("http://x/k.pdf");

        MaterialDto dto = service.create(caller, "PERSONAL", file("a.pdf"), "Bài 1", "desc");

        ArgumentCaptor<Material> cap = ArgumentCaptor.forClass(Material.class);
        verify(materialRepository).save(cap.capture());
        assertThat(cap.getValue().getOwnerScope()).isEqualTo("PERSONAL");
        assertThat(cap.getValue().getTeacherId()).isEqualTo(7L);
        assertThat(cap.getValue().getOrgId()).isNull();
        assertThat(cap.getValue().getCreatedBy()).isEqualTo(7L);
        assertThat(cap.getValue().getKind()).isEqualTo("PDF");
        assertThat(dto.ownerScope()).isEqualTo("PERSONAL");
    }

    @Test
    @DisplayName("create ORG (active member) → owner_scope=ORG, org_id=caller.orgId, teacher_id null")
    void create_org_activeMember() throws Exception {
        User caller = user(7L, 10L);
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(10L, 7L))
                .thenReturn(Optional.of(member(10L, 7L, "TEACHER", "ACTIVE")));
        when(s3StorageService.uploadFile(any(), eq("materials")))
                .thenReturn(new S3StorageService.S3UploadResult("materials/k.pptx", "u"));
        when(materialRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(s3StorageService.presignedGetUrl(any(), any())).thenReturn("u");

        service.create(caller, "ORG", file("s.pptx"), "Slide", null);

        ArgumentCaptor<Material> cap = ArgumentCaptor.forClass(Material.class);
        verify(materialRepository).save(cap.capture());
        assertThat(cap.getValue().getOwnerScope()).isEqualTo("ORG");
        assertThat(cap.getValue().getOrgId()).isEqualTo(10L);
        assertThat(cap.getValue().getTeacherId()).isNull();
        assertThat(cap.getValue().getKind()).isEqualTo("PPTX");
    }

    @Test
    @DisplayName("create ORG without an org → Forbidden, nothing uploaded or saved")
    void create_org_noOrg_forbidden() {
        User caller = user(7L, null);

        assertThatThrownBy(() -> service.create(caller, "ORG", file("a.pdf"), "x", null))
                .isInstanceOf(ForbiddenException.class);
        verify(materialRepository, never()).save(any());
    }

    // --------------------------------------------------------------- list

    @Test
    @DisplayName("list = PERSONAL of caller ∪ ORG of caller's org (active member)")
    void list_unionPersonalAndOrg() {
        User caller = user(7L, 10L);
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(10L, 7L))
                .thenReturn(Optional.of(member(10L, 7L, "TEACHER", "ACTIVE")));
        when(materialRepository.findByOwnerScopeAndTeacherIdAndStatusOrderByCreatedAtDesc("PERSONAL", 7L, "ACTIVE"))
                .thenReturn(List.of(personalMaterial(1L, 7L)));
        when(materialRepository.findByOwnerScopeAndOrgIdAndStatusOrderByCreatedAtDesc("ORG", 10L, "ACTIVE"))
                .thenReturn(List.of(orgMaterial(2L, 10L, 7L)));
        when(s3StorageService.presignedGetUrl(any(), any())).thenReturn("u");

        List<MaterialDto> out = service.list(caller);

        assertThat(out).extracting(MaterialDto::id).containsExactly(1L, 2L);
    }

    // --------------------------------------------------------------- access (get)

    @Test
    @DisplayName("get PERSONAL by a non-owner → Forbidden")
    void get_personal_nonOwner_forbidden() {
        User caller = user(99L, null);
        when(materialRepository.findById(1L)).thenReturn(Optional.of(personalMaterial(1L, 7L)));

        assertThatThrownBy(() -> service.get(caller, 1L)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("get ORG from a DIFFERENT org → Forbidden (cross-tenant)")
    void get_org_differentOrg_forbidden() {
        User caller = user(8L, 20L);
        when(materialRepository.findById(1L)).thenReturn(Optional.of(orgMaterial(1L, 10L, 7L)));

        assertThatThrownBy(() -> service.get(caller, 1L)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("get ORG as an ACTIVE member of the same org → ok")
    void get_org_activeMember_ok() {
        User caller = user(8L, 10L);
        when(materialRepository.findById(1L)).thenReturn(Optional.of(orgMaterial(1L, 10L, 7L)));
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(10L, 8L))
                .thenReturn(Optional.of(member(10L, 8L, "TEACHER", "ACTIVE")));
        when(s3StorageService.presignedGetUrl(any(), any())).thenReturn("u");

        assertThat(service.get(caller, 1L).id()).isEqualTo(1L);
    }

    @Test
    @DisplayName("get ORG when membership is LEFT → Forbidden (access tied to ACTIVE membership, not created_by)")
    void get_org_leftMember_forbidden() {
        User caller = user(7L, 10L);
        // caller AUTHORED the material but has since LEFT the org → must lose access.
        when(materialRepository.findById(1L)).thenReturn(Optional.of(orgMaterial(1L, 10L, 7L)));
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(10L, 7L))
                .thenReturn(Optional.of(member(10L, 7L, "TEACHER", "LEFT")));

        assertThatThrownBy(() -> service.get(caller, 1L)).isInstanceOf(ForbiddenException.class);
    }

    // --------------------------------------------------------------- archive

    @Test
    @DisplayName("archive ORG by the author → ARCHIVED")
    void archive_org_byAuthor_ok() {
        User caller = user(7L, 10L);
        Material m = orgMaterial(1L, 10L, 7L);
        when(materialRepository.findById(1L)).thenReturn(Optional.of(m));
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(10L, 7L))
                .thenReturn(Optional.of(member(10L, 7L, "TEACHER", "ACTIVE")));
        when(materialRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(s3StorageService.presignedGetUrl(any(), any())).thenReturn("u");

        service.archive(caller, 1L);

        assertThat(m.getStatus()).isEqualTo("ARCHIVED");
    }

    @Test
    @DisplayName("archive ORG by another teacher (not author, not admin) → Forbidden")
    void archive_org_byOtherTeacher_forbidden() {
        User caller = user(9L, 10L);
        when(materialRepository.findById(1L)).thenReturn(Optional.of(orgMaterial(1L, 10L, 7L)));
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(10L, 9L))
                .thenReturn(Optional.of(member(10L, 9L, "TEACHER", "ACTIVE")));

        assertThatThrownBy(() -> service.archive(caller, 1L)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("archive ORG by a MANAGER (not author) → ARCHIVED")
    void archive_org_byManager_ok() {
        User caller = user(9L, 10L);
        Material m = orgMaterial(1L, 10L, 7L);
        when(materialRepository.findById(1L)).thenReturn(Optional.of(m));
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(10L, 9L))
                .thenReturn(Optional.of(member(10L, 9L, "MANAGER", "ACTIVE")));
        when(materialRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(s3StorageService.presignedGetUrl(any(), any())).thenReturn("u");

        service.archive(caller, 1L);

        assertThat(m.getStatus()).isEqualTo("ARCHIVED");
    }

    // --------------------------------------------------------------- attach

    @Test
    @DisplayName("attach an ORG material to a DIFFERENT org's class → Forbidden (no cross-org leak)")
    void attach_orgMaterial_toOtherOrgClass_forbidden() {
        User caller = user(7L, 10L);
        when(materialRepository.findById(1L)).thenReturn(Optional.of(orgMaterial(1L, 10L, 7L)));
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(10L, 7L))
                .thenReturn(Optional.of(member(10L, 7L, "MANAGER", "ACTIVE")));
        TeacherClass tc = TeacherClass.builder().id(5L).teacherId(7L).orgId(99L).build();
        when(teacherClassRepository.findById(5L)).thenReturn(Optional.of(tc));

        assertThatThrownBy(() -> service.attachToClass(caller, 1L, 5L))
                .isInstanceOf(ForbiddenException.class);
        verify(classMaterialRepository, never()).save(any());
    }

    // --------------------------------------------------------------- lesson attach (Phase 1d-D2)

    private ClassLesson lesson(long id, long classId) {
        return ClassLesson.builder().id(id).classId(classId).orderIndex(0).title("Lektion").build();
    }

    @Test
    @DisplayName("attach an ORG material to a lesson of a DIFFERENT org's class → Forbidden (no cross-org leak)")
    void attachToLesson_orgMaterial_otherOrg_forbidden() {
        User caller = user(7L, 10L);
        when(materialRepository.findById(1L)).thenReturn(Optional.of(orgMaterial(1L, 10L, 7L)));
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(10L, 7L))
                .thenReturn(Optional.of(member(10L, 7L, "MANAGER", "ACTIVE")));
        when(lessonRepository.findById(50L)).thenReturn(Optional.of(lesson(50L, 5L)));
        when(teacherClassRepository.findById(5L))
                .thenReturn(Optional.of(TeacherClass.builder().id(5L).teacherId(7L).orgId(99L).build()));

        assertThatThrownBy(() -> service.attachToLesson(caller, 1L, 50L))
                .isInstanceOf(ForbiddenException.class);
        verify(lessonMaterialRepository, never()).save(any());
    }

    @Test
    @DisplayName("attach a PERSONAL material to a lesson of the caller's own class → persists with order_index max+1")
    void attachToLesson_personalMaterial_ownClass_persists() {
        User caller = user(7L, null);
        when(materialRepository.findById(1L)).thenReturn(Optional.of(personalMaterial(1L, 7L)));
        when(lessonRepository.findById(50L)).thenReturn(Optional.of(lesson(50L, 5L)));
        when(teacherClassRepository.findById(5L))
                .thenReturn(Optional.of(TeacherClass.builder().id(5L).teacherId(7L).build()));
        when(lessonMaterialRepository.existsByIdLessonIdAndIdMaterialId(50L, 1L)).thenReturn(false);
        when(lessonMaterialRepository.findMaxOrderIndex(50L)).thenReturn(2);

        service.attachToLesson(caller, 1L, 50L);

        ArgumentCaptor<LessonMaterial> cap = ArgumentCaptor.forClass(LessonMaterial.class);
        verify(lessonMaterialRepository).save(cap.capture());
        assertThat(cap.getValue().getId().getLessonId()).isEqualTo(50L);
        assertThat(cap.getValue().getId().getMaterialId()).isEqualTo(1L);
        assertThat(cap.getValue().getOrderIndex()).isEqualTo(3);
    }

    @Test
    @DisplayName("attach to a lesson of a class the caller does not teach → Forbidden")
    void attachToLesson_notOwnedClass_forbidden() {
        User caller = user(7L, null);
        when(materialRepository.findById(1L)).thenReturn(Optional.of(personalMaterial(1L, 7L)));
        when(lessonRepository.findById(50L)).thenReturn(Optional.of(lesson(50L, 5L)));
        when(teacherClassRepository.findById(5L))
                .thenReturn(Optional.of(TeacherClass.builder().id(5L).teacherId(999L).build()));

        assertThatThrownBy(() -> service.attachToLesson(caller, 1L, 50L))
                .isInstanceOf(ForbiddenException.class);
        verify(lessonMaterialRepository, never()).save(any());
    }

    @Test
    @DisplayName("listForLesson drops ARCHIVED materials and preserves order_index order")
    void listForLesson_filtersArchived_preservesOrder() {
        User caller = user(7L, null);
        when(lessonRepository.findById(50L)).thenReturn(Optional.of(lesson(50L, 5L)));
        when(teacherClassRepository.findById(5L))
                .thenReturn(Optional.of(TeacherClass.builder().id(5L).teacherId(7L).build()));
        // Attach order: material 2 then material 1.
        LessonMaterial lm2 = LessonMaterial.builder()
                .id(new com.deutschflow.material.entity.LessonMaterialId(50L, 2L)).orderIndex(0).attachedBy(7L).build();
        LessonMaterial lm1 = LessonMaterial.builder()
                .id(new com.deutschflow.material.entity.LessonMaterialId(50L, 1L)).orderIndex(1).attachedBy(7L).build();
        when(lessonMaterialRepository.findByIdLessonIdOrderByOrderIndexAsc(50L)).thenReturn(List.of(lm2, lm1));
        Material active = personalMaterial(2L, 7L);
        Material archived = personalMaterial(1L, 7L);
        archived.setStatus("ARCHIVED");
        when(materialRepository.findAllById(List.of(2L, 1L))).thenReturn(List.of(active, archived));
        when(s3StorageService.presignedGetUrl(any(), any())).thenReturn("u");

        List<MaterialDto> out = service.listForLesson(caller, 50L);

        assertThat(out).extracting(MaterialDto::id).containsExactly(2L); // archived #1 dropped, order kept
    }

    // --------------------------------------------------------------- upload guards

    @Test
    @DisplayName("create rejects a browser-executable content-type (stored-XSS guard)")
    void create_blockedMime_throwsBadRequest() {
        User caller = user(7L, null);
        MockMultipartFile html = new MockMultipartFile("file", "x.html", "text/html", "<script>".getBytes());

        assertThatThrownBy(() -> service.create(caller, "PERSONAL", html, "Evil", null))
                .isInstanceOf(BadRequestException.class);
        verify(materialRepository, never()).save(any());
    }

    @Test
    @DisplayName("get 404s an ARCHIVED material even for the owner (consistent with list)")
    void get_archived_throwsNotFound() {
        User caller = user(7L, null);
        Material m = personalMaterial(1L, 7L);
        m.setStatus("ARCHIVED");
        when(materialRepository.findById(1L)).thenReturn(Optional.of(m));

        assertThatThrownBy(() -> service.get(caller, 1L)).isInstanceOf(NotFoundException.class);
    }
}
