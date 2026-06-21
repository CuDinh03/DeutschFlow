package com.deutschflow.organization.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.CreateOrgRequest;
import com.deutschflow.organization.dto.OrgDto;
import com.deutschflow.organization.dto.OrgMemberDto;
import com.deutschflow.organization.dto.UpdateOrgRequest;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("AdminOrgService — status lifecycle entitlement tests")
class AdminOrgServiceLifecycleTest {

    @Mock private OrganizationRepository organizationRepository;
    @Mock private OrgMembershipService orgMembershipService;
    @Mock private OrgInvitationService orgInvitationService;
    @Mock private OrgMemberRepository orgMemberRepository;
    @Mock private OrgEntitlementService orgEntitlementService;
    @Mock private UserRepository userRepository;

    private AdminOrgService service;

    private static final Long ORG_ID = 5L;

    @BeforeEach
    void setUp() {
        service = new AdminOrgService(
                organizationRepository,
                orgMembershipService,
                orgInvitationService,
                orgMemberRepository,
                orgEntitlementService,
                userRepository
        );
    }

    // ------------------------------------------------------------------ helpers

    private Organization orgWithStatus(String status) {
        Organization org = new Organization();
        org.setId(ORG_ID);
        org.setName("Test Org");
        org.setSlug("test-org");
        org.setPlanCode("PRO");
        org.setStatus(status);
        return org;
    }

    private OrgMember activeMember(Long userId) {
        OrgMember m = new OrgMember();
        m.setId(new OrgMemberId(ORG_ID, userId));
        m.setRole("STUDENT");
        m.setStatus("ACTIVE");
        return m;
    }

    /** Stub the "list all active members" call used by toOrgDto */
    private void stubActiveMembersForDto(List<OrgMember> members) {
        when(orgMemberRepository.findByIdOrgIdAndStatus(eq(ORG_ID), eq("ACTIVE")))
                .thenReturn(members);
    }

    // ------------------------------------------------------------------ createOrganization plan-code normalization

    @Test
    @DisplayName("createOrganization: lowercase plan code is upper-cased so it matches the subscription_plans FK")
    void createOrganization_lowercasePlanCode_normalizedToUpper() {
        when(organizationRepository.existsBySlug("atb-center")).thenReturn(false);
        ArgumentCaptor<Organization> captor = ArgumentCaptor.forClass(Organization.class);
        when(organizationRepository.save(captor.capture())).thenAnswer(i -> {
            Organization o = i.getArgument(0);
            o.setId(ORG_ID);
            return o;
        });
        stubActiveMembersForDto(List.of());

        service.createOrganization(new CreateOrgRequest("ATB", "atb-center", "ultra", 100, null));

        assertThat(captor.getValue().getPlanCode()).isEqualTo("ULTRA");
    }

    @Test
    @DisplayName("createOrganization: blank plan code → null (no empty-string FK violation)")
    void createOrganization_blankPlanCode_null() {
        when(organizationRepository.existsBySlug(anyString())).thenReturn(false);
        ArgumentCaptor<Organization> captor = ArgumentCaptor.forClass(Organization.class);
        when(organizationRepository.save(captor.capture())).thenAnswer(i -> {
            Organization o = i.getArgument(0);
            o.setId(ORG_ID);
            return o;
        });
        stubActiveMembersForDto(List.of());

        service.createOrganization(new CreateOrgRequest("ATB", "atb-2", "   ", 0, null));

        assertThat(captor.getValue().getPlanCode()).isNull();
    }

    // ------------------------------------------------------------------ listMembers (GET /{id}/members)

    @Test
    @DisplayName("listMembers: returns active members enriched with email + display name")
    void listMembers_returnsActiveMembersWithUserInfo() {
        when(organizationRepository.existsById(ORG_ID)).thenReturn(true);
        when(orgMemberRepository.findByIdOrgIdAndStatus(ORG_ID, "ACTIVE"))
                .thenReturn(List.of(activeMember(100L)));
        User u = mock(User.class);
        when(u.getId()).thenReturn(100L);
        when(u.getEmail()).thenReturn("hv@example.com");
        when(u.getDisplayName()).thenReturn("Học viên A");
        when(userRepository.findAllById(any())).thenReturn(List.of(u));

        List<OrgMemberDto> members = service.listMembers(ORG_ID);

        assertThat(members).hasSize(1);
        assertThat(members.get(0).userId()).isEqualTo(100L);
        assertThat(members.get(0).email()).isEqualTo("hv@example.com");
        assertThat(members.get(0).displayName()).isEqualTo("Học viên A");
        assertThat(members.get(0).role()).isEqualTo("STUDENT");
        assertThat(members.get(0).status()).isEqualTo("ACTIVE");
    }

    @Test
    @DisplayName("listMembers: unknown org → NotFound")
    void listMembers_unknownOrg_throwsNotFound() {
        when(organizationRepository.existsById(99L)).thenReturn(false);

        assertThatThrownBy(() -> service.listMembers(99L)).isInstanceOf(NotFoundException.class);
    }

    // ------------------------------------------------------------------ ACTIVE -> SUSPENDED

    @Test
    @DisplayName("ACTIVE -> SUSPENDED: calls revokeStudent for each active STUDENT member")
    void updateOrganization_activeTosuspended_revokesEachStudent() {
        Organization org = orgWithStatus("ACTIVE");
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));
        when(organizationRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        OrgMember s1 = activeMember(101L);
        OrgMember s2 = activeMember(102L);
        when(orgMemberRepository.findByIdOrgIdAndRoleAndStatus(ORG_ID, "STUDENT", "ACTIVE"))
                .thenReturn(List.of(s1, s2));

        // stub the DTO projection call
        stubActiveMembersForDto(List.of(s1, s2));

        UpdateOrgRequest req = new UpdateOrgRequest(null, null, "SUSPENDED", null);
        service.updateOrganization(ORG_ID, req);

        verify(orgEntitlementService).revokeStudent(101L);
        verify(orgEntitlementService).revokeStudent(102L);
        verify(orgEntitlementService, times(2)).revokeStudent(anyLong());
    }

    @Test
    @DisplayName("ACTIVE -> SUSPENDED: does NOT call grantStudent")
    void updateOrganization_activeTosuspended_doesNotGrant() {
        Organization org = orgWithStatus("ACTIVE");
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));
        when(organizationRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        when(orgMemberRepository.findByIdOrgIdAndRoleAndStatus(ORG_ID, "STUDENT", "ACTIVE"))
                .thenReturn(List.of(activeMember(101L)));
        stubActiveMembersForDto(List.of(activeMember(101L)));

        service.updateOrganization(ORG_ID, new UpdateOrgRequest(null, null, "SUSPENDED", null));

        verify(orgEntitlementService, never()).grantStudent(anyLong(), any());
    }

    // ------------------------------------------------------------------ SUSPENDED -> ACTIVE

    @Test
    @DisplayName("SUSPENDED -> ACTIVE: calls grantStudent for each active STUDENT member")
    void updateOrganization_suspendedToActive_grantsEachStudent() {
        Organization org = orgWithStatus("SUSPENDED");
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));
        when(organizationRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        OrgMember s1 = activeMember(201L);
        OrgMember s2 = activeMember(202L);
        OrgMember s3 = activeMember(203L);
        when(orgMemberRepository.findByIdOrgIdAndRoleAndStatus(ORG_ID, "STUDENT", "ACTIVE"))
                .thenReturn(List.of(s1, s2, s3));
        stubActiveMembersForDto(List.of(s1, s2, s3));

        service.updateOrganization(ORG_ID, new UpdateOrgRequest(null, null, "ACTIVE", null));

        verify(orgEntitlementService).grantStudent(eq(201L), any(Organization.class));
        verify(orgEntitlementService).grantStudent(eq(202L), any(Organization.class));
        verify(orgEntitlementService).grantStudent(eq(203L), any(Organization.class));
        verify(orgEntitlementService, times(3)).grantStudent(anyLong(), any());
    }

    @Test
    @DisplayName("SUSPENDED -> ACTIVE: does NOT call revokeStudent")
    void updateOrganization_suspendedToActive_doesNotRevoke() {
        Organization org = orgWithStatus("SUSPENDED");
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));
        when(organizationRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        OrgMember s1 = activeMember(201L);
        when(orgMemberRepository.findByIdOrgIdAndRoleAndStatus(ORG_ID, "STUDENT", "ACTIVE"))
                .thenReturn(List.of(s1));
        stubActiveMembersForDto(List.of(s1));

        service.updateOrganization(ORG_ID, new UpdateOrgRequest(null, null, "ACTIVE", null));

        verify(orgEntitlementService, never()).revokeStudent(anyLong());
    }

    // ------------------------------------------------------------------ status unchanged

    @Test
    @DisplayName("status unchanged (null newStatus): neither grant nor revoke is called")
    void updateOrganization_statusNull_neitherGrantNorRevoke() {
        Organization org = orgWithStatus("ACTIVE");
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));
        when(organizationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        stubActiveMembersForDto(List.of());

        // No status field in request
        service.updateOrganization(ORG_ID, new UpdateOrgRequest("BASIC", 20, null, null));

        verify(orgEntitlementService, never()).revokeStudent(anyLong());
        verify(orgEntitlementService, never()).grantStudent(anyLong(), any());
        // The student query for lifecycle must NOT have been called
        verify(orgMemberRepository, never())
                .findByIdOrgIdAndRoleAndStatus(anyLong(), anyString(), anyString());
    }

    @Test
    @DisplayName("status unchanged (same value): neither grant nor revoke is called")
    void updateOrganization_statusSameValue_neitherGrantNorRevoke() {
        Organization org = orgWithStatus("ACTIVE");
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));
        when(organizationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        stubActiveMembersForDto(List.of());

        // Sending same status as current
        service.updateOrganization(ORG_ID, new UpdateOrgRequest(null, null, "ACTIVE", null));

        verify(orgEntitlementService, never()).revokeStudent(anyLong());
        verify(orgEntitlementService, never()).grantStudent(anyLong(), any());
    }

    // ------------------------------------------------------------------ no students edge case

    @Test
    @DisplayName("ACTIVE -> SUSPENDED with zero students: completes without calling revokeStudent")
    void updateOrganization_activeTosuspended_noStudents_noRevokeCalls() {
        Organization org = orgWithStatus("ACTIVE");
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));
        when(organizationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(orgMemberRepository.findByIdOrgIdAndRoleAndStatus(ORG_ID, "STUDENT", "ACTIVE"))
                .thenReturn(List.of());
        stubActiveMembersForDto(List.of());

        service.updateOrganization(ORG_ID, new UpdateOrgRequest(null, null, "SUSPENDED", null));

        verify(orgEntitlementService, never()).revokeStudent(anyLong());
    }

    // ------------------------------------------------------------------ status validation

    @Test
    @DisplayName("invalid status string throws BadRequestException")
    void updateOrganization_invalidStatus_throwsBadRequest() {
        Organization org = orgWithStatus("ACTIVE");
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));

        assertThatThrownBy(() -> service.updateOrganization(ORG_ID,
                new UpdateOrgRequest(null, null, "INACTIVE", null)))
                .isInstanceOf(BadRequestException.class);

        verify(organizationRepository, never()).save(any());
    }

    @Test
    @DisplayName("PENDING status throws BadRequestException — invitation state, not org state")
    void updateOrganization_pendingStatus_throwsBadRequest() {
        Organization org = orgWithStatus("ACTIVE");
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));

        assertThatThrownBy(() -> service.updateOrganization(ORG_ID,
                new UpdateOrgRequest(null, null, "PENDING", null)))
                .isInstanceOf(BadRequestException.class);

        verify(organizationRepository, never()).save(any());
    }

    // ------------------------------------------------------------------ toOrgDto role-precise count

    @Test
    @DisplayName("toOrgDto counts only TEACHER members — OWNER and MANAGER are not included")
    void listOrganizations_toOrgDto_countsOnlyTeacherRole() {
        Organization org = orgWithStatus("ACTIVE");
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));
        when(organizationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        stubActiveMembersForDto(List.of());

        // arrange: org has 1 OWNER, 1 MANAGER, 2 TEACHER, 3 STUDENT active members
        OrgMember owner = new OrgMember();
        owner.setId(new OrgMemberId(ORG_ID, 1L));
        owner.setRole("OWNER");
        owner.setStatus("ACTIVE");

        OrgMember manager = new OrgMember();
        manager.setId(new OrgMemberId(ORG_ID, 2L));
        manager.setRole("MANAGER");
        manager.setStatus("ACTIVE");

        OrgMember t1 = new OrgMember();
        t1.setId(new OrgMemberId(ORG_ID, 3L));
        t1.setRole("TEACHER");
        t1.setStatus("ACTIVE");

        OrgMember t2 = new OrgMember();
        t2.setId(new OrgMemberId(ORG_ID, 4L));
        t2.setRole("TEACHER");
        t2.setStatus("ACTIVE");

        OrgMember s1 = activeMember(5L);
        OrgMember s2 = activeMember(6L);
        OrgMember s3 = activeMember(7L);

        when(orgMemberRepository.findByIdOrgIdAndStatus(ORG_ID, "ACTIVE"))
                .thenReturn(List.of(owner, manager, t1, t2, s1, s2, s3));

        // trigger updateOrganization with no status change so toOrgDto is called
        OrgDto dto = service.updateOrganization(ORG_ID, new UpdateOrgRequest("PRO", null, null, null));

        assertThat(dto.teacherCount()).isEqualTo(2L);
        assertThat(dto.studentCount()).isEqualTo(3L);
    }
}
