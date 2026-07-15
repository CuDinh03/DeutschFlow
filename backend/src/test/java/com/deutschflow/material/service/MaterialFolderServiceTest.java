package com.deutschflow.material.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.material.dto.MaterialFolderDto;
import com.deutschflow.material.entity.MaterialFolder;
import com.deutschflow.material.repository.ClassMaterialRepository;
import com.deutschflow.material.repository.MaterialFolderRepository;
import com.deutschflow.material.repository.MaterialRepository;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Folder CRUD authz for {@link MaterialService}. Mirrors the material ownership model: PERSONAL folder →
 * only its teacher owner; ORG folder → any ACTIVE member to read, but only the author or an OWNER/MANAGER
 * to rename/delete. Deleting a folder is allowed to unfile (DB FK SET NULL) — no material is destroyed.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("MaterialService — folder CRUD Unit Tests")
class MaterialFolderServiceTest {

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

    private MaterialService service;

    @BeforeEach
    void setUp() {
        service = new MaterialService(materialRepository, folderRepository, classMaterialRepository,
                s3StorageService, materialPreviewService, teacherClassRepository, orgMemberRepository,
                lessonMaterialRepository, lessonRepository, classStudentRepository);
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

    private MaterialFolder personalFolder(long id, long teacherId) {
        return MaterialFolder.builder().id(id).ownerScope("PERSONAL").teacherId(teacherId)
                .createdBy(teacherId).name("Netzwerk A1").orderIndex(0).build();
    }

    private MaterialFolder orgFolder(long id, long orgId, long createdBy) {
        return MaterialFolder.builder().id(id).ownerScope("ORG").orgId(orgId)
                .createdBy(createdBy).name("Trung tâm A1").orderIndex(0).build();
    }

    @Test
    @DisplayName("createFolder PERSONAL → owner_scope=PERSONAL, teacher_id + created_by = caller")
    void createFolder_personal_setsOwnerAndCreatedBy() {
        User caller = user(7L, null);
        when(folderRepository.save(any()))
                .thenAnswer(i -> { MaterialFolder f = i.getArgument(0); f.setId(1L); return f; });

        MaterialFolderDto dto = service.createFolder(caller, "PERSONAL", "Netzwerk A1", null);

        ArgumentCaptor<MaterialFolder> cap = ArgumentCaptor.forClass(MaterialFolder.class);
        verify(folderRepository).save(cap.capture());
        assertThat(cap.getValue().getOwnerScope()).isEqualTo("PERSONAL");
        assertThat(cap.getValue().getTeacherId()).isEqualTo(7L);
        assertThat(cap.getValue().getOrgId()).isNull();
        assertThat(cap.getValue().getCreatedBy()).isEqualTo(7L);
        assertThat(cap.getValue().getOrderIndex()).isEqualTo(0);
        assertThat(dto.ownerScope()).isEqualTo("PERSONAL");
    }

    @Test
    @DisplayName("createFolder ORG without an org → Forbidden, nothing saved")
    void createFolder_orgNoOrg_forbidden() {
        User caller = user(7L, null);

        assertThatThrownBy(() -> service.createFolder(caller, "ORG", "X", null))
                .isInstanceOf(ForbiddenException.class);
        verify(folderRepository, never()).save(any());
    }

    @Test
    @DisplayName("createFolder with a blank name → BadRequest")
    void createFolder_blankName_badRequest() {
        User caller = user(7L, null);

        assertThatThrownBy(() -> service.createFolder(caller, "PERSONAL", "   ", null))
                .isInstanceOf(BadRequestException.class);
        verify(folderRepository, never()).save(any());
    }

    @Test
    @DisplayName("rename a PERSONAL folder by a non-owner → Forbidden, not saved")
    void renameFolder_personalNonOwner_forbidden() {
        User caller = user(99L, null);
        when(folderRepository.findById(1L)).thenReturn(Optional.of(personalFolder(1L, 7L)));

        assertThatThrownBy(() -> service.renameFolder(caller, 1L, "New name", null))
                .isInstanceOf(ForbiddenException.class);
        verify(folderRepository, never()).save(any());
    }

    @Test
    @DisplayName("delete an ORG folder by another teacher (not author, not admin) → Forbidden, not deleted")
    void deleteFolder_orgNonAdmin_forbidden() {
        User caller = user(9L, 10L);
        when(folderRepository.findById(1L)).thenReturn(Optional.of(orgFolder(1L, 10L, 7L)));
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(10L, 9L))
                .thenReturn(Optional.of(member(10L, 9L, "TEACHER", "ACTIVE")));

        assertThatThrownBy(() -> service.deleteFolder(caller, 1L))
                .isInstanceOf(ForbiddenException.class);
        verify(folderRepository, never()).delete(any());
    }

    @Test
    @DisplayName("delete an ORG folder by a MANAGER (not author) → deleted")
    void deleteFolder_orgManager_ok() {
        User caller = user(9L, 10L);
        MaterialFolder f = orgFolder(1L, 10L, 7L);
        when(folderRepository.findById(1L)).thenReturn(Optional.of(f));
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(10L, 9L))
                .thenReturn(Optional.of(member(10L, 9L, "MANAGER", "ACTIVE")));

        service.deleteFolder(caller, 1L);

        verify(folderRepository).delete(f);
    }

    @Test
    @DisplayName("delete a PERSONAL folder by its owner → deleted")
    void deleteFolder_personalOwner_ok() {
        User caller = user(7L, null);
        MaterialFolder f = personalFolder(1L, 7L);
        when(folderRepository.findById(1L)).thenReturn(Optional.of(f));

        service.deleteFolder(caller, 1L);

        verify(folderRepository).delete(f);
    }
}
