package com.deutschflow.organization.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.OrgMemberDto;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("OrgMembershipService Unit Tests")
class OrgMembershipServiceTest {

    private static final Long ORG_ID = 10L;
    private static final Long OTHER_ORG = 20L;
    private static final Long USER_ID = 99L;

    @Mock private OrgMemberRepository memberRepo;
    @Mock private UserRepository userRepository;

    private OrgMembershipService service;

    @BeforeEach
    void setUp() {
        service = new OrgMembershipService(memberRepo, userRepository);
    }

    private User studentUser() {
        return User.builder().id(USER_ID).role(User.Role.STUDENT).build();
    }

    private User teacherUser(Long orgId) {
        User u = User.builder().id(USER_ID).role(User.Role.TEACHER).build();
        u.setOrgId(orgId);
        return u;
    }

    private OrgMember member(String role, String status) {
        OrgMember m = new OrgMember();
        m.setId(new OrgMemberId(ORG_ID, USER_ID));
        m.setRole(role);
        m.setStatus(status);
        return m;
    }

    // ----------------------------------------------------------------- upsertMember

    @Test
    @DisplayName("upsertMember inserts ACTIVE membership and promotes STUDENT→TEACHER for MANAGER")
    void upsertMember_newManager_promotesGlobalRole() {
        when(memberRepo.existsByIdUserIdAndStatusAndIdOrgIdNot(USER_ID, "ACTIVE", ORG_ID)).thenReturn(false);
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());
        User user = studentUser();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        service.upsertMember(ORG_ID, USER_ID, "MANAGER");

        ArgumentCaptor<OrgMember> saved = ArgumentCaptor.forClass(OrgMember.class);
        verify(memberRepo).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo("ACTIVE");
        assertThat(saved.getValue().getRole()).isEqualTo("MANAGER");
        assertThat(user.getOrgId()).isEqualTo(ORG_ID);
        assertThat(user.getRole()).isEqualTo(User.Role.TEACHER);
    }

    @Test
    @DisplayName("upsertMember reactivates a previously-LEFT membership and clears left_at")
    void upsertMember_reactivates_clearsLeftAt() {
        OrgMember existing = member("TEACHER", "LEFT");
        existing.setLeftAt(Instant.now());
        when(memberRepo.existsByIdUserIdAndStatusAndIdOrgIdNot(USER_ID, "ACTIVE", ORG_ID)).thenReturn(false);
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(existing));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(studentUser()));

        service.upsertMember(ORG_ID, USER_ID, "TEACHER");

        assertThat(existing.getStatus()).isEqualTo("ACTIVE");
        assertThat(existing.getLeftAt()).isNull();
    }

    @Test
    @DisplayName("upsertMember rejects a staff role when the user is ACTIVE in another org (1-ACTIVE)")
    void upsertMember_staffActiveElsewhere_throwsConflict() {
        when(memberRepo.existsByIdUserIdAndStatusAndIdOrgIdNot(USER_ID, "ACTIVE", ORG_ID)).thenReturn(true);

        assertThatThrownBy(() -> service.upsertMember(ORG_ID, USER_ID, "TEACHER"))
                .isInstanceOf(ConflictException.class);

        verify(memberRepo, never()).save(any());
    }

    @Test
    @DisplayName("upsertMember does NOT block a STUDENT even if ACTIVE elsewhere (move-semantics)")
    void upsertMember_studentActiveElsewhere_allowed() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(studentUser()));

        service.upsertMember(ORG_ID, USER_ID, "STUDENT");

        // The 1-ACTIVE guard is never even queried for STUDENT.
        verify(memberRepo, never()).existsByIdUserIdAndStatusAndIdOrgIdNot(any(), any(), any());
        verify(memberRepo).save(any());
    }

    // ----------------------------------------------------------------- removeMember (admin revoke)

    @Test
    @DisplayName("removeMember marks REVOKED + stamps left_at and detaches the user")
    void removeMember_revokesAndDetaches() {
        OrgMember active = member("TEACHER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(active));
        User user = teacherUser(ORG_ID);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        when(memberRepo.existsByIdUserIdAndRoleInAndStatus(eq(USER_ID), anySet(), eq("ACTIVE"))).thenReturn(false);

        service.removeMember(ORG_ID, USER_ID);

        assertThat(active.getStatus()).isEqualTo("REVOKED");
        assertThat(active.getLeftAt()).isNotNull();
        assertThat(user.getOrgId()).isNull();
        assertThat(user.getRole()).isEqualTo(User.Role.STUDENT);
    }

    // ----------------------------------------------------------------- selfLeave

    @Test
    @DisplayName("selfLeave marks LEFT + stamps left_at and detaches the user")
    void selfLeave_teacher_leavesAndDetaches() {
        OrgMember active = member("TEACHER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(active));
        User user = teacherUser(ORG_ID);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        when(memberRepo.existsByIdUserIdAndRoleInAndStatus(eq(USER_ID), anySet(), eq("ACTIVE"))).thenReturn(false);

        service.selfLeave(ORG_ID, USER_ID);

        assertThat(active.getStatus()).isEqualTo("LEFT");
        assertThat(active.getLeftAt()).isNotNull();
        assertThat(user.getOrgId()).isNull();
    }

    @Test
    @DisplayName("selfLeave throws BadRequest for OWNER (must transfer ownership first)")
    void selfLeave_owner_throwsBadRequest() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.of(member("OWNER", "ACTIVE")));

        assertThatThrownBy(() -> service.selfLeave(ORG_ID, USER_ID))
                .isInstanceOf(BadRequestException.class);

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("selfLeave throws Forbidden when the caller is not an ACTIVE member")
    void selfLeave_nonMember_throwsForbidden() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.selfLeave(ORG_ID, USER_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("countByRole delegates to the ACTIVE count query")
    void countByRole_delegates() {
        when(memberRepo.countByIdOrgIdAndRoleAndStatus(ORG_ID, "STUDENT", "ACTIVE")).thenReturn(7L);

        assertThat(service.countByRole(ORG_ID, "STUDENT")).isEqualTo(7L);
    }

    // ----------------------------------------------------------------- changeRole

    @Test
    @DisplayName("changeRole promotes a TEACHER to MANAGER and returns the updated member")
    void changeRole_teacherToManager_updates() {
        OrgMember m = member("TEACHER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(m));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(teacherUser(ORG_ID)));

        OrgMemberDto dto = service.changeRole(ORG_ID, USER_ID, "manager");

        assertThat(m.getRole()).isEqualTo("MANAGER");
        assertThat(dto.role()).isEqualTo("MANAGER");
    }

    @Test
    @DisplayName("changeRole rejects a non-staff target role")
    void changeRole_invalidRole_throwsBadRequest() {
        assertThatThrownBy(() -> service.changeRole(ORG_ID, USER_ID, "STUDENT"))
                .isInstanceOf(BadRequestException.class);
        verify(memberRepo, never()).save(any());
    }

    @Test
    @DisplayName("changeRole refuses to reassign the OWNER")
    void changeRole_ownerTarget_throwsBadRequest() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.of(member("OWNER", "ACTIVE")));

        assertThatThrownBy(() -> service.changeRole(ORG_ID, USER_ID, "MANAGER"))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("changeRole refuses to convert a STUDENT member via this path")
    void changeRole_studentMember_throwsBadRequest() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.of(member("STUDENT", "ACTIVE")));

        assertThatThrownBy(() -> service.changeRole(ORG_ID, USER_ID, "TEACHER"))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("changeRole 404s when the member is missing/inactive")
    void changeRole_missing_throwsNotFound() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.changeRole(ORG_ID, USER_ID, "MANAGER"))
                .isInstanceOf(NotFoundException.class);
    }
}
