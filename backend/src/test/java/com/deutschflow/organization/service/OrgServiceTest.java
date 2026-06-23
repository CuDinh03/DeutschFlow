package com.deutschflow.organization.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/**
 * Org-scoping (cross-org IDOR) for the org-admin detail reads — D9/D10. A class/student id that
 * belongs to another org must 404: the path id is never trusted, orgId always comes from the
 * principal, and the lookup is scoped to that org so a foreign id resolves to "not found".
 */
@ExtendWith(MockitoExtension.class)
class OrgServiceTest {

    @Mock OrgMembershipService membershipService;
    @Mock OrgMemberRepository memberRepo;
    @Mock OrganizationRepository organizationRepository;
    @Mock TeacherClassRepository teacherClassRepository;
    @Mock UserRepository userRepository;
    @Mock ClassStudentRepository classStudentRepository;

    @InjectMocks OrgService service;

    private static final long ORG_ID = 10L;
    private static final long OTHER_ORG = 20L;

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
}
