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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.Set;

/**
 * Single source of truth for keeping {@code org_members} and the denormalized
 * {@code users.org_id} fast-path in sync.
 *
 * <p>Invariant: {@code users.org_id == org_members.org_id} (ACTIVE) of that user.
 * All mutations to org membership flow through here so the invariant holds in one place.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrgMembershipService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_REVOKED = "REVOKED"; // admin removed the member
    private static final String STATUS_LEFT = "LEFT";       // member left on their own
    private static final String ROLE_OWNER = "OWNER";
    private static final String ROLE_STUDENT = "STUDENT";
    /** Org-admin / teaching roles whose holders keep a non-STUDENT platform identity while active. */
    private static final Set<String> STAFF_ROLES = Set.of("OWNER", "MANAGER", "TEACHER");
    /** Roles an OWNER may toggle a staff member between (no OWNER, no STUDENT here). */
    private static final Set<String> ASSIGNABLE_ROLES = Set.of("MANAGER", "TEACHER");

    private final OrgMemberRepository memberRepo;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;

    /**
     * Inserts a new org membership or reactivates an existing one, sets {@code users.org_id},
     * and promotes a global STUDENT to TEACHER when joining as MANAGER/TEACHER.
     *
     * <p>Enforces "1 staff – 1 org at a time" (B2B model §4 decision 1): a non-STUDENT role is
     * rejected when the user already has an ACTIVE membership in a different org. STUDENT keeps
     * move-semantics (roster re-homing) and is not blocked.
     */
    @Transactional
    public void upsertMember(Long orgId, Long userId, String role) {
        if (!ROLE_STUDENT.equals(role)
                && memberRepo.existsByIdUserIdAndStatusAndIdOrgIdNot(userId, STATUS_ACTIVE, orgId)) {
            throw new ConflictException(
                    "Người dùng đã là thành viên đang hoạt động của một tổ chức khác — phải rời tổ chức cũ trước.");
        }

        Optional<OrgMember> existingOpt = memberRepo.findByIdOrgIdAndIdUserId(orgId, userId);

        // Seat-limit gate (ORG-1): centralized here so EVERY add path (admin add, roster import,
        // invitation accept) enforces it, and race-safe — a `SELECT ... FOR UPDATE` on the org row
        // serializes concurrent adds to the same org, so two admins cannot both pass the check and
        // both insert past the limit (closes the J / admin-add race). seat_limit = 0 means unlimited.
        //
        // Audit M-1: the gate must fire whenever this upsert would ADD an ACTIVE student seat — a
        // brand-new membership, a REVOKED/LEFT student being re-added, OR a non-student member
        // switching to STUDENT — but NOT when the member is already an ACTIVE student (idempotent
        // re-save, no new seat). Earlier this only checked `existingOpt.isEmpty()`, so re-adding a
        // formerly-removed student bypassed the cap entirely.
        boolean addsActiveStudentSeat = ROLE_STUDENT.equals(role)
                && !(existingOpt.isPresent()
                        && STATUS_ACTIVE.equals(existingOpt.get().getStatus())
                        && ROLE_STUDENT.equals(existingOpt.get().getRole()));
        if (addsActiveStudentSeat) {
            Long seatLimit = jdbcTemplate.query(
                    "SELECT seat_limit FROM organizations WHERE id = ? FOR UPDATE",
                    rs -> rs.next() ? rs.getLong(1) : null, orgId);
            if (seatLimit != null && seatLimit > 0 && countByRole(orgId, ROLE_STUDENT) >= seatLimit) {
                throw new BadRequestException(
                        "Đã đạt giới hạn chỗ ngồi (" + seatLimit + " student). Không thể thêm thành viên.");
            }
        }

        OrgMember member = existingOpt
                .map(existing -> {
                    existing.setRole(role);
                    existing.setStatus(STATUS_ACTIVE);
                    existing.setLeftAt(null);
                    return existing;
                })
                .orElseGet(() -> OrgMember.builder()
                        .id(new OrgMemberId(orgId, userId))
                        .role(role)
                        .status(STATUS_ACTIVE)
                        .build());
        memberRepo.save(member);

        User user = userRepository.findById(userId).orElseThrow();
        user.setOrgId(orgId);
        syncPlatformRole(user, role);
        userRepository.save(user);
    }

    /**
     * Admin-initiated removal: marks the membership REVOKED (stamps {@code left_at}) and detaches
     * the user (clears {@code users.org_id}, demotes TEACHER → STUDENT when no active teaching
     * membership remains).
     */
    @Transactional
    public void removeMember(Long orgId, Long userId) {
        deactivate(orgId, userId, STATUS_REVOKED);
    }

    /**
     * Member-initiated leave: marks the membership LEFT (stamps {@code left_at}) and detaches the
     * user. The OWNER cannot self-leave (ownership must be transferred first).
     *
     * @throws ForbiddenException  if the user is not an ACTIVE member of the org
     * @throws BadRequestException if the caller is the OWNER
     */
    @Transactional
    public void selfLeave(Long orgId, Long userId) {
        OrgMember member = memberRepo.findByIdOrgIdAndIdUserId(orgId, userId)
                .filter(m -> STATUS_ACTIVE.equals(m.getStatus()))
                .orElseThrow(() -> new ForbiddenException("Bạn không thuộc tổ chức này."));
        if (ROLE_OWNER.equals(member.getRole())) {
            throw new BadRequestException("Chủ sở hữu không thể tự rời — hãy chuyển quyền sở hữu trước.");
        }
        member.setStatus(STATUS_LEFT);
        member.setLeftAt(Instant.now());
        memberRepo.save(member);
        detachUser(orgId, userId);
    }

    /** Counts ACTIVE members of the given role in the org (seat counting). */
    @Transactional(readOnly = true)
    public long countByRole(Long orgId, String role) {
        return memberRepo.countByIdOrgIdAndRoleAndStatus(orgId, role, STATUS_ACTIVE);
    }

    /**
     * Changes an ACTIVE staff member's org-role between MANAGER and TEACHER (B2B model §6). Caller
     * authorization (OWNER-only) is enforced upstream by {@code OrgGuard.assertOrgOwner}. Both the
     * current and the new role must be staff roles — the OWNER cannot be reassigned here, and a
     * STUDENT is not promoted through this path (use the teacher-invite flow). The global
     * {@code users.role} is kept in lock-step with the new org role (MANAGER ↔ TEACHER).
     */
    @Transactional
    public OrgMemberDto changeRole(Long orgId, Long targetUserId, String newRole) {
        String role = newRole == null ? "" : newRole.trim().toUpperCase();
        if (!ASSIGNABLE_ROLES.contains(role)) {
            throw new BadRequestException("Chỉ được đổi sang MANAGER hoặc TEACHER.");
        }
        OrgMember member = memberRepo.findByIdOrgIdAndIdUserId(orgId, targetUserId)
                .filter(m -> STATUS_ACTIVE.equals(m.getStatus()))
                .orElseThrow(() -> new NotFoundException("Thành viên không thuộc tổ chức hoặc không hoạt động."));
        if (ROLE_OWNER.equals(member.getRole())) {
            throw new BadRequestException("Không thể đổi vai trò của chủ sở hữu — hãy chuyển quyền sở hữu.");
        }
        if (!ASSIGNABLE_ROLES.contains(member.getRole())) {
            throw new BadRequestException("Chỉ đổi vai trò giữa MANAGER và TEACHER — học viên không đổi qua đây.");
        }
        member.setRole(role);
        memberRepo.save(member);

        User u = userRepository.findById(targetUserId).orElse(null);
        if (u != null) {
            syncPlatformRole(u, role);   // MANAGER ↔ TEACHER also flips the platform identity
            userRepository.save(u);
        }
        return new OrgMemberDto(
                targetUserId,
                u != null ? u.getEmail() : null,
                u != null ? u.getDisplayName() : null,
                member.getRole(),
                member.getStatus(),
                member.getJoinedAt());
    }

    // ----------------------------------------------------------------- internals

    private void deactivate(Long orgId, Long userId, String status) {
        OrgMember member = memberRepo.findByIdOrgIdAndIdUserId(orgId, userId)
                .orElseThrow(() -> new NotFoundException("Thành viên không tồn tại trong tổ chức."));
        member.setStatus(status);
        member.setLeftAt(Instant.now());
        memberRepo.save(member);
        detachUser(orgId, userId);
    }

    /**
     * Clears {@code users.org_id} (when it still points at this org) and demotes TEACHER → STUDENT
     * when the user has no remaining ACTIVE teaching membership in any org.
     */
    private void detachUser(Long orgId, Long userId) {
        userRepository.findById(userId).ifPresent(user -> {
            if (orgId.equals(user.getOrgId())) {
                user.setOrgId(null);
            }
            if (isStaffPlatformRole(user.getRole())
                    && !memberRepo.existsByIdUserIdAndRoleInAndStatus(userId, STAFF_ROLES, STATUS_ACTIVE)) {
                log.info("Demoting user {} to STUDENT — no remaining active staff membership", userId);
                user.setRole(User.Role.STUDENT);
            }
            userRepository.save(user);
        });
    }

    /** Maps an org-membership role to the platform identity it grants. */
    private static User.Role platformRoleFor(String orgRole) {
        return switch (orgRole == null ? "" : orgRole.toUpperCase()) {
            case "OWNER" -> User.Role.OWNER;
            case "MANAGER" -> User.Role.MANAGER;
            case "TEACHER" -> User.Role.TEACHER;
            default -> User.Role.STUDENT;
        };
    }

    private static boolean isStaffPlatformRole(User.Role role) {
        return role == User.Role.OWNER || role == User.Role.MANAGER || role == User.Role.TEACHER;
    }

    /**
     * Keeps {@code users.role} in lock-step with the user's org role: OWNER/MANAGER/TEACHER map to the
     * matching platform identity. A platform ADMIN is never downgraded; joining as STUDENT never
     * overrides an existing staff identity (that is handled on detach).
     */
    private void syncPlatformRole(User user, String orgRole) {
        if (user.getRole() == User.Role.ADMIN) {
            return;
        }
        User.Role target = platformRoleFor(orgRole);
        if (target != User.Role.STUDENT && user.getRole() != target) {
            user.setRole(target);
        }
    }
}
