package com.deutschflow.organization.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.OrgMemberDto;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.repository.OrgAcademicApproverRepository;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
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
    private static final String ROLE_MANAGER = "MANAGER";
    private static final String ROLE_STUDENT = "STUDENT";
    /** Org-admin / teaching roles whose holders keep a non-STUDENT platform identity while active. */
    private static final Set<String> STAFF_ROLES = Set.of("OWNER", "MANAGER", "TEACHER");
    /** Roles an OWNER may toggle a staff member between (no OWNER, no STUDENT here). */
    private static final Set<String> ASSIGNABLE_ROLES = Set.of("MANAGER", "TEACHER");

    private final OrgMemberRepository memberRepo;
    private final OrgAcademicApproverRepository academicApproverRepo;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;
    private final AuditLogService auditLogService;

    /**
     * True if the user currently holds an ACTIVE membership in any org. Callers use this to route
     * a platform-role change through the org flow instead of overwriting {@code users.role} directly
     * (which would leave {@code org_members.role} out of sync).
     */
    public boolean hasActiveMembership(Long userId) {
        return memberRepo.existsByIdUserIdAndStatus(userId, STATUS_ACTIVE);
    }

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
     * Bảo đảm học viên có ghế STUDENT ACTIVE trong tổ chức {@code orgId} — cửa vào cho đường
     * "vào trung tâm qua lớp học" (học viên nhập mã lớp, giáo viên duyệt). Đường duyệt lớp trước
     * đây chỉ tạo {@code class_students} mà không đụng {@code org_members}, nên trung tâm có lớp
     * đầy học viên trong khi trang "Học viên của tổ chức" đếm 0 và ghế không bị tính tiền.
     *
     * <p>Đã là thành viên ACTIVE của chính org này (bất kỳ vai trò) → no-op: giáo viên/quản lý của
     * trung tâm vào một lớp không bị hạ xuống STUDENT. Đang ACTIVE ở org KHÁC → từ chối: move-semantics
     * của STUDENT chỉ dành cho roster do org chủ động ghi (import/thêm tay), không re-home âm thầm
     * chỉ vì học viên gõ một mã lớp. Trường hợp còn lại đi qua {@link #upsertMember} nên chịu đủ
     * seat-limit gate — hết ghế thì lượt duyệt thất bại với thông báo rõ ràng.
     */
    @Transactional
    public void ensureStudentSeat(Long orgId, Long userId) {
        boolean activeInThisOrg = memberRepo.findByIdOrgIdAndIdUserId(orgId, userId)
                .filter(m -> STATUS_ACTIVE.equals(m.getStatus()))
                .isPresent();
        if (activeInThisOrg) {
            return;
        }
        if (memberRepo.existsByIdUserIdAndStatusAndIdOrgIdNot(userId, STATUS_ACTIVE, orgId)) {
            throw new BadRequestException(
                    "Học viên đang thuộc một trung tâm khác — không thể thêm vào trung tâm này qua lớp học.");
        }
        upsertMember(orgId, userId, ROLE_STUDENT);
    }

    /**
     * Admin-initiated removal: marks the membership REVOKED (stamps {@code left_at}) and detaches
     * the user (clears {@code users.org_id}, demotes TEACHER → STUDENT when no active teaching
     * membership remains).
     */
    @Transactional
    public void removeMember(Long orgId, Long userId, AuditActor actor) {
        String role = deactivate(orgId, userId, STATUS_REVOKED);
        audit("org_member_removed", actor, orgId, userId, meta("role", role, "status", STATUS_REVOKED));
    }

    /**
     * Member-initiated leave: marks the membership LEFT (stamps {@code left_at}) and detaches the
     * user. The OWNER cannot self-leave (ownership must be transferred first).
     *
     * @throws ForbiddenException  if the user is not an ACTIVE member of the org
     * @throws BadRequestException if the caller is the OWNER
     */
    @Transactional
    public void selfLeave(Long orgId, AuditActor actor) {
        Long userId = actor.id();
        OrgMember member = memberRepo.findByIdOrgIdAndIdUserId(orgId, userId)
                .filter(m -> STATUS_ACTIVE.equals(m.getStatus()))
                .orElseThrow(() -> new ForbiddenException("Bạn không thuộc tổ chức này."));
        if (ROLE_OWNER.equals(member.getRole())) {
            throw new BadRequestException("Chủ sở hữu không thể tự rời — hãy chuyển quyền sở hữu trước.");
        }
        String role = member.getRole();
        member.setStatus(STATUS_LEFT);
        member.setLeftAt(Instant.now());
        memberRepo.save(member);
        detachUser(orgId, userId);
        audit("org_member_left", actor, orgId, userId, meta("role", role, "status", STATUS_LEFT));
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
    public OrgMemberDto changeRole(Long orgId, Long targetUserId, String newRole, AuditActor actor) {
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
        String previousRole = member.getRole();
        member.setRole(role);
        memberRepo.save(member);

        User u = userRepository.findById(targetUserId).orElse(null);
        if (u != null) {
            syncPlatformRole(u, role);   // MANAGER ↔ TEACHER also flips the platform identity
            userRepository.save(u);
        }
        audit("org_member_role_changed", actor, orgId, targetUserId, meta("from", previousRole, "to", role));
        return toDto(targetUserId, u, member);
    }

    /**
     * Transfers org ownership: promotes an ACTIVE staff member ({@code newOwnerUserId}) to OWNER and
     * demotes the current OWNER ({@code currentOwnerUserId}) to MANAGER — atomically, in one
     * transaction. Caller authorization (OWNER-only) is enforced upstream by
     * {@code OrgGuard.assertOrgOwner}.
     *
     * <p>This is the ONLY path that (re)creates an OWNER from inside the tenant, and it is the
     * recovery path for owner removal: since {@link #removeMember} and {@link #selfLeave} both refuse
     * to touch an OWNER, an owner leaves an org by first transferring ownership, then being removed as
     * a MANAGER. Because the promotion and demotion happen together, the org always retains exactly
     * one ACTIVE OWNER — never zero (the last-owner invariant).
     *
     * @throws ForbiddenException  if the caller is not the ACTIVE OWNER of the org
     * @throws NotFoundException   if the target is not a member of the org
     * @throws BadRequestException if the target is the caller, or is not an ACTIVE staff member
     */
    @Transactional
    public OrgMemberDto transferOwnership(Long orgId, AuditActor actor, Long newOwnerUserId) {
        Long currentOwnerUserId = actor.id();
        if (currentOwnerUserId.equals(newOwnerUserId)) {
            throw new BadRequestException("Chủ sở hữu mới phải khác chủ sở hữu hiện tại.");
        }

        OrgMember currentOwner = memberRepo.findByIdOrgIdAndIdUserId(orgId, currentOwnerUserId)
                .filter(m -> STATUS_ACTIVE.equals(m.getStatus()))
                .orElseThrow(() -> new ForbiddenException("Bạn không thuộc tổ chức này."));
        if (!ROLE_OWNER.equals(currentOwner.getRole())) {
            throw new ForbiddenException("Chỉ chủ sở hữu hiện tại mới chuyển được quyền sở hữu.");
        }

        OrgMember newOwner = memberRepo.findByIdOrgIdAndIdUserId(orgId, newOwnerUserId)
                .filter(m -> STATUS_ACTIVE.equals(m.getStatus()))
                .orElseThrow(() -> new NotFoundException("Người nhận quyền không thuộc tổ chức hoặc không hoạt động."));
        if (!STAFF_ROLES.contains(newOwner.getRole())) {
            throw new BadRequestException("Chỉ có thể chuyển quyền sở hữu cho quản lý hoặc giáo viên.");
        }

        // Atomic swap: promote the target and demote the current owner in the same transaction, so
        // the org never momentarily loses its owner. The new owner keeps the org's single OWNER seat.
        newOwner.setRole(ROLE_OWNER);
        currentOwner.setRole(ROLE_MANAGER);
        memberRepo.save(newOwner);
        memberRepo.save(currentOwner);

        User newOwnerUser = userRepository.findById(newOwnerUserId).orElse(null);
        if (newOwnerUser != null) {
            syncPlatformRole(newOwnerUser, ROLE_OWNER);
            userRepository.save(newOwnerUser);
        }
        userRepository.findById(currentOwnerUserId).ifPresent(u -> {
            syncPlatformRole(u, ROLE_MANAGER);  // OWNER → MANAGER platform identity
            userRepository.save(u);
        });

        // Vết ghi trên chính tổ chức, không phải trên một thành viên: đây là lần đổi chủ của org.
        audit("org_ownership_transferred", actor, orgId, null,
                meta("fromUserId", currentOwnerUserId, "toUserId", newOwnerUserId));
        return toDto(newOwnerUserId, newOwnerUser, newOwner);
    }

    /** Counts ACTIVE OWNERs in the org — supports the "an org always has an owner" invariant. */
    @Transactional(readOnly = true)
    public long countActiveOwners(Long orgId) {
        return memberRepo.countByIdOrgIdAndRoleAndStatus(orgId, ROLE_OWNER, STATUS_ACTIVE);
    }

    // ----------------------------------------------------------------- internals

    /**
     * Vết cho một thay đổi thành viên.
     *
     * <p><b>Cố ý KHÔNG đặt trong {@link #upsertMember}</b> dù đó là cửa vào chung của mọi đường thêm
     * thành viên: cùng một lệnh upsert phục vụ bốn câu chuyện khác hẳn nhau — org-admin tạo giáo
     * viên, import CSV, người được mời tự bấm nhận lời, và admin nền tảng dựng org — với bốn loại
     * actor khác nhau, một trong số đó còn không có principal. Gộp cả bốn vào một event name thì vết
     * đọc lên vô nghĩa, nên mỗi đường tự ghi vết của mình tại call-site nghiệp vụ.
     */
    private void audit(String event, AuditActor actor, Long orgId, Long targetUserId,
                       Map<String, Object> extra) {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("orgId", orgId);
        if (targetUserId != null) {
            meta.put("targetUserId", targetUserId);
        }
        meta.putAll(extra);
        auditLogService.log(event, actor,
                targetUserId != null ? "ORG_MEMBER" : "ORG",
                String.valueOf(targetUserId != null ? targetUserId : orgId),
                meta);
    }

    private static Map<String, Object> meta(String k1, Object v1, String k2, Object v2) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put(k1, v1);
        m.put(k2, v2);
        return m;
    }

    private OrgMemberDto toDto(Long userId, User user, OrgMember member) {
        return new OrgMemberDto(
                userId,
                user != null ? user.getEmail() : null,
                user != null ? user.getDisplayName() : null,
                member.getRole(),
                member.getStatus(),
                member.getJoinedAt());
    }

    private String deactivate(Long orgId, Long userId, String status) {
        OrgMember member = memberRepo.findByIdOrgIdAndIdUserId(orgId, userId)
                .orElseThrow(() -> new NotFoundException("Thành viên không tồn tại trong tổ chức."));
        // Owner-protection (mirrors selfLeave/changeRole): the OWNER is NEVER removed through the
        // admin member-remove path. Without this, a MANAGER — who also passes OrgGuard.assertOrgAdmin
        // — could revoke the OWNER's membership and seize de-facto control of the org. This is also
        // the last-owner invariant guard: because ownership only ever *moves* via transferOwnership
        // (an atomic promote+demote), refusing every OWNER removal here guarantees the org can never
        // reach zero ACTIVE OWNERs. To remove an ex-owner, first transfer ownership, then remove them
        // as a MANAGER.
        if (ROLE_OWNER.equals(member.getRole())) {
            throw new BadRequestException(
                    "Không thể gỡ chủ sở hữu khỏi tổ chức — hãy chuyển quyền sở hữu cho người khác trước.");
        }
        String role = member.getRole();
        member.setStatus(status);
        member.setLeftAt(Instant.now());
        memberRepo.save(member);
        // Security H1 (PR-2): quyền duyệt học vụ không sống lâu hơn tư cách thành viên — thu hồi
        // soft mọi phân công đang hiệu lực, để nếu người này quay lại org (ví dụ ensureStudentSeat
        // tái kích hoạt membership với vai trò STUDENT) thì phân công cũ KHÔNG sống lại theo.
        academicApproverRepo.revokeAllActiveFor(orgId, userId, java.time.LocalDateTime.now(), null);
        detachUser(orgId, userId);
        return role;
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
