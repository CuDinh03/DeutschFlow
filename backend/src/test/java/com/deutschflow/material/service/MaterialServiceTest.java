package com.deutschflow.material.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.material.dto.MaterialDto;
import com.deutschflow.material.entity.Material;
import com.deutschflow.material.repository.ClassMaterialRepository;
import com.deutschflow.material.repository.MaterialRepository;
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

    private MaterialService service;

    @BeforeEach
    void setUp() {
        service = new MaterialService(materialRepository, classMaterialRepository,
                s3StorageService, teacherClassRepository, orgMemberRepository);
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
