package com.deutschflow.organization.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.AcceptInviteRequest;
import com.deutschflow.organization.dto.InvitationPreviewDto;
import com.deutschflow.organization.dto.OrgInvitationDto;
import com.deutschflow.organization.dto.OrgMemberDto;
import com.deutschflow.organization.entity.OrgInvitation;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgInvitationRepository;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.user.dto.AuthResponse;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.deutschflow.user.service.AuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/**
 * Org teacher-invitation lifecycle: create (admin), list pending, revoke, public
 * token preview, and accept (creates/links a user + membership and issues a session).
 *
 * <p>Membership writes are delegated to {@link OrgMembershipService} so the
 * {@code users.org_id} ↔ {@code org_members} invariant lives in one place.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrgInvitationService {

    private static final String STATUS_PENDING = "PENDING";
    private static final String STATUS_ACCEPTED = "ACCEPTED";
    private static final String STATUS_REVOKED = "REVOKED";
    private static final String STATUS_EXPIRED = "EXPIRED";
    private static final String ROLE_TEACHER = "TEACHER";
    private static final int INVITE_TTL_DAYS = 7;

    private final OrgInvitationRepository invitationRepository;
    private final OrganizationRepository organizationRepository;
    private final OrgMemberRepository memberRepo;
    private final UserRepository userRepository;
    private final OrgMembershipService membershipService;
    private final OrgInvitationMailer mailer;
    private final PasswordEncoder passwordEncoder;
    private final AuthService authService;

    /**
     * Creates a PENDING teacher invitation and emails the accept link (best-effort).
     *
     * @throws ConflictException if a PENDING invite already exists for this email + org
     */
    @Transactional
    public OrgInvitationDto inviteTeacher(Long actorId, Long orgId, String email) {
        String normalizedEmail = normalizeEmail(email);
        if (normalizedEmail.isBlank()) {
            throw new BadRequestException("Email không được để trống.");
        }

        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tổ chức."));

        if (invitationRepository.existsByOrgIdAndEmailAndStatus(orgId, normalizedEmail, STATUS_PENDING)) {
            throw new ConflictException("Đã có lời mời đang chờ cho email này.");
        }

        OrgInvitation invitation = OrgInvitation.builder()
                .orgId(orgId)
                .email(normalizedEmail)
                .role(ROLE_TEACHER)
                .token(UUID.randomUUID().toString())
                .status(STATUS_PENDING)
                .invitedBy(actorId)
                .expiresAt(Instant.now().plus(INVITE_TTL_DAYS, ChronoUnit.DAYS))
                .build();
        invitationRepository.save(invitation);

        mailer.sendInvite(normalizedEmail, org.getName(), ROLE_TEACHER, invitation.getToken());
        return toDto(invitation);
    }

    /** Lists PENDING invitations for the org. */
    @Transactional(readOnly = true)
    public List<OrgInvitationDto> listPending(Long orgId) {
        return invitationRepository.findByOrgIdAndStatus(orgId, STATUS_PENDING).stream()
                .map(OrgInvitationService::toDto)
                .toList();
    }

    /**
     * Revokes a PENDING invitation. Verifies it belongs to the caller's org so an
     * admin cannot revoke another org's invite.
     */
    @Transactional
    public void revoke(Long orgId, Long invitationId) {
        OrgInvitation invitation = invitationRepository.findById(invitationId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy lời mời."));
        if (!orgId.equals(invitation.getOrgId())) {
            throw new ForbiddenException("Lời mời không thuộc tổ chức của bạn.");
        }
        if (STATUS_PENDING.equals(invitation.getStatus())) {
            invitation.setStatus(STATUS_REVOKED);
            invitationRepository.save(invitation);
        }
    }

    /**
     * Public token preview. Marks the invite EXPIRED (best-effort) when past its TTL
     * so the client can render an "expired" state without leaking other details.
     *
     * @throws NotFoundException if no PENDING invite matches the token
     */
    @Transactional
    public InvitationPreviewDto preview(String token) {
        OrgInvitation invitation = invitationRepository.findByTokenAndStatus(token, STATUS_PENDING)
                .orElseThrow(() -> new NotFoundException("Lời mời không hợp lệ hoặc đã được sử dụng."));

        boolean expired = isExpired(invitation);
        if (expired) {
            invitation.setStatus(STATUS_EXPIRED);
            invitationRepository.save(invitation);
        }

        String orgName = organizationRepository.findById(invitation.getOrgId())
                .map(Organization::getName)
                .orElse(null);
        boolean requiresRegistration =
                userRepository.findByEmailIgnoreCase(invitation.getEmail()).isEmpty();

        return new InvitationPreviewDto(
                orgName,
                invitation.getRole(),
                invitation.getEmail(),
                expired,
                requiresRegistration
        );
    }

    /**
     * Accepts a PENDING invitation: links an existing user (or registers a new one),
     * upserts the org membership, marks the invite ACCEPTED, and issues a session.
     *
     * @throws NotFoundException   if no PENDING invite matches the token
     * @throws BadRequestException if the invite is expired, or registration fields are missing
     */
    @Transactional
    public AuthResponse accept(String token, AcceptInviteRequest body) {
        OrgInvitation invitation = invitationRepository.findByTokenAndStatus(token, STATUS_PENDING)
                .orElseThrow(() -> new NotFoundException("Lời mời không hợp lệ hoặc đã được sử dụng."));

        if (isExpired(invitation)) {
            invitation.setStatus(STATUS_EXPIRED);
            invitationRepository.save(invitation);
            throw new BadRequestException("Lời mời đã hết hạn. Vui lòng yêu cầu lời mời mới.");
        }

        User.CreatedVia provenance = inviterProvenance(invitation);
        User user = userRepository.findByEmailIgnoreCase(invitation.getEmail())
                .orElseGet(() -> registerInvitedUser(invitation.getEmail(), body, provenance));

        // Insert/reactivate membership + sync users.org_id + promote STUDENT→TEACHER when applicable.
        membershipService.upsertMember(invitation.getOrgId(), user.getId(), invitation.getRole());

        invitation.setStatus(STATUS_ACCEPTED);
        invitation.setAcceptedAt(Instant.now());
        invitationRepository.save(invitation);

        log.info("[OrgInvite] invitation {} accepted by userId={} (org={}, role={})",
                invitation.getId(), user.getId(), invitation.getOrgId(), invitation.getRole());

        // Re-load so the issued JWT carries the freshly-set orgId.
        User refreshed = userRepository.findById(user.getId()).orElse(user);
        return authService.issueSession(refreshed);
    }

    /**
     * Org-admin pre-create giáo viên (B2B model §2.1, Phase 1 NOW) — TẠO THẲNG account TEACHER +
     * membership, KHÔNG qua invite. {@code createdVia} = org-role người tạo (OWNER/MANAGER).
     * Danh tính person-owned &amp; portable: rời TT chỉ đóng membership, account vẫn sống.
     */
    @Transactional
    public OrgMemberDto preCreateTeacher(Long orgId, String email, String displayName,
                                         String rawPassword, User.CreatedVia createdVia) {
        String normEmail = normalizeEmail(email);
        if (normEmail.isBlank()) {
            throw new BadRequestException("Email không được để trống.");
        }
        if (displayName == null || displayName.isBlank()) {
            throw new BadRequestException("Tên hiển thị không được để trống.");
        }
        if (rawPassword == null || rawPassword.length() < 6) {
            throw new BadRequestException("Mật khẩu tối thiểu 6 ký tự.");
        }
        if (userRepository.existsByEmailIgnoreCase(normEmail)) {
            throw new ConflictException("Email này đã có tài khoản.");
        }
        User teacher = userRepository.save(User.builder()
                .email(normEmail)
                .passwordHash(passwordEncoder.encode(rawPassword))
                .displayName(displayName.trim())
                .role(User.Role.TEACHER)
                .createdVia(createdVia)
                .build());
        membershipService.upsertMember(orgId, teacher.getId(), "TEACHER");
        log.info("[Org] Pre-created TEACHER userId={} (email={}) cho org {} (createdVia={})",
                teacher.getId(), normEmail, orgId, createdVia);
        return new OrgMemberDto(teacher.getId(), teacher.getEmail(), teacher.getDisplayName(),
                "TEACHER", "ACTIVE", Instant.now());
    }

    /** Creates a new TEACHER user for an invite to an email with no existing account. */
    private User registerInvitedUser(String email, AcceptInviteRequest body, User.CreatedVia provenance) {
        if (body == null || body.password() == null || body.password().isBlank()
                || body.displayName() == null || body.displayName().isBlank()) {
            throw new BadRequestException("Vui lòng nhập tên hiển thị và mật khẩu để tạo tài khoản.");
        }
        if (userRepository.existsByEmailIgnoreCase(email)) {
            // Defensive: another request may have created the account between checks.
            throw new ConflictException("Tài khoản với email này đã tồn tại.");
        }
        User user = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(body.password()))
                .displayName(body.displayName().trim())
                .role(User.Role.TEACHER)
                .createdVia(provenance)
                .build();
        return userRepository.save(user);
    }

    /**
     * Provenance của giáo viên được mời = org-role của NGƯỜI MỜI ({@code invited_by}) trong chính org đó.
     * OWNER/MANAGER mời → OWNER/MANAGER; platform-admin (không là member) hoặc không suy được → ADMIN.
     * (Chỉ ghi nguồn — không ảnh hưởng quyền.)
     */
    private User.CreatedVia inviterProvenance(OrgInvitation inv) {
        String role = memberRepo.findByIdOrgIdAndIdUserId(inv.getOrgId(), inv.getInvitedBy())
                .map(OrgMember::getRole).orElse("");
        if ("OWNER".equals(role)) return User.CreatedVia.OWNER;
        if ("MANAGER".equals(role)) return User.CreatedVia.MANAGER;
        return User.CreatedVia.ADMIN;
    }

    private static boolean isExpired(OrgInvitation invitation) {
        return invitation.getExpiresAt() != null && Instant.now().isAfter(invitation.getExpiresAt());
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private static OrgInvitationDto toDto(OrgInvitation invitation) {
        return new OrgInvitationDto(
                invitation.getId(),
                invitation.getEmail(),
                invitation.getRole(),
                invitation.getStatus(),
                invitation.getExpiresAt(),
                invitation.getCreatedAt()
        );
    }
}
