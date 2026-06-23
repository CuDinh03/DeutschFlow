package com.deutschflow.organization.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.OrgClassDto;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Org-scoping (cross-org IDOR) for the org-admin detail reads — D9/D10. A class/student id that
 * belongs to another org must 404: the path id is never trusted, orgId always comes from the
 * principal, and the lookup is scoped to that org so a foreign id resolves to "not found".
 *
 * <p>Also covers {@code createClass} (G-3 follow-up): org-admin tạo lớp phải stamp org của người
 * gọi, gán giáo viên TEACHER ACTIVE của chính org, và tạo bản ghi class_teachers PRIMARY.
 */
@ExtendWith(MockitoExtension.class)
class OrgServiceTest {

    @Mock OrgMembershipService membershipService;
    @Mock OrgMemberRepository memberRepo;
    @Mock OrganizationRepository organizationRepository;
    @Mock TeacherClassRepository teacherClassRepository;
    @Mock ClassTeacherRepository classTeacherRepository;
    @Mock UserRepository userRepository;
    @Mock ClassStudentRepository classStudentRepository;

    @InjectMocks OrgService service;

    private static final long ORG_ID = 10L;
    private static final long OTHER_ORG = 20L;
    private static final long TEACHER_ID = 99L;

    @Test
    @DisplayName("getClassDetail: classId thuộc org khác → NotFound (D9)")
    void getClassDetail_crossOrg_throwsNotFound() {
        when(teacherClassRepository.findById(5L)).thenReturn(Optional.of(
                TeacherClass.builder().id(5L).orgId(OTHER_ORG).build()));

        assertThatThrownBy(() -> service.getClassDetail(ORG_ID, 5L))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("getClassDetail: classId không tồn tại → NotFound")
    void getClassDetail_missing_throwsNotFound() {
        when(teacherClassRepository.findById(5L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getClassDetail(ORG_ID, 5L))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("getStudentDetail: userId không là thành viên org người gọi → NotFound (D10)")
    void getStudentDetail_crossOrg_throwsNotFound() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, 7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getStudentDetail(ORG_ID, 7L))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("createClass: gán giáo viên TEACHER ACTIVE của org → tạo lớp + class_teachers PRIMARY, stamp org")
    void createClass_validTeacher_savesClassAndPrimaryTeacher() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, TEACHER_ID))
                .thenReturn(Optional.of(activeTeacher()));
        when(teacherClassRepository.save(any(TeacherClass.class))).thenAnswer(inv -> {
            TeacherClass c = inv.getArgument(0);
            c.setId(123L);
            c.setCreatedAt(LocalDateTime.now());
            return c;
        });

        OrgClassDto dto = service.createClass(ORG_ID, "  A1.1 Tối T2-T4  ", TEACHER_ID);

        assertThat(dto.id()).isEqualTo(123L);
        assertThat(dto.name()).isEqualTo("A1.1 Tối T2-T4"); // trimmed
        assertThat(dto.teacherId()).isEqualTo(TEACHER_ID);
        assertThat(dto.inviteCode()).isNotBlank();

        ArgumentCaptor<TeacherClass> classCaptor = ArgumentCaptor.forClass(TeacherClass.class);
        verify(teacherClassRepository).save(classCaptor.capture());
        assertThat(classCaptor.getValue().getOrgId()).isEqualTo(ORG_ID);
        assertThat(classCaptor.getValue().getTeacherId()).isEqualTo(TEACHER_ID);
        assertThat(classCaptor.getValue().getInviteCode()).hasSize(8);

        ArgumentCaptor<ClassTeacher> ctCaptor = ArgumentCaptor.forClass(ClassTeacher.class);
        verify(classTeacherRepository).save(ctCaptor.capture());
        assertThat(ctCaptor.getValue().getRole()).isEqualTo("PRIMARY");
        assertThat(ctCaptor.getValue().getId().getClassId()).isEqualTo(123L);
        assertThat(ctCaptor.getValue().getId().getTeacherId()).isEqualTo(TEACHER_ID);
    }

    @Test
    @DisplayName("createClass: giáo viên không thuộc org người gọi → BadRequest (chống IDOR)")
    void createClass_teacherNotInOrg_throwsBadRequest() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, TEACHER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createClass(ORG_ID, "Lớp X", TEACHER_ID))
                .isInstanceOf(BadRequestException.class);
        verify(teacherClassRepository, never()).save(any());
        verify(classTeacherRepository, never()).save(any());
    }

    @Test
    @DisplayName("createClass: thành viên không phải role TEACHER → BadRequest")
    void createClass_memberNotTeacher_throwsBadRequest() {
        OrgMember manager = OrgMember.builder()
                .id(new OrgMemberId(ORG_ID, TEACHER_ID)).role("MANAGER").status("ACTIVE").build();
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, TEACHER_ID)).thenReturn(Optional.of(manager));

        assertThatThrownBy(() -> service.createClass(ORG_ID, "Lớp X", TEACHER_ID))
                .isInstanceOf(BadRequestException.class);
        verify(teacherClassRepository, never()).save(any());
    }

    @Test
    @DisplayName("createClass: giáo viên đã rời org (status != ACTIVE) → BadRequest")
    void createClass_inactiveTeacher_throwsBadRequest() {
        OrgMember left = OrgMember.builder()
                .id(new OrgMemberId(ORG_ID, TEACHER_ID)).role("TEACHER").status("LEFT").build();
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, TEACHER_ID)).thenReturn(Optional.of(left));

        assertThatThrownBy(() -> service.createClass(ORG_ID, "Lớp X", TEACHER_ID))
                .isInstanceOf(BadRequestException.class);
        verify(teacherClassRepository, never()).save(any());
    }

    @Test
    @DisplayName("createClass: tên trống → BadRequest, không chạm DB")
    void createClass_blankName_throwsBadRequest() {
        assertThatThrownBy(() -> service.createClass(ORG_ID, "   ", TEACHER_ID))
                .isInstanceOf(BadRequestException.class);
        verify(teacherClassRepository, never()).save(any());
    }

    @Test
    @DisplayName("createClass: teacherId null → BadRequest, không chạm DB")
    void createClass_nullTeacher_throwsBadRequest() {
        assertThatThrownBy(() -> service.createClass(ORG_ID, "Lớp X", null))
                .isInstanceOf(BadRequestException.class);
        verify(teacherClassRepository, never()).save(any());
    }

    private OrgMember activeTeacher() {
        return OrgMember.builder()
                .id(new OrgMemberId(ORG_ID, TEACHER_ID))
                .role("TEACHER")
                .status("ACTIVE")
                .build();
    }
}
