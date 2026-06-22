package com.deutschflow.organization.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.repository.OrgMemberRepository;
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

    private OrgGuard orgGuard;

    private static final Long ORG_ID = 10L;
    private static final Long USER_ID = 99L;

    @BeforeEach
    void setUp() {
        orgGuard = new OrgGuard(memberRepo);
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
}
