package com.deutschflow.organization.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.AddMemberRequest;
import com.deutschflow.organization.dto.CreateOrgRequest;
import com.deutschflow.organization.dto.OrgDetailDto;
import com.deutschflow.organization.dto.OrgDto;
import com.deutschflow.organization.dto.OrgMemberDto;
import com.deutschflow.organization.dto.UpdateOrgRequest;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Platform-admin provisioning of organizations ({@code /api/admin/organizations}).
 *
 * <p>Creates orgs, lists/views them with member &amp; seat counts, updates plan/seats/status,
 * and assigns OWNER/MANAGER members manually. Owner attachment reuses
 * {@link OrgMembershipService} (sync {@code org_members} + {@code users.org_id} + role promotion);
 * if the owner email is unknown, an invitation is created via {@link OrgInvitationService}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminOrgService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_SUSPENDED = "SUSPENDED";
    private static final String ROLE_OWNER = "OWNER";
    private static final String ROLE_STUDENT = "STUDENT";
    private static final String ROLE_TEACHER = "TEACHER";
    private static final Set<String> MEMBER_ROLES = Set.of("OWNER", "MANAGER", "TEACHER", "STUDENT");
    /** Org lifecycle states (entity: ACTIVE | SUSPENDED). PENDING is an invitation state, not an org state. */
    private static final Set<String> VALID_ORG_STATUSES = Set.of(STATUS_ACTIVE, STATUS_SUSPENDED);

    private final OrganizationRepository organizationRepository;
    private final OrgMembershipService orgMembershipService;
    private final OrgInvitationService orgInvitationService;
    private final OrgMemberRepository orgMemberRepository;
    private final OrgEntitlementService orgEntitlementService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * Creates an organization with a unique slug. If {@code ownerEmail} resolves to an existing
     * user, attaches them as OWNER (promoting STUDENT→TEACHER via membership service); otherwise
     * issues a pending invitation so the owner can self-register.
     */
    @Transactional
    public OrgDto createOrganization(CreateOrgRequest request) {
        if (request.name() == null || request.name().isBlank()) {
            throw new BadRequestException("Tên tổ chức là bắt buộc");
        }
        if (request.slug() == null || request.slug().isBlank()) {
            throw new BadRequestException("Slug tổ chức là bắt buộc");
        }
        String slug = request.slug().trim();
        if (organizationRepository.existsBySlug(slug)) {
            throw new ConflictException("Slug đã tồn tại: " + slug);
        }

        Organization org = Organization.builder()
                .name(request.name().trim())
                .slug(slug)
                .planCode(normalizePlanCode(request.planCode()))
                .seatLimit(request.seatLimit() == null ? 0 : request.seatLimit())
                .status(STATUS_ACTIVE)
                .build();
        org = organizationRepository.save(org);

        attachOwner(org.getId(), request.ownerEmail(), request.ownerName(), request.ownerPassword());

        return toOrgDto(org);
    }

    /** Lists organizations (paged) with member &amp; student counts. */
    @Transactional(readOnly = true)
    public Page<OrgDto> listOrganizations(Pageable pageable) {
        return organizationRepository.findAll(pageable).map(this::toOrgDto);
    }

    /** Detail view of a single organization with teacher/student/pending-invite counts. */
    @Transactional(readOnly = true)
    public OrgDetailDto getOrganization(Long id) {
        Organization org = organizationRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tổ chức: " + id));
        long teacherCount = orgMembershipService.countByRole(id, ROLE_TEACHER);
        long studentCount = orgMembershipService.countByRole(id, ROLE_STUDENT);
        long pendingInvites = orgInvitationService.listPending(id).size();
        return new OrgDetailDto(
                org.getId(),
                org.getName(),
                org.getSlug(),
                org.getPlanCode(),
                org.getSeatLimit(),
                org.getStatus(),
                teacherCount,
                studentCount,
                pendingInvites
        );
    }

    /**
     * Updates plan/seat-limit/status/licence-expiry; only non-null fields are applied. A status
     * transition to {@code SUSPENDED} revokes entitlements for every ACTIVE STUDENT; a transition
     * back to {@code ACTIVE} re-grants them.
     */
    @Transactional
    public OrgDto updateOrganization(Long id, UpdateOrgRequest request) {
        Organization org = organizationRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tổ chức: " + id));
        if (request.status() != null && !VALID_ORG_STATUSES.contains(request.status())) {
            throw new BadRequestException("Trạng thái tổ chức không hợp lệ: " + request.status());
        }
        String previousStatus = org.getStatus();
        if (request.planCode() != null) {
            org.setPlanCode(normalizePlanCode(request.planCode()));
        }
        if (request.seatLimit() != null) {
            org.setSeatLimit(request.seatLimit());
        }
        if (request.validUntil() != null) {
            org.setValidUntil(request.validUntil());
        }
        if (request.status() != null) {
            org.setStatus(request.status());
        }
        org = organizationRepository.save(org);
        applyStatusTransition(org, previousStatus, request.status());
        return toOrgDto(org);
    }

    /**
     * Cascades a status change to student entitlements: suspending an org revokes all ACTIVE
     * students' plans; reactivating re-grants them. No-op when status is unchanged.
     */
    private void applyStatusTransition(Organization org, String previousStatus, String newStatus) {
        if (newStatus == null || newStatus.equals(previousStatus)) {
            return;
        }
        if (STATUS_SUSPENDED.equals(newStatus)) {
            List<OrgMember> students = orgMemberRepository
                    .findByIdOrgIdAndRoleAndStatus(org.getId(), ROLE_STUDENT, STATUS_ACTIVE);
            for (OrgMember member : students) {
                orgEntitlementService.revokeStudent(member.getId().getUserId());
            }
            log.info("[ORG-ADMIN] Suspended org {}: revoked entitlements for {} student(s)",
                    org.getId(), students.size());
        } else if (STATUS_ACTIVE.equals(newStatus)) {
            List<OrgMember> students = orgMemberRepository
                    .findByIdOrgIdAndRoleAndStatus(org.getId(), ROLE_STUDENT, STATUS_ACTIVE);
            for (OrgMember member : students) {
                orgEntitlementService.grantStudent(member.getId().getUserId(), org);
            }
            log.info("[ORG-ADMIN] Reactivated org {}: granted entitlements for {} student(s)",
                    org.getId(), students.size());
        }
    }

    /** Active members of the org (OWNER/ADMIN/TEACHER/STUDENT), with user email + display name. */
    @Transactional(readOnly = true)
    public List<OrgMemberDto> listMembers(Long orgId) {
        if (!organizationRepository.existsById(orgId)) {
            throw new NotFoundException("Không tìm thấy tổ chức: " + orgId);
        }
        List<OrgMember> members = orgMemberRepository.findByIdOrgIdAndStatus(orgId, STATUS_ACTIVE);
        Map<Long, User> usersById = userRepository
                .findAllById(members.stream().map(m -> m.getId().getUserId()).toList())
                .stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        return members.stream()
                .map(m -> {
                    User u = usersById.get(m.getId().getUserId());
                    return new OrgMemberDto(
                            m.getId().getUserId(),
                            u == null ? null : u.getEmail(),
                            u == null ? null : u.getDisplayName(),
                            m.getRole(),
                            m.getStatus(),
                            m.getJoinedAt());
                })
                .toList();
    }

    /** Manually assigns an existing user as OWNER/MANAGER (or any valid member role) of the org. */
    @Transactional
    public OrgMemberDto addMember(Long orgId, String email, String role) {
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tổ chức: " + orgId));
        if (email == null || email.isBlank()) {
            throw new BadRequestException("Email là bắt buộc");
        }
        String normalizedRole = normalizeRole(role);
        String normalizedEmail = email.trim();

        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng: " + normalizedEmail));

        // Enforce seat limit for STUDENT role when limit is configured (> 0 = limited)
        if ("STUDENT".equals(normalizedRole) && org.getSeatLimit() > 0) {
            boolean alreadyMember = orgMemberRepository.findByIdOrgIdAndIdUserId(org.getId(), user.getId()).isPresent();
            if (!alreadyMember) {
                long currentStudents = orgMembershipService.countByRole(org.getId(), "STUDENT");
                if (currentStudents >= org.getSeatLimit()) {
                    throw new BadRequestException(
                            "Đã đạt giới hạn chỗ ngồi (" + org.getSeatLimit() + " student). Không thể thêm thành viên.");
                }
            }
        }

        orgMembershipService.upsertMember(org.getId(), user.getId(), normalizedRole);

        OrgMember member = orgMemberRepository.findByIdOrgIdAndIdUserId(org.getId(), user.getId())
                .orElseThrow(() -> new NotFoundException("Không tạo được thành viên tổ chức"));
        return new OrgMemberDto(
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                member.getRole(),
                member.getStatus(),
                member.getJoinedAt()
        );
    }

    /**
     * (Re)grants the org's plan to every ACTIVE STUDENT member — e.g. after the org's
     * {@code planCode}/{@code validUntil} changes. No-op per-student when the org sells no plan.
     * Returns the number of students processed.
     */
    @Transactional
    public int activateEntitlements(Long orgId) {
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tổ chức: " + orgId));
        List<OrgMember> students =
                orgMemberRepository.findByIdOrgIdAndRoleAndStatus(orgId, ROLE_STUDENT, STATUS_ACTIVE);
        int granted = 0;
        for (OrgMember member : students) {
            orgEntitlementService.grantStudent(member.getId().getUserId(), org);
            granted++;
        }
        log.info("[ORG-ADMIN] Re-activated entitlements for {} student(s) in org {}", granted, orgId);
        return granted;
    }

    /**
     * Attaches the owner: existing user → OWNER membership; unknown email → pending invitation
     * (best-effort; failure to invite must not fail org creation).
     */
    /**
     * Uppercases the plan code so case-insensitive admin input ("ultra") matches the
     * {@code subscription_plans.code} FK (codes are stored UPPERCASE: FREE/DEFAULT/PRO/ULTRA/…);
     * blank → null (FK is nullable = "no plan"). A still-unknown non-null code is rejected by the
     * FK and surfaced as a clean 409 by {@code GlobalExceptionHandler}, not a raw 500.
     */
    private static String normalizePlanCode(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return raw.trim().toUpperCase();
    }

    /**
     * Gắn OWNER cho org (B2B model §2.1 — admin <b>pre-create</b> OWNER):
     * email đã có account → gắn làm OWNER; email mới → TẠO THẲNG account OWNER (password admin đặt,
     * hoặc random nếu trống) thay vì mời self-register. Atomic với {@code createOrganization}
     * (cùng {@code @Transactional}) → tạo owner lỗi thì rollback cả org, không còn "org mồ côi".
     */
    private void attachOwner(Long orgId, String ownerEmail, String ownerName, String ownerPassword) {
        if (ownerEmail == null || ownerEmail.isBlank()) {
            return;
        }
        String email = ownerEmail.trim();
        Optional<User> existing = userRepository.findByEmail(email);
        if (existing.isPresent()) {
            orgMembershipService.upsertMember(orgId, existing.get().getId(), ROLE_OWNER);
            return;
        }
        if (ownerPassword != null && !ownerPassword.isBlank() && ownerPassword.length() < 6) {
            throw new BadRequestException("Mật khẩu chủ sở hữu tối thiểu 6 ký tự.");
        }
        String rawPw = (ownerPassword != null && !ownerPassword.isBlank())
                ? ownerPassword : UUID.randomUUID().toString();
        String displayName = (ownerName != null && !ownerName.isBlank())
                ? ownerName.trim() : localPart(email);
        User owner = userRepository.save(User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(rawPw))
                .displayName(displayName)
                .role(User.Role.TEACHER)
                .createdVia(User.CreatedVia.ADMIN)
                .build());
        orgMembershipService.upsertMember(orgId, owner.getId(), ROLE_OWNER);
        log.info("[Org] Pre-created OWNER account userId={} (email={}) cho org {}", owner.getId(), email, orgId);
    }

    private static String localPart(String email) {
        int at = email.indexOf('@');
        return at > 0 ? email.substring(0, at) : email;
    }

    /** Resolves the acting platform-admin's id from the security context (for invitation audit). */
    private Long resolveActorId() {
        Object principal = Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
                .map(auth -> auth.getPrincipal())
                .orElse(null);
        if (principal instanceof User u) {
            return u.getId();
        }
        return null;
    }

    private String normalizeRole(String role) {
        String normalized = role == null ? "" : role.trim().toUpperCase();
        if (!MEMBER_ROLES.contains(normalized)) {
            throw new BadRequestException("Vai trò không hợp lệ: " + role);
        }
        return normalized;
    }

    private OrgDto toOrgDto(Organization org) {
        List<OrgMember> active = orgMemberRepository.findByIdOrgIdAndStatus(org.getId(), STATUS_ACTIVE);
        long teacherCount = active.stream()
                .filter(m -> ROLE_TEACHER.equals(m.getRole()))
                .count();
        long studentCount = active.stream()
                .filter(m -> ROLE_STUDENT.equals(m.getRole()))
                .count();
        return new OrgDto(
                org.getId(),
                org.getName(),
                org.getSlug(),
                org.getPlanCode(),
                org.getSeatLimit(),
                org.getStatus(),
                teacherCount,
                studentCount
        );
    }
}
