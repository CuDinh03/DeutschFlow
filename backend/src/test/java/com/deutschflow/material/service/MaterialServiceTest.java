package com.deutschflow.material.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.material.dto.MaterialDto;
import com.deutschflow.material.dto.PresignUploadResponse;
import com.deutschflow.material.entity.LessonMaterial;
import com.deutschflow.material.entity.Material;
import com.deutschflow.material.entity.MaterialFolder;
import com.deutschflow.material.repository.ClassMaterialRepository;
import com.deutschflow.material.repository.MaterialFolderRepository;
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
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("MaterialService Unit Tests")
class MaterialServiceTest {

    @Mock private MaterialRepository materialRepository;
    @Mock private MaterialFolderRepository folderRepository;
    @Mock private ClassMaterialRepository classMaterialRepository;
    @Mock private S3StorageService s3StorageService;
    @Mock private MaterialPreviewService materialPreviewService;
    @Mock private TeacherClassRepository teacherClassRepository;
    @Mock private OrgMemberRepository orgMemberRepository;
    @Mock private com.deutschflow.material.repository.LessonMaterialRepository lessonMaterialRepository;
    @Mock private com.deutschflow.teacher.repository.ClassLessonRepository lessonRepository;
    @Mock private com.deutschflow.teacher.repository.ClassStudentRepository classStudentRepository;
    @Mock private com.deutschflow.material.repository.AssignmentMaterialRepository assignmentMaterialRepository;
    @Mock private com.deutschflow.teacher.repository.ClassAssignmentRepository classAssignmentRepository;
    @Mock private com.deutschflow.teacher.repository.StudentAssignmentRepository studentAssignmentRepository;

    private MaterialService service;

    @BeforeEach
    void setUp() {
        service = new MaterialService(materialRepository, folderRepository, classMaterialRepository,
                s3StorageService, materialPreviewService, teacherClassRepository, orgMemberRepository,
                lessonMaterialRepository, lessonRepository, classStudentRepository,
                assignmentMaterialRepository, classAssignmentRepository, studentAssignmentRepository);
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
        when(s3StorageService.uploadFile(any(), any()))
                .thenReturn(new S3StorageService.S3UploadResult("materials/k.pdf", "http://x/k.pdf"));
        when(materialRepository.save(any())).thenAnswer(i -> { Material m = i.getArgument(0); m.setId(1L); return m; });
        when(s3StorageService.presignedGetUrl(eq("materials/k.pdf"), any())).thenReturn("http://x/k.pdf");

        MaterialDto dto = service.create(caller, "PERSONAL", file("a.pdf"), "Bài 1", "desc", null, null);

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
        when(s3StorageService.uploadFile(any(), any()))
                .thenReturn(new S3StorageService.S3UploadResult("materials/k.pptx", "u"));
        when(materialRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(s3StorageService.presignedGetUrl(any(), any())).thenReturn("u");

        service.create(caller, "ORG", file("s.pptx"), "Slide", null, null, null);

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

        assertThatThrownBy(() -> service.create(caller, "ORG", file("a.pdf"), "x", null, null, null))
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

    private com.deutschflow.teacher.entity.ClassAssignment assignment(long id, long classId) {
        return com.deutschflow.teacher.entity.ClassAssignment.builder().id(id).classId(classId).topic("Bài").build();
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

    // --------------------------------------------------------------- assignment attach

    @Test
    @DisplayName("attach a PERSONAL material to an assignment of the caller's own class → persists with order_index max+1")
    void attachToAssignment_personalMaterial_ownClass_persists() {
        User caller = user(7L, null);
        when(materialRepository.findById(1L)).thenReturn(Optional.of(personalMaterial(1L, 7L)));
        when(classAssignmentRepository.findById(90L)).thenReturn(Optional.of(assignment(90L, 5L)));
        when(teacherClassRepository.findById(5L))
                .thenReturn(Optional.of(TeacherClass.builder().id(5L).teacherId(7L).build()));
        when(assignmentMaterialRepository.existsByIdAssignmentIdAndIdMaterialId(90L, 1L)).thenReturn(false);
        when(assignmentMaterialRepository.findMaxOrderIndex(90L)).thenReturn(1);

        service.attachToAssignment(caller, 1L, 90L);

        ArgumentCaptor<com.deutschflow.material.entity.AssignmentMaterial> cap =
                ArgumentCaptor.forClass(com.deutschflow.material.entity.AssignmentMaterial.class);
        verify(assignmentMaterialRepository).save(cap.capture());
        assertThat(cap.getValue().getId().getAssignmentId()).isEqualTo(90L);
        assertThat(cap.getValue().getId().getMaterialId()).isEqualTo(1L);
        assertThat(cap.getValue().getOrderIndex()).isEqualTo(2);
    }

    @Test
    @DisplayName("attach to an assignment of a class the caller does not teach → Forbidden")
    void attachToAssignment_notOwnedClass_forbidden() {
        User caller = user(7L, null);
        when(materialRepository.findById(1L)).thenReturn(Optional.of(personalMaterial(1L, 7L)));
        when(classAssignmentRepository.findById(90L)).thenReturn(Optional.of(assignment(90L, 5L)));
        when(teacherClassRepository.findById(5L))
                .thenReturn(Optional.of(TeacherClass.builder().id(5L).teacherId(999L).build()));

        assertThatThrownBy(() -> service.attachToAssignment(caller, 1L, 90L))
                .isInstanceOf(ForbiddenException.class);
        verify(assignmentMaterialRepository, never()).save(any());
    }

    @Test
    @DisplayName("attach an ORG material to an assignment of a DIFFERENT org's class → Forbidden (no cross-org leak)")
    void attachToAssignment_orgMaterial_otherOrg_forbidden() {
        User caller = user(7L, 10L);
        when(materialRepository.findById(1L)).thenReturn(Optional.of(orgMaterial(1L, 10L, 7L)));
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(10L, 7L))
                .thenReturn(Optional.of(member(10L, 7L, "MANAGER", "ACTIVE")));
        when(classAssignmentRepository.findById(90L)).thenReturn(Optional.of(assignment(90L, 5L)));
        when(teacherClassRepository.findById(5L))
                .thenReturn(Optional.of(TeacherClass.builder().id(5L).teacherId(7L).orgId(99L).build()));

        assertThatThrownBy(() -> service.attachToAssignment(caller, 1L, 90L))
                .isInstanceOf(ForbiddenException.class);
        verify(assignmentMaterialRepository, never()).save(any());
    }

    @Test
    @DisplayName("student who was NOT given the assignment cannot read its materials → Forbidden")
    void listAssignmentMaterialsForStudent_notAssigned_forbidden() {
        when(studentAssignmentRepository.findByStudentIdAndAssignmentId(42L, 90L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.listAssignmentMaterialsForStudent(42L, 90L))
                .isInstanceOf(ForbiddenException.class);
        verify(assignmentMaterialRepository, never()).findByIdAssignmentIdOrderByOrderIndexAsc(any());
    }

    @Test
    @DisplayName("student given the assignment reads its ACTIVE materials in attach order")
    void listAssignmentMaterialsForStudent_assigned_returnsActive() {
        when(studentAssignmentRepository.findByStudentIdAndAssignmentId(42L, 90L))
                .thenReturn(Optional.of(new com.deutschflow.teacher.entity.StudentAssignment()));
        com.deutschflow.material.entity.AssignmentMaterial am = com.deutschflow.material.entity.AssignmentMaterial.builder()
                .id(new com.deutschflow.material.entity.AssignmentMaterialId(90L, 2L)).orderIndex(0).attachedBy(7L).build();
        when(assignmentMaterialRepository.findByIdAssignmentIdOrderByOrderIndexAsc(90L)).thenReturn(List.of(am));
        when(materialRepository.findAllById(List.of(2L))).thenReturn(List.of(personalMaterial(2L, 7L)));
        when(s3StorageService.presignedGetUrl(any(), any())).thenReturn("u");

        List<MaterialDto> out = service.listAssignmentMaterialsForStudent(42L, 90L);

        assertThat(out).extracting(MaterialDto::id).containsExactly(2L);
    }

    @Test
    @DisplayName("refresh URL for a material NOT attached to the assignment → NotFound (attach link is the capability)")
    void refreshAssignmentMaterialUrlForStudent_notAttached_notFound() {
        when(studentAssignmentRepository.findByStudentIdAndAssignmentId(42L, 90L))
                .thenReturn(Optional.of(new com.deutschflow.teacher.entity.StudentAssignment()));
        when(assignmentMaterialRepository.existsByIdAssignmentIdAndIdMaterialId(90L, 5L)).thenReturn(false);

        assertThatThrownBy(() -> service.refreshAssignmentMaterialUrlForStudent(42L, 90L, 5L))
                .isInstanceOf(NotFoundException.class);
    }

    // --------------------------------------------------------------- upload guards

    @Test
    @DisplayName("create rejects a browser-executable content-type (stored-XSS guard)")
    void create_blockedMime_throwsBadRequest() {
        User caller = user(7L, null);
        MockMultipartFile html = new MockMultipartFile("file", "x.html", "text/html", "<script>".getBytes());

        assertThatThrownBy(() -> service.create(caller, "PERSONAL", html, "Evil", null, null, null))
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

    // --------------------------------------------------------------- link / presign / complete (Materials Library)

    @Test
    @DisplayName("createLink persists kind=LINK with external_url and NO S3 object; url falls back to the link")
    void createLink_validUrl_persistsLinkNoObject() {
        User caller = user(7L, null);
        when(materialRepository.save(any())).thenAnswer(i -> { Material m = i.getArgument(0); m.setId(1L); return m; });

        MaterialDto dto = service.createLink(caller, "PERSONAL",
                "https://allango.net/x", "Netzwerk A1 · Track 2.11", null, null, List.of("Hören", " A1 ", "Hören"));

        ArgumentCaptor<Material> cap = ArgumentCaptor.forClass(Material.class);
        verify(materialRepository).save(cap.capture());
        assertThat(cap.getValue().getKind()).isEqualTo("LINK");
        assertThat(cap.getValue().getObjectKey()).isNull();
        assertThat(cap.getValue().getExternalUrl()).isEqualTo("https://allango.net/x");
        assertThat(cap.getValue().getTags()).containsExactly("Hören", "A1"); // " A1 " trimmed, dup "Hören" dropped
        assertThat(dto.url()).isEqualTo("https://allango.net/x");
        verify(s3StorageService, never()).presignedGetUrl(any(), any());
    }

    @Test
    @DisplayName("createLink rejects a non-http(s) URL (javascript: scheme)")
    void createLink_nonHttpUrl_throwsBadRequest() {
        User caller = user(7L, null);

        assertThatThrownBy(() -> service.createLink(caller, "PERSONAL",
                "javascript:alert(1)", "Evil", null, null, null))
                .isInstanceOf(BadRequestException.class);
        verify(materialRepository, never()).save(any());
    }

    @Test
    @DisplayName("presignUpload reserves an UPLOADING record (kind AUDIO from ext, owner-prefixed key) and returns PUT url")
    void presignUpload_createsUploadingRecord() {
        User caller = user(7L, null);
        when(materialRepository.save(any())).thenAnswer(i -> { Material m = i.getArgument(0); m.setId(1L); return m; });
        when(s3StorageService.generatePresignedUrl(any(), eq("audio/mpeg"))).thenReturn("https://s3/put");

        PresignUploadResponse res = service.presignUpload(caller, "PERSONAL",
                "lektion3.mp3", "audio/mpeg", 60L * 1024 * 1024, "Hörtext", null, null, null);

        ArgumentCaptor<Material> cap = ArgumentCaptor.forClass(Material.class);
        verify(materialRepository).save(cap.capture());
        assertThat(cap.getValue().getStatus()).isEqualTo("UPLOADING");
        assertThat(cap.getValue().getKind()).isEqualTo("AUDIO");
        assertThat(cap.getValue().getObjectKey()).startsWith("materials/p-7/");
        assertThat(res.materialId()).isEqualTo(1L);
        assertThat(res.uploadUrl()).isEqualTo("https://s3/put");
    }

    @Test
    @DisplayName("presignUpload rejects a declared size over the 500MB hard cap (nothing saved)")
    void presignUpload_overHardCap_throwsBadRequest() {
        User caller = user(7L, null);

        assertThatThrownBy(() -> service.presignUpload(caller, "PERSONAL",
                "big.mp4", "video/mp4", 501L * 1024 * 1024, "Big", null, null, null))
                .isInstanceOf(BadRequestException.class);
        verify(materialRepository, never()).save(any());
    }

    @Test
    @DisplayName("complete verifies the S3 object, uses the REAL HEAD size, clamps duration, flips ACTIVE")
    void complete_objectPresent_flipsActive() {
        User caller = user(7L, null);
        Material m = Material.builder().id(1L).ownerScope("PERSONAL").teacherId(7L).createdBy(7L)
                .title("t").kind("AUDIO").objectKey("materials/p-7/2026/07/x.mp3").status("UPLOADING")
                .sizeBytes(60L * 1024 * 1024).build(); // provisional client-declared size
        when(materialRepository.findById(1L)).thenReturn(Optional.of(m));
        when(s3StorageService.objectExists("materials/p-7/2026/07/x.mp3")).thenReturn(true);
        when(s3StorageService.headObject("materials/p-7/2026/07/x.mp3"))
                .thenReturn(new S3StorageService.S3ObjectMetadata(1234L, "audio/mpeg"));
        when(materialRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(s3StorageService.presignedGetUrl(any(), any())).thenReturn("u");

        service.complete(caller, 1L, 999999); // duration beyond 24h → clamp

        assertThat(m.getStatus()).isEqualTo("ACTIVE");
        assertThat(m.getSizeBytes()).isEqualTo(1234L);           // authoritative HEAD size, not the declared 60MB
        assertThat(m.getDurationSeconds()).isEqualTo(86400);     // clamped to MAX_DURATION_SECONDS
    }

    @Test
    @DisplayName("complete deletes the object and throws when the REAL size exceeds 500MB (stays UPLOADING)")
    void complete_overCap_deletesAndThrows() {
        User caller = user(7L, null);
        Material m = Material.builder().id(1L).ownerScope("PERSONAL").teacherId(7L).createdBy(7L)
                .title("t").kind("VIDEO").objectKey("materials/p-7/2026/07/x.mp4").status("UPLOADING").build();
        when(materialRepository.findById(1L)).thenReturn(Optional.of(m));
        when(s3StorageService.objectExists("materials/p-7/2026/07/x.mp4")).thenReturn(true);
        when(s3StorageService.headObject("materials/p-7/2026/07/x.mp4"))
                .thenReturn(new S3StorageService.S3ObjectMetadata(600L * 1024 * 1024, "video/mp4"));

        assertThatThrownBy(() -> service.complete(caller, 1L, null))
                .isInstanceOf(BadRequestException.class);
        verify(s3StorageService).deleteFile("materials/p-7/2026/07/x.mp4");
        assertThat(m.getStatus()).isEqualTo("UPLOADING"); // not flipped
    }

    @Test
    @DisplayName("complete on a material that is not UPLOADING → BadRequest")
    void complete_notUploading_throwsBadRequest() {
        User caller = user(7L, null);
        when(materialRepository.findById(1L)).thenReturn(Optional.of(personalMaterial(1L, 7L))); // ACTIVE

        assertThatThrownBy(() -> service.complete(caller, 1L, null))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("create rejects a multipart file over 25MB with a friendly BadRequest (nothing uploaded)")
    void create_over25MB_throwsBadRequest() {
        User caller = user(7L, null);
        MockMultipartFile big = new MockMultipartFile("file", "big.pdf", "application/pdf",
                new byte[26 * 1024 * 1024]);

        assertThatThrownBy(() -> service.create(caller, "PERSONAL", big, "Big", null, null, null))
                .isInstanceOf(BadRequestException.class);
        verify(materialRepository, never()).save(any());
    }

    // --------------------------------------------------------------- folder filing (assertFolderAssignable)

    private MaterialFolder personalFolder(long id, long teacherId) {
        return MaterialFolder.builder().id(id).ownerScope("PERSONAL").teacherId(teacherId)
                .createdBy(teacherId).name("Netzwerk A1").orderIndex(0).build();
    }

    private MaterialFolder orgFolder(long id, long orgId, long createdBy) {
        return MaterialFolder.builder().id(id).ownerScope("ORG").orgId(orgId)
                .createdBy(createdBy).name("Trung tâm A1").orderIndex(0).build();
    }

    @Test
    @DisplayName("createLink into the caller's OWN personal folder → persists with that folderId")
    void createLink_ownFolder_persistsFolderId() {
        User caller = user(7L, null);
        when(folderRepository.findById(3L)).thenReturn(Optional.of(personalFolder(3L, 7L)));
        when(materialRepository.save(any())).thenAnswer(i -> { Material m = i.getArgument(0); m.setId(1L); return m; });

        service.createLink(caller, "PERSONAL", "https://x.de/a", "t", null, 3L, null);

        ArgumentCaptor<Material> cap = ArgumentCaptor.forClass(Material.class);
        verify(materialRepository).save(cap.capture());
        assertThat(cap.getValue().getFolderId()).isEqualTo(3L);
    }

    @Test
    @DisplayName("filing into a folder owned by ANOTHER teacher → Forbidden (cross-owner), nothing saved")
    void createLink_otherOwnerFolder_forbidden() {
        User caller = user(7L, null);
        when(folderRepository.findById(3L)).thenReturn(Optional.of(personalFolder(3L, 999L)));

        assertThatThrownBy(() -> service.createLink(caller, "PERSONAL", "https://x.de/a", "t", null, 3L, null))
                .isInstanceOf(ForbiddenException.class);
        verify(materialRepository, never()).save(any());
    }

    @Test
    @DisplayName("filing a PERSONAL material into an accessible ORG folder → BadRequest (owner-scope mismatch)")
    void createLink_personalMaterialIntoOrgFolder_badRequest() {
        User caller = user(7L, 10L);
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(10L, 7L))
                .thenReturn(Optional.of(member(10L, 7L, "TEACHER", "ACTIVE")));
        when(folderRepository.findById(3L)).thenReturn(Optional.of(orgFolder(3L, 10L, 7L)));

        assertThatThrownBy(() -> service.createLink(caller, "PERSONAL", "https://x.de/a", "t", null, 3L, null))
                .isInstanceOf(BadRequestException.class);
        verify(materialRepository, never()).save(any());
    }

    // --------------------------------------------------------------- patch

    @Test
    @DisplayName("patch by a non-owner (PERSONAL) → Forbidden, nothing saved")
    void patch_nonOwner_forbidden() {
        User caller = user(99L, null);
        when(materialRepository.findById(1L)).thenReturn(Optional.of(personalMaterial(1L, 7L)));

        assertThatThrownBy(() -> service.patch(caller, 1L, "New", null, null, false))
                .isInstanceOf(ForbiddenException.class);
        verify(materialRepository, never()).save(any());
    }

    @Test
    @DisplayName("patch updates title (trimmed) + tags for the owner")
    void patch_ownerUpdatesTitleAndTags() {
        User caller = user(7L, null);
        Material m = personalMaterial(1L, 7L);
        when(materialRepository.findById(1L)).thenReturn(Optional.of(m));
        when(materialRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(s3StorageService.presignedGetUrl(any(), any())).thenReturn("u");

        service.patch(caller, 1L, "  Tiêu đề mới  ", List.of("Lesen"), null, false);

        assertThat(m.getTitle()).isEqualTo("Tiêu đề mới");
        assertThat(m.getTags()).containsExactly("Lesen");
    }

    @Test
    @DisplayName("patch moving into a folder owned by another teacher → Forbidden")
    void patch_moveIntoForeignFolder_forbidden() {
        User caller = user(7L, null);
        when(materialRepository.findById(1L)).thenReturn(Optional.of(personalMaterial(1L, 7L)));
        when(folderRepository.findById(3L)).thenReturn(Optional.of(personalFolder(3L, 999L)));

        assertThatThrownBy(() -> service.patch(caller, 1L, null, null, 3L, false))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("patch with clearFolder=true unfiles the material (folderId → null), skipping folder lookup")
    void patch_clearFolder_unfiles() {
        User caller = user(7L, null);
        Material m = personalMaterial(1L, 7L);
        m.setFolderId(5L);
        when(materialRepository.findById(1L)).thenReturn(Optional.of(m));
        when(materialRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(s3StorageService.presignedGetUrl(any(), any())).thenReturn("u");

        service.patch(caller, 1L, null, null, null, true);

        assertThat(m.getFolderId()).isNull();
        verify(folderRepository, never()).findById(any());
    }

    // --------------------------------------------------------------- refreshUrl

    @Test
    @DisplayName("refreshUrl for a file material re-signs a presigned GET")
    void refreshUrl_file_returnsPresigned() {
        User caller = user(7L, null);
        when(materialRepository.findById(1L)).thenReturn(Optional.of(personalMaterial(1L, 7L)));
        when(s3StorageService.presignedGetUrl(eq("k"), any())).thenReturn("https://s3/fresh");

        assertThat(service.refreshUrl(caller, 1L)).isEqualTo("https://s3/fresh");
    }

    @Test
    @DisplayName("refreshUrl for a LINK returns the external URL (no presign)")
    void refreshUrl_link_returnsExternal() {
        User caller = user(7L, null);
        Material link = Material.builder().id(1L).ownerScope("PERSONAL").teacherId(7L).createdBy(7L)
                .title("t").kind("LINK").externalUrl("https://allango.net/x").status("ACTIVE").build();
        when(materialRepository.findById(1L)).thenReturn(Optional.of(link));

        assertThat(service.refreshUrl(caller, 1L)).isEqualTo("https://allango.net/x");
        verify(s3StorageService, never()).presignedGetUrl(any(), any());
    }

    @Test
    @DisplayName("refreshUrl by a non-owner → Forbidden (the URL-minting endpoint is access-gated)")
    void refreshUrl_nonOwner_forbidden() {
        User caller = user(99L, null);
        when(materialRepository.findById(1L)).thenReturn(Optional.of(personalMaterial(1L, 7L)));

        assertThatThrownBy(() -> service.refreshUrl(caller, 1L)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("refreshUrl for an ARCHIVED material → NotFound")
    void refreshUrl_archived_notFound() {
        User caller = user(7L, null);
        Material m = personalMaterial(1L, 7L);
        m.setStatus("ARCHIVED");
        when(materialRepository.findById(1L)).thenReturn(Optional.of(m));

        assertThatThrownBy(() -> service.refreshUrl(caller, 1L)).isInstanceOf(NotFoundException.class);
    }

    // --------------------------------------------------------------- complete guards

    @Test
    @DisplayName("complete deletes + rejects when the real Content-Type is blocked, incl. a parameterized text/html")
    void complete_blockedParameterizedMime_deletesAndThrows() {
        User caller = user(7L, null);
        Material m = Material.builder().id(1L).ownerScope("PERSONAL").teacherId(7L).createdBy(7L)
                .title("t").kind("OTHER").objectKey("materials/p-7/2026/07/x.bin").status("UPLOADING").build();
        when(materialRepository.findById(1L)).thenReturn(Optional.of(m));
        when(s3StorageService.objectExists("materials/p-7/2026/07/x.bin")).thenReturn(true);
        when(s3StorageService.headObject("materials/p-7/2026/07/x.bin"))
                .thenReturn(new S3StorageService.S3ObjectMetadata(10L, "text/html; charset=utf-8"));

        assertThatThrownBy(() -> service.complete(caller, 1L, null))
                .isInstanceOf(BadRequestException.class);
        verify(s3StorageService).deleteFile("materials/p-7/2026/07/x.bin");
        assertThat(m.getStatus()).isEqualTo("UPLOADING"); // not flipped
    }

    @Test
    @DisplayName("complete when the object was never PUT → BadRequest, stays UPLOADING, no HEAD")
    void complete_objectMissing_throwsBadRequest() {
        User caller = user(7L, null);
        Material m = Material.builder().id(1L).ownerScope("PERSONAL").teacherId(7L).createdBy(7L)
                .title("t").kind("AUDIO").objectKey("materials/p-7/2026/07/x.mp3").status("UPLOADING").build();
        when(materialRepository.findById(1L)).thenReturn(Optional.of(m));
        when(s3StorageService.objectExists("materials/p-7/2026/07/x.mp3")).thenReturn(false);

        assertThatThrownBy(() -> service.complete(caller, 1L, null))
                .isInstanceOf(BadRequestException.class);
        assertThat(m.getStatus()).isEqualTo("UPLOADING");
        verify(s3StorageService, never()).headObject(any());
    }

    // --------------------------------------------------------------- filter normalization + MIME guard

    @Test
    @DisplayName("list upper-cases a lower-case kind filter before querying (kind is stored upper-case)")
    void list_kindFilter_upperCasedBeforeQuery() {
        User caller = user(7L, null);
        when(materialRepository.searchPersonal(eq(7L), eq("ACTIVE"), isNull(), eq("PDF"), isNull(), isNull()))
                .thenReturn(List.of(personalMaterial(1L, 7L)));
        when(s3StorageService.presignedGetUrl(any(), any())).thenReturn("u");

        List<MaterialDto> out = service.list(caller, null, "pdf", null, null);

        assertThat(out).extracting(MaterialDto::id).containsExactly(1L);
        verify(materialRepository).searchPersonal(eq(7L), eq("ACTIVE"), isNull(), eq("PDF"), isNull(), isNull());
    }

    @Test
    @DisplayName("create rejects a PARAMETERIZED executable content-type (text/html; charset=utf-8)")
    void create_parameterizedBlockedMime_throwsBadRequest() {
        User caller = user(7L, null);
        MockMultipartFile html = new MockMultipartFile("file", "x.html",
                "text/html; charset=utf-8", "<script>".getBytes());

        assertThatThrownBy(() -> service.create(caller, "PERSONAL", html, "Evil", null, null, null))
                .isInstanceOf(BadRequestException.class);
        verify(materialRepository, never()).save(any());
    }

    // --------------------------------------------------------------- student read access (wave 3)

    private com.deutschflow.material.entity.LessonMaterial lm(long lessonId, long materialId, int order) {
        return com.deutschflow.material.entity.LessonMaterial.builder()
                .id(new com.deutschflow.material.entity.LessonMaterialId(lessonId, materialId))
                .orderIndex(order).build();
    }

    @Test
    @DisplayName("student lesson materials: enrolled → returns active materials in attach order")
    void studentLessonMaterials_enrolled_returnsActive() {
        long studentId = 3L, lessonId = 50L, classId = 9L;
        when(lessonRepository.findById(lessonId)).thenReturn(Optional.of(
                ClassLesson.builder().id(lessonId).classId(classId).build()));
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(classId, studentId)).thenReturn(true);
        when(lessonMaterialRepository.findByIdLessonIdOrderByOrderIndexAsc(lessonId))
                .thenReturn(List.of(lm(lessonId, 1L, 0), lm(lessonId, 2L, 1)));
        when(materialRepository.findAllById(List.of(1L, 2L))).thenReturn(List.of(
                personalMaterial(1L, 99L), personalMaterial(2L, 99L)));
        when(s3StorageService.presignedGetUrl(any(), any())).thenReturn("http://x/k.pdf");

        List<MaterialDto> out = service.listLessonMaterialsForStudent(studentId, lessonId);

        assertThat(out).extracting(MaterialDto::id).containsExactly(1L, 2L);
    }

    @Test
    @DisplayName("student lesson materials: NOT enrolled → forbidden (no access to another class's files)")
    void studentLessonMaterials_notEnrolled_forbidden() {
        long studentId = 3L, lessonId = 50L, classId = 9L;
        when(lessonRepository.findById(lessonId)).thenReturn(Optional.of(
                ClassLesson.builder().id(lessonId).classId(classId).build()));
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(classId, studentId)).thenReturn(false);

        assertThatThrownBy(() -> service.listLessonMaterialsForStudent(studentId, lessonId))
                .isInstanceOf(ForbiddenException.class);
        verify(lessonMaterialRepository, never()).findByIdLessonIdOrderByOrderIndexAsc(any());
    }

    @Test
    @DisplayName("student material url: material NOT attached to that lesson → not found (can't probe ids)")
    void studentMaterialUrl_notAttachedToLesson_notFound() {
        long studentId = 3L, lessonId = 50L, classId = 9L, materialId = 1L;
        when(lessonRepository.findById(lessonId)).thenReturn(Optional.of(
                ClassLesson.builder().id(lessonId).classId(classId).build()));
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(classId, studentId)).thenReturn(true);
        when(lessonMaterialRepository.existsByIdLessonIdAndIdMaterialId(lessonId, materialId)).thenReturn(false);

        assertThatThrownBy(() -> service.refreshLessonMaterialUrlForStudent(studentId, lessonId, materialId))
                .isInstanceOf(NotFoundException.class);
        verify(materialRepository, never()).findById(materialId);
    }

    // --------------------------------------------------------------- archive/unarchive (wave 3)

    @Test
    @DisplayName("unarchive: ARCHIVED → ACTIVE (reappears in its lessons)")
    void unarchive_restoresToActive() {
        User caller = user(7L, null);
        Material m = personalMaterial(1L, 7L);
        m.setStatus("ARCHIVED");
        when(materialRepository.findById(1L)).thenReturn(Optional.of(m));
        when(materialRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(s3StorageService.presignedGetUrl(any(), any())).thenReturn("http://x/k.pdf");

        service.unarchive(caller, 1L);

        assertThat(m.getStatus()).isEqualTo("ACTIVE");
    }

    @Test
    @DisplayName("unarchive: a material that isn't archived → 400 (nothing to restore)")
    void unarchive_notArchived_rejected() {
        User caller = user(7L, null);
        when(materialRepository.findById(1L)).thenReturn(Optional.of(personalMaterial(1L, 7L))); // ACTIVE

        assertThatThrownBy(() -> service.unarchive(caller, 1L)).isInstanceOf(BadRequestException.class);
        verify(materialRepository, never()).save(any());
    }

    @Test
    @DisplayName("attachmentCount: returns lesson + class + assignment counts for the warn-before-archive check")
    void attachmentCount_returnsCounts() {
        User caller = user(7L, null);
        when(materialRepository.findById(1L)).thenReturn(Optional.of(personalMaterial(1L, 7L)));
        when(lessonMaterialRepository.countByIdMaterialId(1L)).thenReturn(3L);
        when(classMaterialRepository.countByIdMaterialId(1L)).thenReturn(1L);
        when(assignmentMaterialRepository.countByIdMaterialId(1L)).thenReturn(2L);

        MaterialService.AttachmentCount c = service.attachmentCount(caller, 1L);

        assertThat(c.lessons()).isEqualTo(3L);
        assertThat(c.classes()).isEqualTo(1L);
        assertThat(c.assignments()).isEqualTo(2L);
    }
}
