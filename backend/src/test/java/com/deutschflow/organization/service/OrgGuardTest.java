package com.deutschflow.organization.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.repository.OrgAcademicApproverRepository;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("OrgGuard Unit Tests")
class OrgGuardTest {

    @Mock
    private OrgMemberRepository memberRepo;

    @Mock
    private OrgAcademicApproverRepository academicApproverRepo;

    @Mock
    private TeacherClassRepository teacherClassRepository;

    private OrgGuard orgGuard;

    private static final Long ORG_ID = 10L;
    private static final Long USER_ID = 99L;
    private static final Long CLASS_ID = 55L;

    @BeforeEach
    void setUp() {
        orgGuard = new OrgGuard(memberRepo, academicApproverRepo, teacherClassRepository);
    }

    // ------------------------------------------------------------------ helpers

    private OrgMember activeMember(String role) {
        OrgMember m = new OrgMember();
        m.setId(new OrgMemberId(ORG_ID, USER_ID));
        m.setRole(role);
        m.setStatus("ACTIVE");
        return m;
    }

    private void stubMember(OrgMember member) {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.ofNullable(member));
    }

    /** Guard tự vệ M1: mọi test duyệt học vụ dùng CLASS_ID phải khai lớp thuộc đúng org. */
    private void stubClassInOrg(boolean inOrg) {
        when(teacherClassRepository.existsByIdAndOrgId(CLASS_ID, ORG_ID)).thenReturn(inOrg);
    }

    // ------------------------------------------------------------------ assertMember

    @Test
    @DisplayName("assertMember returns membership for ACTIVE member")
    void assertMember_activeMember_returnsMembership() {
        OrgMember member = activeMember("TEACHER");
        stubMember(member);

        OrgMember result = orgGuard.assertMember(USER_ID, ORG_ID);

        assertThat(result.getRole()).isEqualTo("TEACHER");
    }

    @Test
    @DisplayName("assertMember throws ForbiddenException when user is not a member")
    void assertMember_notMember_throwsForbidden() {
        stubMember(null);

        assertThatThrownBy(() -> orgGuard.assertMember(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("assertMember throws ForbiddenException when membership is REMOVED")
    void assertMember_removedMember_throwsForbidden() {
        OrgMember removed = activeMember("TEACHER");
        removed.setStatus("REMOVED");
        stubMember(removed);

        assertThatThrownBy(() -> orgGuard.assertMember(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    // ------------------------------------------------------------------ assertOrgAdmin — pass cases

    @Test
    @DisplayName("assertOrgAdmin passes for OWNER role")
    void assertOrgAdmin_owner_passes() {
        stubMember(activeMember("OWNER"));

        // Must not throw
        orgGuard.assertOrgAdmin(USER_ID, ORG_ID);
    }

    @Test
    @DisplayName("assertOrgAdmin passes for MANAGER role")
    void assertOrgAdmin_manager_passes() {
        stubMember(activeMember("MANAGER"));

        orgGuard.assertOrgAdmin(USER_ID, ORG_ID);
    }

    // ------------------------------------------------------------------ assertOrgAdmin — deny cases

    @Test
    @DisplayName("assertOrgAdmin throws ForbiddenException for TEACHER role")
    void assertOrgAdmin_teacher_throwsForbidden() {
        stubMember(activeMember("TEACHER"));

        assertThatThrownBy(() -> orgGuard.assertOrgAdmin(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("assertOrgAdmin throws ForbiddenException for STUDENT role")
    void assertOrgAdmin_student_throwsForbidden() {
        stubMember(activeMember("STUDENT"));

        assertThatThrownBy(() -> orgGuard.assertOrgAdmin(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("assertOrgAdmin throws ForbiddenException for non-member")
    void assertOrgAdmin_nonMember_throwsForbidden() {
        stubMember(null);

        assertThatThrownBy(() -> orgGuard.assertOrgAdmin(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    // ------------------------------------------------------------------ assertOrgFinance — pass cases (T-5/D-4)

    @Test
    @DisplayName("assertOrgFinance passes for OWNER role")
    void assertOrgFinance_owner_passes() {
        stubMember(activeMember("OWNER"));
        orgGuard.assertOrgFinance(USER_ID, ORG_ID);
    }

    @Test
    @DisplayName("assertOrgFinance throws ForbiddenException for MANAGER role (finance narrowed to OWNER-only, 2026-06-22)")
    void assertOrgFinance_manager_throwsForbidden() {
        stubMember(activeMember("MANAGER"));
        assertThatThrownBy(() -> orgGuard.assertOrgFinance(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("assertOrgFinance throws ForbiddenException for ACCOUNTANT (role dropped, D2)")
    void assertOrgFinance_accountant_throwsForbidden() {
        stubMember(activeMember("ACCOUNTANT"));
        assertThatThrownBy(() -> orgGuard.assertOrgFinance(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    // ------------------------------------------------------------------ assertOrgFinance — deny cases

    @Test
    @DisplayName("assertOrgFinance throws ForbiddenException for TEACHER role")
    void assertOrgFinance_teacher_throwsForbidden() {
        stubMember(activeMember("TEACHER"));
        assertThatThrownBy(() -> orgGuard.assertOrgFinance(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("assertOrgFinance throws ForbiddenException for STUDENT role")
    void assertOrgFinance_student_throwsForbidden() {
        stubMember(activeMember("STUDENT"));
        assertThatThrownBy(() -> orgGuard.assertOrgFinance(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("assertOrgFinance throws ForbiddenException for non-member")
    void assertOrgFinance_nonMember_throwsForbidden() {
        stubMember(null);
        assertThatThrownBy(() -> orgGuard.assertOrgFinance(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    // ------------------------------------------------------------------ assertOrgOwner

    @Test
    @DisplayName("assertOrgOwner passes for OWNER role")
    void assertOrgOwner_owner_passes() {
        stubMember(activeMember("OWNER"));
        orgGuard.assertOrgOwner(USER_ID, ORG_ID); // no throw
    }

    @Test
    @DisplayName("assertOrgOwner throws ForbiddenException for MANAGER role")
    void assertOrgOwner_manager_throwsForbidden() {
        stubMember(activeMember("MANAGER"));
        assertThatThrownBy(() -> orgGuard.assertOrgOwner(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("assertOrgOwner throws ForbiddenException for TEACHER role")
    void assertOrgOwner_teacher_throwsForbidden() {
        stubMember(activeMember("TEACHER"));
        assertThatThrownBy(() -> orgGuard.assertOrgOwner(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    // ------------------------------------------------ assertAcademicApprover (PR-2, P01 — D13/§6)

    @Test
    @DisplayName("assertAcademicApprover: OWNER (giám đốc) luôn qua, không cần dòng phân công")
    void academicApprover_owner_passes() {
        stubMember(activeMember("OWNER"));
        stubClassInOrg(true);
        orgGuard.assertAcademicApprover(USER_ID, ORG_ID, CLASS_ID); // no throw
    }

    @Test
    @DisplayName("assertAcademicApprover: MANAGER KHÔNG mặc định có quyền — tách học vụ khỏi quản trị (§6)")
    void academicApprover_managerWithoutGrant_throwsForbidden() {
        stubMember(activeMember("MANAGER"));
        stubClassInOrg(true);
        when(academicApproverRepo.hasActiveApproval(ORG_ID, USER_ID, CLASS_ID)).thenReturn(false);

        assertThatThrownBy(() -> orgGuard.assertAcademicApprover(USER_ID, ORG_ID, CLASS_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("assertAcademicApprover: TEACHER có phân công hiệu lực phủ lớp → qua")
    void academicApprover_grantedTeacher_passes() {
        stubMember(activeMember("TEACHER"));
        stubClassInOrg(true);
        when(academicApproverRepo.hasActiveApproval(ORG_ID, USER_ID, CLASS_ID)).thenReturn(true);

        orgGuard.assertAcademicApprover(USER_ID, ORG_ID, CLASS_ID); // no throw
    }

    @Test
    @DisplayName("assertAcademicApprover: TEACHER không có phân công phủ lớp → Forbidden")
    void academicApprover_teacherWithoutCoverage_throwsForbidden() {
        stubMember(activeMember("TEACHER"));
        stubClassInOrg(true);
        when(academicApproverRepo.hasActiveApproval(ORG_ID, USER_ID, CLASS_ID)).thenReturn(false);

        assertThatThrownBy(() -> orgGuard.assertAcademicApprover(USER_ID, ORG_ID, CLASS_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("assertAcademicApprover: không phải thành viên → Forbidden trước cả khi tra phân công")
    void academicApprover_nonMember_throwsForbidden() {
        stubMember(null);
        assertThatThrownBy(() -> orgGuard.assertAcademicApprover(USER_ID, ORG_ID, CLASS_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("isAcademicApprover: OWNER=true; TEACHER theo phân công; non-member=false (không ném)")
    void isAcademicApprover_booleanMatrix() {
        stubClassInOrg(true);
        stubMember(activeMember("OWNER"));
        assertThat(orgGuard.isAcademicApprover(USER_ID, ORG_ID, CLASS_ID)).isTrue();

        stubMember(activeMember("TEACHER"));
        when(academicApproverRepo.hasActiveApproval(ORG_ID, USER_ID, CLASS_ID)).thenReturn(true);
        assertThat(orgGuard.isAcademicApprover(USER_ID, ORG_ID, CLASS_ID)).isTrue();

        when(academicApproverRepo.hasActiveApproval(ORG_ID, USER_ID, CLASS_ID)).thenReturn(false);
        assertThat(orgGuard.isAcademicApprover(USER_ID, ORG_ID, CLASS_ID)).isFalse();

        stubMember(null);
        assertThat(orgGuard.isAcademicApprover(USER_ID, ORG_ID, CLASS_ID)).isFalse();
    }

    @Test
    @DisplayName("M1: classId không thuộc trung tâm → Forbidden với MỌI vai, kể cả OWNER")
    void academicApprover_classOutsideOrg_throwsForAll() {
        stubMember(activeMember("OWNER"));
        stubClassInOrg(false);
        assertThatThrownBy(() -> orgGuard.assertAcademicApprover(USER_ID, ORG_ID, CLASS_ID))
                .isInstanceOf(ForbiddenException.class);

        stubMember(activeMember("TEACHER"));
        assertThatThrownBy(() -> orgGuard.assertAcademicApprover(USER_ID, ORG_ID, CLASS_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("H1 phòng thủ sâu: STUDENT còn sót dòng phân công cũ vẫn KHÔNG duyệt được")
    void academicApprover_studentWithStaleGrant_throwsForbidden() {
        stubMember(activeMember("STUDENT"));
        stubClassInOrg(true);
        // KHÔNG stub hasActiveApproval: guard phải chặn từ vai trò, không được rơi tới tra phân công.
        assertThatThrownBy(() -> orgGuard.assertAcademicApprover(USER_ID, ORG_ID, CLASS_ID))
                .isInstanceOf(ForbiddenException.class);
        assertThat(orgGuard.isAcademicApprover(USER_ID, ORG_ID, CLASS_ID)).isFalse();
    }
}
