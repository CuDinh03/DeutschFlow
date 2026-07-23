package com.deutschflow.organization.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.AcceptInviteRequest;
import com.deutschflow.organization.dto.InvitationPreviewDto;
import com.deutschflow.organization.entity.OrgInvitation;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgInvitationRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.user.dto.AuthResponse;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.deutschflow.user.service.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("OrgInvitationService Unit Tests")
class OrgInvitationServiceTest {

    @Mock
    private OrgInvitationRepository invitationRepository;
    @Mock
    private OrganizationRepository organizationRepository;
    @Mock
    private com.deutschflow.organization.repository.OrgMemberRepository memberRepo;
    @Mock
    private UserRepository userRepository;
    @Mock
    private OrgMembershipService membershipService;
    @Mock
    private OrgInvitationMailer mailer;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private AuthService authService;

    private OrgInvitationService service;

    private static final Long ORG_ID = 10L;
    private static final Long ACTOR_ID = 1L;
    private static final String TOKEN = "test-token-abc-123";

    @BeforeEach
    void setUp() {
        service = new OrgInvitationService(
                invitationRepository,
                organizationRepository,
                memberRepo,
                userRepository,
                membershipService,
                mailer,
                passwordEncoder,
                authService
        );
    }

    // ------------------------------------------------------------------ helpers

    private OrgInvitation pendingInvitation(String email, Instant expiresAt) {
        OrgInvitation inv = new OrgInvitation();
        inv.setId(42L);
        inv.setOrgId(ORG_ID);
        inv.setEmail(email);
        inv.setRole("TEACHER");
        inv.setToken(TOKEN);
        inv.setStatus("PENDING");
        inv.setInvitedBy(ACTOR_ID);
        inv.setExpiresAt(expiresAt);
        return inv;
    }

    private User existingTeacherUser(Long id, String email) {
        return User.builder()
                .id(id)
                .email(email)
                .role(User.Role.TEACHER)
                .displayName("Existing Teacher")
                .passwordHash("hashed")
                .build();
    }

    private AuthResponse dummyAuthResponse(Long userId) {
        return new AuthResponse(
                "access-token", "refresh-token",
                userId, "teacher@school.edu", "Existing Teacher",
                "TEACHER", "vi",
                null, null,
                ORG_ID, "TEACHER"
        );
    }

    private Organization orgNamed(String name) {
        return Organization.builder().id(ORG_ID).name(name).slug("atb").build();
    }

    private OrgMember activeMember(Long orgId, Long userId) {
        OrgMember m = new OrgMember();
        m.setId(new OrgMemberId(orgId, userId));
        m.setRole("TEACHER");
        m.setStatus("ACTIVE");
        return m;
    }

    // ------------------------------------------------------------------ accept happy path: new user created

    @Test
    @DisplayName("accept happy path: new user + TEACHER membership created + invitation ACCEPTED")
    void accept_newUser_createsUserAndMembership() {
        Instant future = Instant.now().plus(7, ChronoUnit.DAYS);
        OrgInvitation invitation = pendingInvitation("newteacher@school.edu", future);

        when(invitationRepository.findByTokenAndStatus(TOKEN, "PENDING"))
                .thenReturn(Optional.of(invitation));
        when(userRepository.findByEmailIgnoreCase("newteacher@school.edu"))
                .thenReturn(Optional.empty());
        when(userRepository.existsByEmailIgnoreCase("newteacher@school.edu"))
                .thenReturn(false);

        User createdUser = User.builder()
                .id(200L)
                .email("newteacher@school.edu")
                .role(User.Role.TEACHER)
                .displayName("New Teacher")
                .passwordHash("encoded-password")
                .orgId(ORG_ID)
                .build();
        when(passwordEncoder.encode("Secret1!")).thenReturn("encoded-password");
        when(userRepository.save(any(User.class))).thenReturn(createdUser);
        when(userRepository.findById(200L)).thenReturn(Optional.of(createdUser));
        when(authService.issueSession(any(User.class))).thenReturn(dummyAuthResponse(200L));

        AcceptInviteRequest body = new AcceptInviteRequest("New Teacher", "Secret1!");
        AuthResponse response = service.accept(TOKEN, body);

        assertThat(response).isNotNull();
        assertThat(response.userId()).isEqualTo(200L);
        assertThat(response.orgRole()).isEqualTo("TEACHER");

        // Membership must be created
        verify(membershipService).upsertMember(eq(ORG_ID), eq(200L), eq("TEACHER"));

        // Invitation status must be ACCEPTED
        assertThat(invitation.getStatus()).isEqualTo("ACCEPTED");
        assertThat(invitation.getAcceptedAt()).isNotNull();
        verify(invitationRepository).save(invitation);
    }

    // ------------------------------------------------------------------ accept happy path: existing user

    @Test
    @DisplayName("accept existing user WITH correct password: adds membership only, no new user created")
    void accept_existingUser_correctPassword_addsMembershipWithoutCreatingUser() {
        Instant future = Instant.now().plus(7, ChronoUnit.DAYS);
        String email = "existing@school.edu";
        OrgInvitation invitation = pendingInvitation(email, future);

        User existing = existingTeacherUser(50L, email);
        when(invitationRepository.findByTokenAndStatus(TOKEN, "PENDING"))
                .thenReturn(Optional.of(invitation));
        when(userRepository.findByEmailIgnoreCase(email))
                .thenReturn(Optional.of(existing));
        // Existing account must prove ownership with its own password.
        when(passwordEncoder.matches("Correct1!", "hashed")).thenReturn(true);
        when(userRepository.findById(50L)).thenReturn(Optional.of(existing));
        when(authService.issueSession(any(User.class))).thenReturn(dummyAuthResponse(50L));

        AcceptInviteRequest body = new AcceptInviteRequest(null, "Correct1!");
        AuthResponse response = service.accept(TOKEN, body);

        assertThat(response.userId()).isEqualTo(50L);

        // membership upserted for existing user
        verify(membershipService).upsertMember(eq(ORG_ID), eq(50L), eq("TEACHER"));
        // no new user saved (save only called from registerInvitedUser which is NOT called)
        verify(userRepository, never()).existsByEmailIgnoreCase(anyString());
    }

    // ---------------------------------------------------- C-1: token alone must NOT mint a session

    @Test
    @DisplayName("accept existing user WITHOUT password: throws, no membership, no session (C-1 takeover blocked)")
    void accept_existingUser_missingPassword_throwsAndIssuesNoSession() {
        Instant future = Instant.now().plus(7, ChronoUnit.DAYS);
        String email = "victim@school.edu";
        OrgInvitation invitation = pendingInvitation(email, future);

        User victim = existingTeacherUser(50L, email);
        when(invitationRepository.findByTokenAndStatus(TOKEN, "PENDING"))
                .thenReturn(Optional.of(invitation));
        when(userRepository.findByEmailIgnoreCase(email)).thenReturn(Optional.of(victim));

        // Attacker holds a leaked/forwarded token but supplies no password.
        assertThatThrownBy(() -> service.accept(TOKEN, new AcceptInviteRequest(null, null)))
                .isInstanceOf(BadRequestException.class);

        // The takeover primitives must never fire.
        verify(membershipService, never()).upsertMember(anyLong(), anyLong(), anyString());
        verify(authService, never()).issueSession(any(User.class));
        // Invite is NOT consumed — status stays PENDING, nothing persisted as ACCEPTED.
        assertThat(invitation.getStatus()).isEqualTo("PENDING");
        verify(invitationRepository, never()).save(any());
    }

    @Test
    @DisplayName("accept existing user WITH wrong password: throws, no membership, no session (C-1 takeover blocked)")
    void accept_existingUser_wrongPassword_throwsAndIssuesNoSession() {
        Instant future = Instant.now().plus(7, ChronoUnit.DAYS);
        String email = "victim@school.edu";
        OrgInvitation invitation = pendingInvitation(email, future);

        User victim = existingTeacherUser(50L, email);
        when(invitationRepository.findByTokenAndStatus(TOKEN, "PENDING"))
                .thenReturn(Optional.of(invitation));
        when(userRepository.findByEmailIgnoreCase(email)).thenReturn(Optional.of(victim));
        when(passwordEncoder.matches("guessed-wrong", "hashed")).thenReturn(false);

        assertThatThrownBy(() -> service.accept(TOKEN, new AcceptInviteRequest(null, "guessed-wrong")))
                .isInstanceOf(BadRequestException.class);

        verify(membershipService, never()).upsertMember(anyLong(), anyLong(), anyString());
        verify(authService, never()).issueSession(any(User.class));
        assertThat(invitation.getStatus()).isEqualTo("PENDING");
        verify(invitationRepository, never()).save(any());
    }

    // ------------------------------------------------------------------ expired token

    @Test
    @DisplayName("accept expired token: throws BadRequestException and marks invitation EXPIRED")
    void accept_expiredToken_throwsBadRequest() {
        Instant past = Instant.now().minus(1, ChronoUnit.DAYS);
        OrgInvitation invitation = pendingInvitation("teacher@school.edu", past);

        when(invitationRepository.findByTokenAndStatus(TOKEN, "PENDING"))
                .thenReturn(Optional.of(invitation));

        assertThatThrownBy(() -> service.accept(TOKEN, new AcceptInviteRequest("A", "pass")))
                .isInstanceOf(BadRequestException.class);

        assertThat(invitation.getStatus()).isEqualTo("EXPIRED");
        verify(invitationRepository).save(invitation);
        // No membership should be created for expired invite
        verify(membershipService, never()).upsertMember(anyLong(), anyLong(), anyString());
    }

    // ------------------------------------------------------------------ reused / ACCEPTED token

    @Test
    @DisplayName("accept already-ACCEPTED token: throws NotFoundException (no PENDING row)")
    void accept_alreadyAcceptedToken_throwsNotFound() {
        // findByTokenAndStatus for 'PENDING' returns empty because status is ACCEPTED
        when(invitationRepository.findByTokenAndStatus(TOKEN, "PENDING"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.accept(TOKEN, new AcceptInviteRequest("A", "pass")))
                .isInstanceOf(NotFoundException.class);

        verify(membershipService, never()).upsertMember(anyLong(), anyLong(), anyString());
    }

    @Test
    @DisplayName("accept unknown token: throws NotFoundException")
    void accept_unknownToken_throwsNotFound() {
        when(invitationRepository.findByTokenAndStatus("bad-token", "PENDING"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.accept("bad-token", new AcceptInviteRequest("A", "pass")))
                .isInstanceOf(NotFoundException.class);
    }

    // ------------------------------------------------------------------ existing user: STUDENT promoted to TEACHER

    @Test
    @DisplayName("accept existing STUDENT user: membership upsert promotes to TEACHER (via membershipService)")
    void accept_existingStudentUser_membershipUpsertedWithTeacherRole() {
        Instant future = Instant.now().plus(7, ChronoUnit.DAYS);
        String email = "student@school.edu";
        OrgInvitation invitation = pendingInvitation(email, future);
        invitation.setRole("TEACHER");

        User studentUser = User.builder()
                .id(77L)
                .email(email)
                .role(User.Role.STUDENT)
                .displayName("Was Student")
                .passwordHash("hashed")
                .build();
        when(invitationRepository.findByTokenAndStatus(TOKEN, "PENDING"))
                .thenReturn(Optional.of(invitation));
        when(userRepository.findByEmailIgnoreCase(email)).thenReturn(Optional.of(studentUser));
        when(passwordEncoder.matches("Student1!", "hashed")).thenReturn(true);
        when(userRepository.findById(77L)).thenReturn(Optional.of(studentUser));
        when(authService.issueSession(any(User.class))).thenReturn(dummyAuthResponse(77L));

        service.accept(TOKEN, new AcceptInviteRequest(null, "Student1!"));

        // The actual promotion happens inside membershipService.upsertMember;
        // the service must delegate with the correct role so the upsert can promote.
        verify(membershipService).upsertMember(eq(ORG_ID), eq(77L), eq("TEACHER"));
    }

    // ------------------------------------------------------------------ preview (read-only, no oracle)

    @Test
    @DisplayName("preview: read-only — does NOT flip an expired invite to EXPIRED (no write on GET)")
    void preview_expiredInvite_isReadOnly_doesNotPersist() {
        Instant past = Instant.now().minus(1, ChronoUnit.DAYS);
        OrgInvitation invitation = pendingInvitation("teacher@school.edu", past);
        when(invitationRepository.findByTokenAndStatus(TOKEN, "PENDING"))
                .thenReturn(Optional.of(invitation));
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.empty());

        InvitationPreviewDto dto = service.preview(TOKEN);

        assertThat(dto.expired()).isTrue();
        // GET must not mutate: status stays PENDING and nothing is persisted.
        assertThat(invitation.getStatus()).isEqualTo("PENDING");
        verify(invitationRepository, never()).save(any());
    }

    @Test
    @DisplayName("preview: does NOT probe user existence — no account-existence oracle (C-1 hardening)")
    void preview_doesNotDiscloseAccountExistence() {
        Instant future = Instant.now().plus(7, ChronoUnit.DAYS);
        OrgInvitation invitation = pendingInvitation("someone@school.edu", future);
        when(invitationRepository.findByTokenAndStatus(TOKEN, "PENDING"))
                .thenReturn(Optional.of(invitation));
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(orgNamed("ATB")));

        InvitationPreviewDto dto = service.preview(TOKEN);

        assertThat(dto.orgName()).isEqualTo("ATB");
        assertThat(dto.role()).isEqualTo("TEACHER");
        assertThat(dto.email()).isEqualTo("someone@school.edu");
        assertThat(dto.expired()).isFalse();
        // Preview must never look up whether the email already has an account.
        verify(userRepository, never()).findByEmailIgnoreCase(anyString());
    }

    @Test
    @DisplayName("preCreateTeacher: tạo account TEACHER + membership + createdVia = role người tạo")
    void preCreateTeacher_createsTeacherWithProvenance() {
        when(userRepository.existsByEmailIgnoreCase("t@x.com")).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("HASH");
        ArgumentCaptor<User> cap = ArgumentCaptor.forClass(User.class);
        when(userRepository.save(cap.capture())).thenAnswer(i -> {
            User u = i.getArgument(0);
            u.setId(88L);
            return u;
        });

        com.deutschflow.organization.dto.OrgMemberDto dto =
                service.preCreateTeacher(ORG_ID, " T@x.com ", "Teacher X", "secret123", User.CreatedVia.OWNER);

        assertThat(cap.getValue().getRole()).isEqualTo(User.Role.TEACHER);
        assertThat(cap.getValue().getCreatedVia()).isEqualTo(User.CreatedVia.OWNER);
        assertThat(cap.getValue().getEmail()).isEqualTo("t@x.com"); // normalized (trim + lowercase)
        verify(membershipService).upsertMember(ORG_ID, 88L, "TEACHER");
        assertThat(dto.role()).isEqualTo("TEACHER");
        assertThat(dto.userId()).isEqualTo(88L);
    }

    @Test
    @DisplayName("preCreateTeacher: email đã tồn tại → ConflictException (không tạo)")
    void preCreateTeacher_duplicateEmail_conflict() {
        when(userRepository.existsByEmailIgnoreCase("dup@x.com")).thenReturn(true);
        assertThatThrownBy(() ->
                service.preCreateTeacher(ORG_ID, "dup@x.com", "D", "secret123", User.CreatedVia.MANAGER))
                .isInstanceOf(com.deutschflow.common.exception.ConflictException.class);
        verify(userRepository, never()).save(any(User.class));
    }

    // ------------------------------------------------------------------ rotate (L-2)

    @Test
    @DisplayName("rotate: PENDING của org mình → token MỚI, hạn đặt lại, email mời gửi lại")
    void rotate_ownOrgPending_issuesNewTokenAndResends() {
        OrgInvitation inv = pendingInvitation("t@school.edu", Instant.now().plus(1, ChronoUnit.DAYS));
        Instant oldExpiry = inv.getExpiresAt();
        when(invitationRepository.findById(42L)).thenReturn(Optional.of(inv));
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(orgNamed("ATB")));

        service.rotate(ORG_ID, 42L);

        assertThat(inv.getToken()).isNotEqualTo(TOKEN); // token cũ chết ngay
        assertThat(inv.getExpiresAt()).isAfter(oldExpiry); // hạn được đặt lại đủ TTL
        assertThat(inv.getStatus()).isEqualTo("PENDING");
        verify(invitationRepository).save(inv);
        verify(mailer).sendInvite(eq("t@school.edu"), eq("ATB"), eq("TEACHER"), eq(inv.getToken()));
    }

    @Test
    @DisplayName("rotate: lời mời của org khác → Forbidden, token giữ nguyên")
    void rotate_crossOrg_throwsForbidden() {
        OrgInvitation inv = pendingInvitation("t@school.edu", Instant.now().plus(7, ChronoUnit.DAYS));
        when(invitationRepository.findById(42L)).thenReturn(Optional.of(inv));

        assertThatThrownBy(() -> service.rotate(999L, 42L))
                .isInstanceOf(ForbiddenException.class);
        assertThat(inv.getToken()).isEqualTo(TOKEN);
        verify(invitationRepository, never()).save(any());
        verify(mailer, never()).sendInvite(anyString(), anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("rotate: lời mời không còn PENDING → BadRequest, không đổi gì")
    void rotate_nonPending_throwsBadRequest() {
        OrgInvitation inv = pendingInvitation("t@school.edu", Instant.now().plus(7, ChronoUnit.DAYS));
        inv.setStatus("REVOKED");
        when(invitationRepository.findById(42L)).thenReturn(Optional.of(inv));

        assertThatThrownBy(() -> service.rotate(ORG_ID, 42L))
                .isInstanceOf(BadRequestException.class);
        assertThat(inv.getToken()).isEqualTo(TOKEN);
        verify(invitationRepository, never()).save(any());
    }

    // ------------------------------------------------------------------ revoke (B7 cross-org scoping)

    @Test
    @DisplayName("revoke: lời mời của org khác → Forbidden, KHÔNG đổi trạng thái (B7)")
    void revoke_crossOrg_throwsForbidden() {
        OrgInvitation inv = pendingInvitation("t@school.edu", Instant.now().plus(7, ChronoUnit.DAYS));
        when(invitationRepository.findById(42L)).thenReturn(Optional.of(inv));

        assertThatThrownBy(() -> service.revoke(999L, 42L)) // caller org 999 ≠ invite org 10
                .isInstanceOf(ForbiddenException.class);
        assertThat(inv.getStatus()).isEqualTo("PENDING");
        verify(invitationRepository, never()).save(any());
    }

    @Test
    @DisplayName("revoke: lời mời PENDING của org mình → REVOKED")
    void revoke_ownOrgPending_setsRevoked() {
        OrgInvitation inv = pendingInvitation("t@school.edu", Instant.now().plus(7, ChronoUnit.DAYS));
        when(invitationRepository.findById(42L)).thenReturn(Optional.of(inv));

        service.revoke(ORG_ID, 42L);

        assertThat(inv.getStatus()).isEqualTo("REVOKED");
        verify(invitationRepository).save(inv);
    }

    @Test
    @DisplayName("revoke: lời mời không tồn tại → NotFound")
    void revoke_missing_throwsNotFound() {
        when(invitationRepository.findById(7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.revoke(ORG_ID, 7L))
                .isInstanceOf(NotFoundException.class);
    }
}
