package com.deutschflow.organization.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.OrgClassDetailDto;
import com.deutschflow.organization.dto.OrgStudentDetailDto;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the org per-entity detail reads (B1.1 class-detail, B1.2 student-detail).
 * Focus: roster/enrolment mapping + the IDOR guard (an org-admin must not read another org's
 * class or student).
 */
@ExtendWith(MockitoExtension.class)
class OrgServiceDetailTest {

    private static final long ORG_ID = 10L;

    @Mock private OrgMembershipService membershipService;
    @Mock private OrgMemberRepository memberRepo;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private TeacherClassRepository teacherClassRepository;
    @Mock private UserRepository userRepository;
    @Mock private ClassStudentRepository classStudentRepository;

    private OrgService orgService;

    @BeforeEach
    void setUp() {
        orgService = new OrgService(membershipService, memberRepo, organizationRepository,
                teacherClassRepository, userRepository, classStudentRepository);
    }

    private static User user(long id, String email, String name) {
        return User.builder().id(id).email(email).displayName(name).build();
    }

    @Test
    @DisplayName("getClassDetail: lớp thuộc org → trả tên GV + roster (kèm skill_*)")
    void getClassDetail_classInOrg_returnsRoster() {
        TeacherClass tc = TeacherClass.builder()
                .id(1L).orgId(ORG_ID).teacherId(5L).name("A1.1").inviteCode("ABC")
                .createdAt(LocalDateTime.now()).build();
        when(teacherClassRepository.findById(1L)).thenReturn(Optional.of(tc));
        when(userRepository.findById(5L)).thenReturn(Optional.of(user(5L, "anna@x", "Cô Anna")));
        ClassStudent cs = ClassStudent.builder()
                .id(ClassStudentId.builder().classId(1L).studentId(7L).build())
                .joinedAt(LocalDateTime.now())
                .skillHoren(new BigDecimal("8.5"))
                .build();
        when(classStudentRepository.findByIdClassId(1L)).thenReturn(List.of(cs));
        when(userRepository.findAllById(List.of(7L))).thenReturn(List.of(user(7L, "s@x", "HV Bảy")));

        OrgClassDetailDto dto = orgService.getClassDetail(ORG_ID, 1L);

        assertThat(dto.id()).isEqualTo(1L);
        assertThat(dto.teacherName()).isEqualTo("Cô Anna");
        assertThat(dto.studentCount()).isEqualTo(1);
        assertThat(dto.students()).hasSize(1);
        assertThat(dto.students().get(0).userId()).isEqualTo(7L);
        assertThat(dto.students().get(0).email()).isEqualTo("s@x");
        assertThat(dto.students().get(0).skillHoren()).isEqualByComparingTo("8.5");
    }

    @Test
    @DisplayName("getClassDetail: lớp thuộc org khác → NotFound (chống IDOR)")
    void getClassDetail_classInAnotherOrg_throws() {
        TeacherClass other = TeacherClass.builder().id(1L).orgId(99L).build();
        when(teacherClassRepository.findById(1L)).thenReturn(Optional.of(other));

        assertThatThrownBy(() -> orgService.getClassDetail(ORG_ID, 1L))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("getClassDetail: lớp không tồn tại → NotFound")
    void getClassDetail_missing_throws() {
        when(teacherClassRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> orgService.getClassDetail(ORG_ID, 1L))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("getStudentDetail: thành viên org → chỉ trả các lớp thuộc org (lọc lớp org khác)")
    void getStudentDetail_member_returnsOrgScopedClasses() {
        OrgMemberId mid = new OrgMemberId();
        mid.setOrgId(ORG_ID);
        mid.setUserId(7L);
        OrgMember member = OrgMember.builder()
                .id(mid).role("STUDENT").status("ACTIVE").joinedAt(Instant.now()).build();
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, 7L)).thenReturn(Optional.of(member));
        when(userRepository.findById(7L)).thenReturn(Optional.of(user(7L, "s@x", "HV Bảy")));
        ClassStudent e1 = ClassStudent.builder()
                .id(ClassStudentId.builder().classId(1L).studentId(7L).build()).build();
        ClassStudent e2 = ClassStudent.builder()
                .id(ClassStudentId.builder().classId(2L).studentId(7L).build()).build();
        when(classStudentRepository.findByIdStudentId(7L)).thenReturn(List.of(e1, e2));
        TeacherClass inOrg = TeacherClass.builder().id(1L).orgId(ORG_ID).name("A1").build();
        TeacherClass otherOrg = TeacherClass.builder().id(2L).orgId(99L).name("Khác").build();
        when(teacherClassRepository.findAllById(List.of(1L, 2L))).thenReturn(List.of(inOrg, otherOrg));

        OrgStudentDetailDto dto = orgService.getStudentDetail(ORG_ID, 7L);

        assertThat(dto.userId()).isEqualTo(7L);
        assertThat(dto.role()).isEqualTo("STUDENT");
        assertThat(dto.classes()).hasSize(1);
        assertThat(dto.classes().get(0).classId()).isEqualTo(1L);
    }

    @Test
    @DisplayName("getStudentDetail: không phải thành viên org → NotFound (chống IDOR)")
    void getStudentDetail_notMember_throws() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, 7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> orgService.getStudentDetail(ORG_ID, 7L))
                .isInstanceOf(NotFoundException.class);
    }
}
