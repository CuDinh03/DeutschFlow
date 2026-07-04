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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
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
    private static final Long NEW_OWNER_ID = 77L;

    @Mock private OrgMemberRepository memberRepo;
    @Mock private UserRepository userRepository;
    @Mock private JdbcTemplate jdbcTemplate;

    private OrgMembershipService service;

    @BeforeEach
    void setUp() {
        service = new OrgMembershipService(memberRepo, userRepository, jdbcTemplate);
    }

    private User studentUser() {
        return User.builder().id(USER_ID).role(User.Role.STUDENT).build();
    }

    private User teacherUser(Long orgId) {
        User u = User.builder().id(USER_ID).role(User.Role.TEACHER).build();
        u.setOrgId(orgId);
        return u;
    }

    private User userWith(Long id, User.Role role) {
        User u = User.builder().id(id).role(role).email("u" + id + "@trungtam.com").displayName("U" + id).build();
        u.setOrgId(ORG_ID);
        return u;
    }

    // ── ORG-1: centralized, race-safe seat-limit gate in upsertMember ──────────

    @Test
    @DisplayName("upsertMember: rejects a brand-new STUDENT when the org is at its seat limit")
    void upsertMember_newStudentAtSeatLimit_rejected() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class), eq(ORG_ID)))
                .thenReturn(5L); // seat_limit = 5 (locked read)
        when(memberRepo.countByIdOrgIdAndRoleAndStatus(ORG_ID, "STUDENT", "ACTIVE")).thenReturn(5L); // at limit

        assertThatThrownBy(() -> service.upsertMember(ORG_ID, USER_ID, "STUDENT"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("giới hạn chỗ ngồi");

        verify(memberRepo, never()).save(any());
    }

    @Test
    @DisplayName("upsertMember: allows a new STUDENT when seat_limit is 0 (unlimited)")
    void upsertMember_unlimitedSeats_allowed() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class), eq(ORG_ID)))
                .thenReturn(0L); // 0 = unlimited → no count query, no block
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(studentUser()));

        service.upsertMember(ORG_ID, USER_ID, "STUDENT");

        verify(memberRepo).save(any());
    }

    private OrgMember member(String role, String status) {
        return member(USER_ID, role, status);
    }

    private OrgMember member(Long userId, String role, String status) {
        OrgMember m = new OrgMember();
        m.setId(new OrgMemberId(ORG_ID, userId));
        m.setRole(role);
        m.setStatus(status);
        return m;
    }

    // ----------------------------------------------------------------- upsertMember

    @Test
    @DisplayName("upsertMember inserts ACTIVE membership and syncs the platform role to MANAGER")
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
        assertThat(user.getRole()).isEqualTo(User.Role.MANAGER);
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

    @Test
    @DisplayName("removeMember refuses to revoke the OWNER (a MANAGER-authorized caller cannot seize control; last-owner protected)")
    void removeMember_ownerTarget_throwsBadRequest() {
        // C-2/H-5: DELETE /api/org/members/{id} is gated by assertOrgAdmin = {OWNER, MANAGER}, so a
        // MANAGER reaches removeMember. The service must still refuse when the target is the OWNER —
        // otherwise the MANAGER revokes the OWNER and seizes the org. This also guards the last-owner
        // invariant (ownership only moves via transferOwnership).
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.of(member("OWNER", "ACTIVE")));

        assertThatThrownBy(() -> service.removeMember(ORG_ID, USER_ID))
                .isInstanceOf(BadRequestException.class);

        verify(memberRepo, never()).save(any());
        verify(userRepository, never()).save(any());
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
        // Portability (B2B model §2.2): rời TT chỉ đóng membership — account KHÔNG bị xoá → giáo viên tự do.
        verify(userRepository, never()).delete(any());
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

    @Test
    @DisplayName("removeMember 404s when the member does not exist (no silent no-op)")
    void removeMember_missing_throwsNotFound() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.removeMember(ORG_ID, USER_ID))
                .isInstanceOf(NotFoundException.class);
        verify(memberRepo, never()).save(any());
    }

    // ----------------------------------------------------------------- transferOwnership (C-2 recovery path)

    @Test
    @DisplayName("transferOwnership promotes the target to OWNER and demotes the current owner to MANAGER")
    void transferOwnership_promotesTargetDemotesOwner() {
        OrgMember currentOwner = member(USER_ID, "OWNER", "ACTIVE");
        OrgMember target = member(NEW_OWNER_ID, "MANAGER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(currentOwner));
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, NEW_OWNER_ID)).thenReturn(Optional.of(target));
        User ownerUser = userWith(USER_ID, User.Role.OWNER);
        User targetUser = userWith(NEW_OWNER_ID, User.Role.MANAGER);
        when(userRepository.findById(NEW_OWNER_ID)).thenReturn(Optional.of(targetUser));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(ownerUser));

        OrgMemberDto dto = service.transferOwnership(ORG_ID, USER_ID, NEW_OWNER_ID);

        // Ownership seat moved: exactly one OWNER (the target), old owner is now MANAGER — never zero.
        assertThat(target.getRole()).isEqualTo("OWNER");
        assertThat(currentOwner.getRole()).isEqualTo("MANAGER");
        assertThat(targetUser.getRole()).isEqualTo(User.Role.OWNER);
        assertThat(ownerUser.getRole()).isEqualTo(User.Role.MANAGER);
        assertThat(dto.userId()).isEqualTo(NEW_OWNER_ID);
        assertThat(dto.role()).isEqualTo("OWNER");
    }

    @Test
    @DisplayName("transferOwnership can promote an ACTIVE TEACHER to OWNER")
    void transferOwnership_teacherTarget_allowed() {
        OrgMember currentOwner = member(USER_ID, "OWNER", "ACTIVE");
        OrgMember target = member(NEW_OWNER_ID, "TEACHER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(currentOwner));
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, NEW_OWNER_ID)).thenReturn(Optional.of(target));
        when(userRepository.findById(NEW_OWNER_ID)).thenReturn(Optional.of(userWith(NEW_OWNER_ID, User.Role.TEACHER)));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(userWith(USER_ID, User.Role.OWNER)));

        service.transferOwnership(ORG_ID, USER_ID, NEW_OWNER_ID);

        assertThat(target.getRole()).isEqualTo("OWNER");
        assertThat(currentOwner.getRole()).isEqualTo("MANAGER");
    }

    @Test
    @DisplayName("transferOwnership rejects transferring to yourself")
    void transferOwnership_sameUser_throwsBadRequest() {
        assertThatThrownBy(() -> service.transferOwnership(ORG_ID, USER_ID, USER_ID))
                .isInstanceOf(BadRequestException.class);

        verify(memberRepo, never()).save(any());
    }

    @Test
    @DisplayName("transferOwnership rejects a caller who is not the current OWNER (e.g. a MANAGER)")
    void transferOwnership_callerNotOwner_throwsForbidden() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.of(member(USER_ID, "MANAGER", "ACTIVE")));

        assertThatThrownBy(() -> service.transferOwnership(ORG_ID, USER_ID, NEW_OWNER_ID))
                .isInstanceOf(ForbiddenException.class);

        verify(memberRepo, never()).save(any());
    }

    @Test
    @DisplayName("transferOwnership throws Forbidden when the caller is not an ACTIVE member")
    void transferOwnership_callerNotMember_throwsForbidden() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.transferOwnership(ORG_ID, USER_ID, NEW_OWNER_ID))
                .isInstanceOf(ForbiddenException.class);

        verify(memberRepo, never()).save(any());
    }

    @Test
    @DisplayName("transferOwnership 404s when the target is not a member of the org")
    void transferOwnership_targetMissing_throwsNotFound() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.of(member(USER_ID, "OWNER", "ACTIVE")));
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, NEW_OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.transferOwnership(ORG_ID, USER_ID, NEW_OWNER_ID))
                .isInstanceOf(NotFoundException.class);

        verify(memberRepo, never()).save(any());
    }

    @Test
    @DisplayName("transferOwnership rejects a non-staff (STUDENT) target")
    void transferOwnership_studentTarget_throwsBadRequest() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.of(member(USER_ID, "OWNER", "ACTIVE")));
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, NEW_OWNER_ID))
                .thenReturn(Optional.of(member(NEW_OWNER_ID, "STUDENT", "ACTIVE")));

        assertThatThrownBy(() -> service.transferOwnership(ORG_ID, USER_ID, NEW_OWNER_ID))
                .isInstanceOf(BadRequestException.class);

        verify(memberRepo, never()).save(any());
    }

    @Test
    @DisplayName("countActiveOwners delegates to the ACTIVE OWNER count query")
    void countActiveOwners_delegates() {
        when(memberRepo.countByIdOrgIdAndRoleAndStatus(ORG_ID, "OWNER", "ACTIVE")).thenReturn(1L);

        assertThat(service.countActiveOwners(ORG_ID)).isEqualTo(1L);
    }
}
