package com.deutschflow.organization.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.exception.PrivilegedActionBlockedException;
import com.deutschflow.organization.dto.OrgMemberDto;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.repository.OrgAcademicApproverRepository;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.RefreshTokenRepository;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
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

    /**
     * Vết "đã cắt phiên đăng nhập" — một dòng cho MỖI người bị thu hồi, ngay sau dòng nghiệp vụ
     * gây ra nó ({@code org_member_removed}, {@code org_member_left}, …), cùng transaction.
     * Metadata chỉ mang id và số lượng ({@code reason}, {@code revokedCount}); không email, không tên.
     */
    static final String EVENT_SESSIONS_REVOKED = "org_member_sessions_revoked";
    static final String REVOKE_REASON_REMOVED = "removed";
    static final String REVOKE_REASON_LEFT = "left";
    static final String REVOKE_REASON_ROLE_CHANGED = "role_changed";
    static final String REVOKE_REASON_OWNERSHIP_TRANSFERRED = "ownership_transferred";
    static final String REVOKE_REASON_OWNERSHIP_FORCED = "ownership_forced";

    private final OrgMemberRepository memberRepo;
    private final OrgAcademicApproverRepository academicApproverRepo;
    private final ClassStudentRepository classStudentRepository;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;
    private final AuditLogService auditLogService;
    private final OrganizationRepository organizationRepository;
    private final OrgEntitlementService orgEntitlementService;
    private final RefreshTokenRepository refreshTokenRepository;

    /**
     * True if the user currently holds an ACTIVE membership in any org. Callers use this to route
     * a platform-role change through the org flow instead of overwriting {@code users.role} directly
     * (which would leave {@code org_members.role} out of sync).
     */
    public boolean hasActiveMembership(Long userId) {
        return memberRepo.existsByIdUserIdAndStatus(userId, STATUS_ACTIVE);
    }

    /**
     * Thành viên ACTIVE ở trung tâm KHÁC của một người dùng, kèm tên trung tâm đó — để thông báo
     * chặn của F4 nói được "đang thuộc trung tâm A" thay vì "một tổ chức khác".
     *
     * @param orgName tên trung tâm kia; {@code null} nếu dòng org đã biến mất (lỗi dữ liệu, không
     *                phải trạng thái nghiệp vụ) — người gọi tự lùi về câu chung
     */
    public record ActiveElsewhere(Long orgId, String orgName, String role) {}

    /**
     * Người dùng có đang là thành viên ACTIVE của một trung tâm KHÁC {@code orgId} không (F4, owner
     * chốt 10/09/2026). Bản đọc-được của chốt trong {@link #upsertMember}: đường CSV gọi hàm này
     * TRƯỚC khi ghi để trả về thông báo dòng có tên trung tâm, thay vì để {@code ConflictException}
     * rơi vào "lỗi xử lý" chung.
     */
    @Transactional(readOnly = true)
    public Optional<ActiveElsewhere> activeMembershipElsewhere(Long userId, Long orgId) {
        return memberRepo.findFirstByIdUserIdAndStatusAndIdOrgIdNot(userId, STATUS_ACTIVE, orgId)
                .map(m -> new ActiveElsewhere(
                        m.getId().getOrgId(),
                        organizationRepository.findById(m.getId().getOrgId())
                                .map(org -> org.getName()).orElse(null),
                        m.getRole()));
    }

    /**
     * Inserts a new org membership or reactivates an existing one, sets {@code users.org_id},
     * and promotes a global STUDENT to TEACHER when joining as MANAGER/TEACHER.
     *
     * <p>Enforces "1 người – 1 trung tâm ACTIVE" cho MỌI vai. Trước F4 (owner chốt 10/09/2026) chỉ
     * nhân sự bị chặn còn STUDENT giữ "move-semantics" — nhập CSV ở trung tâm B lặng lẽ kéo một học
     * viên đang học ở trung tâm A sang B: A mất học viên khỏi danh sách mà không ai ở A được báo,
     * ghế và gói của A vẫn tính, và với học viên chưa thành niên thì hồ sơ giám hộ/đồng ý do A thu
     * bỗng nằm dưới quyền đọc của B. Nay: đang ACTIVE ở trung tâm khác ⇒ {@link ConflictException}
     * nêu TÊN trung tâm đó; phải rời (hoặc được gỡ khỏi) trung tâm cũ trước. Đường mã lớp
     * ({@link #ensureStudentSeat}) đã chặn sẵn với thông báo riêng và chạy TRƯỚC hàm này.
     */
    @Transactional
    public void upsertMember(Long orgId, Long userId, String role) {
        // DEC-13 (owner chốt 09/09/2026): ADMIN NỀN TẢNG KHÔNG BAO GIỜ LÀ THÀNH VIÊN TRUNG TÂM.
        // Đặt ở chokepoint này chứ không ở AdminOrgService.addMember vì `org_members` chỉ được
        // INSERT ở đúng đây và `users.org_id` chỉ được ghi ở đúng đây — 9 điểm gọi phía trên
        // (addMember, attachOwner ×2, nhận lời mời, preCreateTeacher, nhập CSV, admin tạo user,
        // và ensureStudentSeat từ đường giáo viên duyệt yêu cầu vào lớp) đều chảy qua.
        //
        // Vì sao là lỗ chặn pilot chứ không phải sạch sẽ lý thuyết: một dòng org_members là TOÀN BỘ
        // điều kiện để vào 9 controller /api/org/** (chúng chỉ khai `isAuthenticated()` ở cấp lớp,
        // phân quyền thật nằm ở OrgGuard đọc org_members), trong khi syncPlatformRole bên dưới CỐ Ý
        // giữ nguyên users.role = ADMIN. Người đó vừa giữ trọn /api/admin/**, vừa đi qua
        // assertOrgAdmin/assertOrgOwner như người của trung tâm. Hai hệ quả kéo theo:
        // OrgQuotaService.resolveActiveMembership không lọc users.role nên mọi lượt dùng AI của
        // admin bị trừ vào pool token của trung tâm; và AuthService nhét orgRole vào access token
        // nên web coi admin là người của trung tâm.
        //
        // orElse(null) chứ KHÔNG orElseThrow: guard này chạy TRƯỚC mọi guard khác, và các unit test
        // hiện có chỉ stub findById cho nhánh đi tới cuối hàm — orElseThrow ở đây sẽ đổi loại
        // exception của những ca đó từ ConflictException/BadRequestException sang NoSuchElement.
        User target = userRepository.findById(userId).orElse(null);
        if (target != null && target.getRole() == User.Role.ADMIN) {
            throw new PrivilegedActionBlockedException(
                    "Quản trị viên nền tảng không được là thành viên trung tâm.",
                    "org.admin_membership.blocked", "ORG", String.valueOf(orgId),
                    Map.of("reason", "platform_admin", "targetUserId", userId, "requestedRole", role));
        }

        // F4: áp cho CẢ STUDENT (xem javadoc). existsBy… trước rồi mới tra tên: đường thuận không tốn
        // thêm truy vấn nào, đường chặn mới đi tìm tên trung tâm để câu báo lỗi đọc được.
        if (memberRepo.existsByIdUserIdAndStatusAndIdOrgIdNot(userId, STATUS_ACTIVE, orgId)) {
            throw new ConflictException(activeElsewhereMessage(userId, orgId));
        }

        Optional<OrgMember> existingOpt = memberRepo.findByIdOrgIdAndIdUserId(orgId, userId);

        // Audit R-M1/R-M3 (03/09/2026): bất biến "một org đúng một OWNER ACTIVE" đặt tại CHOKEPOINT
        // chung này — không chỉ ở AdminOrgService.addMember — nên đường nhận-lời-mời và mọi caller
        // khác đều chịu chung. upsertMember vốn ghi đè vai trò vô điều kiện, để hở hai lỗ:
        //   (R-M1) nhận một lời mời TEACHER cũ có thể hạ role của một OWNER đang hoạt động xuống
        //          TEACHER (comment "upsert never downgrades platform role" chỉ đúng với ADMIN);
        //   (R-M3) hai lượt thêm-OWNER chạy song song cùng đọc countActiveOwners()==0 rồi cùng ghi
        //          → 2 OWNER (TOCTOU).
        // transferOwnership/changeRole đổi chủ trên đường riêng, KHÔNG đi qua đây.
        boolean existingIsActiveOwner = existingOpt
                .filter(m -> STATUS_ACTIVE.equals(m.getStatus()))
                .map(m -> ROLE_OWNER.equals(m.getRole()))
                .orElse(false);
        if (ROLE_OWNER.equals(role) || existingIsActiveOwner) {
            // Khóa dòng org để mọi thay đổi quyền sở hữu cùng org tuần tự hóa (đóng TOCTOU mà một
            // phép đọc countActiveOwners() trần để hở) — cùng cơ chế FOR UPDATE với seat-gate dưới.
            jdbcTemplate.query("SELECT id FROM organizations WHERE id = ? FOR UPDATE",
                    rs -> rs.next() ? rs.getLong(1) : null, orgId);
            // Audit R-M9: subtype mang chất liệu audit — GlobalExceptionHandler ghi vết SAU rollback.
            // Chokepoint này còn hứng cả đường KHÔNG-admin (nhận lời mời): actor khi đó là null/ẩn
            // danh, meta vẫn mang đủ (orgId, userId, role xin) để nhận diện lần thử.
            if (existingIsActiveOwner && !ROLE_OWNER.equals(role)) {
                throw new PrivilegedActionBlockedException(
                        "Không thể hạ vai trò của chủ sở hữu — hãy chuyển quyền sở hữu cho người khác trước.",
                        "org.owner_invariant.blocked", "ORG", String.valueOf(orgId),
                        Map.of("reason", "demote_owner", "targetUserId", userId, "requestedRole", role));
            }
            if (ROLE_OWNER.equals(role) && !existingIsActiveOwner && countActiveOwners(orgId) > 0) {
                throw new PrivilegedActionBlockedException(
                        "Tổ chức đã có chủ sở hữu — mỗi tổ chức chỉ một OWNER. Hãy dùng chuyển quyền sở hữu.",
                        "org.owner_invariant.blocked", "ORG", String.valueOf(orgId),
                        Map.of("reason", "second_owner", "targetUserId", userId, "requestedRole", role));
            }
        }

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

        // Dùng lại `target` đã nạp ở guard DEC-13 đầu hàm — một lượt findById cho cả hai việc.
        // Nhánh null giữ nguyên ngữ nghĩa cũ (NoSuchElementException khi userId không tồn tại).
        User user = target != null ? target : userRepository.findById(userId).orElseThrow();
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
     * trung tâm vào một lớp không bị hạ xuống STUDENT. Đang ACTIVE ở org KHÁC → từ chối với câu nói
     * cho giáo viên hiểu ngay (chốt này có từ trước F4; từ F4 thì {@link #upsertMember} cũng chặn
     * STUDENT ở mọi đường, và vì hàm này chặn TRƯỚC nên không có hai thông báo chồng nhau). Trường
     * hợp còn lại đi qua {@link #upsertMember} nên chịu đủ seat-limit gate — hết ghế thì lượt duyệt
     * thất bại với thông báo rõ ràng.
     *
     * <p>V-05: sau khi có ghế thì CẤP LUÔN gói của trung tâm, đúng như đường org chủ động thêm
     * ({@code OrgRosterRowImporter} và {@code AdminOrgService.addMember} đều gọi
     * {@link OrgEntitlementService#grantStudent} ngay sau {@link #upsertMember}). Thiếu bước này thì
     * học viên vào lớp bằng mã mời CHIẾM một ghế có tính tiền của trung tâm nhưng vẫn bị chặn hạn
     * mức như người dùng miễn phí. Nhánh no-op phía trên đã {@code return} nên không cấp gói hai lần.
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
        // DEC-13: đây là đường kết nạp DỄ SÓT NHẤT — không qua console admin, không qua CSV, không
        // qua lời mời: một giáo viên bất kỳ bấm "Duyệt" cho yêu cầu vào lớp của một tài khoản tình
        // cờ là ADMIN nền tảng cũng kết nạp được người đó. upsertMember bên dưới đã chặn, nhưng nó
        // ném giữa @Transactional của TeacherService.approveJoinRequest với thông báo không nói
        // được giáo viên phải làm gì. Chặn sớm ở đây với câu nói rõ.
        userRepository.findById(userId)
                .filter(u -> u.getRole() == User.Role.ADMIN)
                .ifPresent(u -> {
                    throw new PrivilegedActionBlockedException(
                            "Tài khoản này là quản trị viên nền tảng — không thể nhận vào lớp của trung tâm.",
                            "org.admin_membership.blocked", "ORG", String.valueOf(orgId),
                            Map.of("reason", "platform_admin_join_class", "targetUserId", userId));
                });
        upsertMember(orgId, userId, ROLE_STUDENT);
        organizationRepository.findById(orgId)
                .ifPresent(org -> orgEntitlementService.grantStudent(userId, org));
    }

    /**
     * Admin-initiated removal: marks the membership REVOKED (stamps {@code left_at}) and detaches
     * the user (clears {@code users.org_id}, demotes TEACHER → STUDENT when no active teaching
     * membership remains).
     *
     * <p>OWNER không bao giờ bị gỡ qua đây; MANAGER chỉ OWNER mới gỡ được (V-14).
     *
     * <p>Gỡ xong là CẮT PHIÊN (Gói 2): mọi refresh token của người bị gỡ bị thu hồi — xem
     * {@link #revokeSessions}.
     */
    @Transactional
    public void removeMember(Long orgId, Long userId, AuditActor actor) {
        String role = deactivate(orgId, userId, STATUS_REVOKED, actor);
        audit("org_member_removed", actor, orgId, userId, meta("role", role, "status", STATUS_REVOKED));
        revokeSessions(orgId, userId, REVOKE_REASON_REMOVED, actor);
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
        closeOrgFootprint(orgId, userId);
        detachUser(orgId, userId);
        audit("org_member_left", actor, orgId, userId, meta("role", role, "status", STATUS_LEFT));
        // Tự rời cũng cắt phiên: access token đang cầm còn mang orgId/orgRole của trung tâm vừa rời.
        revokeSessions(orgId, userId, REVOKE_REASON_LEFT, actor);
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
        // Đổi vai cả hai chiều đều cắt phiên: MANAGER → TEACHER mất quyền quản trị NGAY chứ không
        // đợi hết vòng đời refresh token; TEACHER → MANAGER thì token cũ thiếu quyền, đăng nhập lại
        // mới nhận đúng vai.
        revokeSessions(orgId, targetUserId, REVOKE_REASON_ROLE_CHANGED, actor);
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
        User newOwnerUser = moveOwnerSeat(orgId, newOwner, List.of(currentOwner));

        // Vết ghi trên chính tổ chức, không phải trên một thành viên: đây là lần đổi chủ của org.
        audit("org_ownership_transferred", actor, orgId, null,
                meta("fromUserId", currentOwnerUserId, "toUserId", newOwnerUserId));
        // Cả hai bên đổi vai → cả hai đăng nhập lại: chủ cũ không giữ được orgRole=OWNER trong token
        // đang cầm, chủ mới không kẹt ở token MANAGER/TEACHER.
        revokeSessions(orgId, newOwnerUserId, REVOKE_REASON_OWNERSHIP_TRANSFERRED, actor);
        revokeSessions(orgId, currentOwnerUserId, REVOKE_REASON_OWNERSHIP_TRANSFERRED, actor);
        return toDto(newOwnerUserId, newOwnerUser, newOwner);
    }

    /**
     * Kết quả một lần admin nền tảng ÉP đổi giám đốc: ai vừa lên OWNER và những OWNER ACTIVE nào
     * vừa bị hạ xuống MANAGER — 0, 1 hoặc nhiều; 0 chính là ca khôi phục (trung tâm mất giám đốc).
     */
    public record ForcedOwnership(OrgMemberDto newOwner, List<Long> demotedOwnerUserIds) {
    }

    /**
     * Đường KHÔI PHỤC quyền giám đốc của admin nền tảng (DEC-13 / A6, owner chốt 10/09/2026):
     * đặt {@code newOwnerUserId} làm OWNER duy nhất của trung tâm, hạ MỌI OWNER ACTIVE hiện tại
     * xuống MANAGER — khác {@link #transferOwnership} ở ba điểm cố ý:
     *
     * <ul>
     *   <li><b>Không cần chủ cũ.</b> transferOwnership chỉ chính OWNER gọi được, nên khi giám đốc
     *       mất tài khoản / nghỉ việc không bàn giao thì trung tâm khoá cứng; trước bản này đường
     *       thực tế duy nhất là admin đặt lại mật khẩu rồi MẠO DANH giám đốc — và sổ ghi actor là
     *       chính giám đốc. Ở đây actor là admin, đúng người bấm.</li>
     *   <li><b>Chịu được trạng thái xấu.</b> Trung tâm 0 OWNER (dữ liệu cũ trước guard 1-OWNER, hoặc
     *       tài khoản giám đốc bị xoá) và trung tâm nhiều OWNER (dữ liệu cũ) đều được đưa về đúng
     *       một OWNER. Gọi lại lần hai là no-op có vết: người đó đã là OWNER thì không ai bị hạ.</li>
     *   <li><b>Lý do bắt buộc vào vết.</b> Thay chủ một tenant không cần chủ cũ đồng ý là thao tác
     *       nặng nhất console admin có; {@code reason} đi nguyên văn vào metadata để giám đốc mới
     *       (và cũ) đọc được vì sao.</li>
     * </ul>
     *
     * <p>Vết {@code admin.org.owner.forced} ghi Ở ĐÂY, cùng transaction với mutation (thất bại là
     * mất cả hai) và với {@code touchedOrgId = orgId} để sổ của trung tâm đọc lên được — admin không
     * thuộc trung tâm nào nên đường suy-từ-actor sẽ rơi vào org NULL. Không phát thêm
     * {@code org_ownership_transferred}: một thao tác, một dòng sổ.
     *
     * <p>Guard ADMIN-không-làm-thành-viên và validation lý do nằm ở {@code AdminOrgService.forceOwner}
     * — lớp gọi duy nhất; ở đây giữ bất biến thành viên VÀ cắt phiên của chủ mới lẫn mọi chủ cũ
     * (Gói 2: mọi đường đổi vai/gỡ thành viên thu hồi phiên tại MỘT chỗ, xem {@link #revokeSessions}).
     *
     * @throws BadRequestException nếu người được chỉ định không phải thành viên ACTIVE, hoặc là STUDENT
     */
    @Transactional
    public ForcedOwnership forceOwnership(AuditActor actor, Long orgId, Long newOwnerUserId, String reason) {
        // Khoá dòng org: mọi thay đổi quyền sở hữu của cùng trung tâm tuần tự hoá (cùng cơ chế
        // FOR UPDATE với upsertMember) — hai lệnh ép chạy song song không cùng đọc "0 OWNER" rồi
        // cùng ghi ra hai OWNER.
        jdbcTemplate.query("SELECT id FROM organizations WHERE id = ? FOR UPDATE",
                rs -> rs.next() ? rs.getLong(1) : null, orgId);

        OrgMember newOwner = memberRepo.findByIdOrgIdAndIdUserId(orgId, newOwnerUserId)
                .filter(m -> STATUS_ACTIVE.equals(m.getStatus()))
                .orElseThrow(() -> new BadRequestException(
                        "Người được chỉ định phải là thành viên đang hoạt động của trung tâm này."));
        if (!STAFF_ROLES.contains(newOwner.getRole())) {
            throw new BadRequestException(
                    "Chỉ chỉ định được quản lý hoặc giáo viên làm giám đốc — học viên không nhận vai này.");
        }

        List<OrgMember> currentOwners = memberRepo
                .findByIdOrgIdAndRoleAndStatus(orgId, ROLE_OWNER, STATUS_ACTIVE).stream()
                .filter(m -> !newOwnerUserId.equals(m.getId().getUserId()))
                .toList();
        User newOwnerUser = moveOwnerSeat(orgId, newOwner, currentOwners);

        List<Long> demoted = new ArrayList<>();
        for (OrgMember old : currentOwners) {
            demoted.add(old.getId().getUserId());
        }
        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("newOwnerUserId", newOwnerUserId);
        extra.put("previousOwnerUserIds", List.copyOf(demoted));
        extra.put("reason", reason);
        audit("admin.org.owner.forced", actor, orgId, null, extra);
        revokeSessions(orgId, newOwnerUserId, REVOKE_REASON_OWNERSHIP_FORCED, actor);
        for (Long previousOwnerId : demoted) {
            revokeSessions(orgId, previousOwnerId, REVOKE_REASON_OWNERSHIP_FORCED, actor);
        }
        return new ForcedOwnership(toDto(newOwnerUserId, newOwnerUser, newOwner), List.copyOf(demoted));
    }

    /** Counts ACTIVE OWNERs in the org — supports the "an org always has an owner" invariant. */
    @Transactional(readOnly = true)
    public long countActiveOwners(Long orgId) {
        return memberRepo.countByIdOrgIdAndRoleAndStatus(orgId, ROLE_OWNER, STATUS_ACTIVE);
    }

    // ----------------------------------------------------------------- internals

    /**
     * Câu báo chặn của F4 — nêu TÊN trung tâm kia khi tra được. Dùng chung cho {@link #upsertMember}
     * và cho đường CSV ({@code OrgRosterRowImporter}) để hai chỗ không nói hai kiểu.
     */
    public String activeElsewhereMessage(Long userId, Long orgId) {
        return activeMembershipElsewhere(userId, orgId)
                .filter(other -> other.orgName() != null && !other.orgName().isBlank())
                .map(other -> "Người dùng đang là thành viên đang hoạt động của trung tâm \""
                        + other.orgName() + "\" — phải rời trung tâm đó trước khi vào trung tâm này.")
                .orElse("Người dùng đã là thành viên đang hoạt động của một tổ chức khác — phải rời tổ chức cũ trước.");
    }

    /**
     * Vết cho một thay đổi thành viên.
     *
     * <p><b>Cố ý KHÔNG đặt trong {@link #upsertMember}</b> dù đó là cửa vào chung của mọi đường thêm
     * thành viên: cùng một lệnh upsert phục vụ bốn câu chuyện khác hẳn nhau — org-admin tạo giáo
     * viên, import CSV, người được mời tự bấm nhận lời, và admin nền tảng dựng org — với bốn loại
     * actor khác nhau, một trong số đó còn không có principal. Gộp cả bốn vào một event name thì vết
     * đọc lên vô nghĩa, nên mỗi đường tự ghi vết của mình tại call-site nghiệp vụ.
     *
     * <p><b>DEC-13 — vì sao truyền {@code orgId} tường minh (một chỗ, phủ cả bốn sự kiện).</b> Đường
     * suy-từ-actor đọc {@code users.org_id} của NGƯỜI THAO TÁC, và ở đây nó sai theo hai kiểu khác
     * nhau. (1) {@code org_member_left}: người tự rời chính là actor, mà {@code detachUser} đã XOÁ
     * {@code users.org_id} của họ NGAY TRƯỚC lời gọi này — vết "đã rời trung tâm" rơi vào org NULL,
     * tức đúng cái vết mà giám đốc cần thì lại là vết duy nhất giám đốc không thấy. (2) admin nền
     * tảng gỡ/đổi vai qua console: actor không thuộc trung tâm nào. Tham số {@code orgId} thì luôn
     * là trung tâm bị tác động, do call-site truyền xuống trước khi bất cứ thứ gì bị gỡ.
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
                orgId,
                meta);
    }

    private static Map<String, Object> meta(String k1, Object v1, String k2, Object v2) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put(k1, v1);
        m.put(k2, v2);
        return m;
    }

    /**
     * Gói 2 (10/09/2026) — CẮT PHIÊN khi quyền trong trung tâm thay đổi: thu hồi mọi refresh token
     * của {@code userId} và ghi một dòng sổ {@link #EVENT_SESSIONS_REVOKED}.
     *
     * <p><b>Vì sao phải làm ở đây, không phải ở controller.</b> Gỡ khỏi trung tâm, tự rời, đổi vai,
     * chuyển/ép đổi chủ đều cắt quyền ở DB ngay, nhưng phiên đang đăng nhập thì không: access token
     * sống tới hết TTL ngắn ({@code app.jwt.access-token-expiry-ms}, mặc định 15 phút), còn refresh
     * token thì cấp lại được suốt 7 ngày — người vừa bị gỡ vẫn tự gia hạn phiên mà không phải đăng
     * nhập lại lần nào. Thu hồi refresh token là cắt đường gia hạn đó: quá 15 phút là bắt buộc đăng
     * nhập lại, và lúc ấy token mới mang đúng orgId/orgRole hiện tại. Đặt trong service, cùng
     * transaction với mutation thành viên, để KHÔNG đường gọi nào (OrgController, AdminOrgService,
     * đường tương lai) quên được bước này — đúng vai "nguồn sự thật duy nhất" của lớp này.
     *
     * <p>Sổ ghi {@code revokedCount} = số token THẬT vừa bị thu hồi (0 hợp lệ: người đó không có
     * phiên nào đang sống, ví dụ tài khoản chưa từng đăng nhập). Không có PII: chỉ id, lý do, số lượng.
     */
    private void revokeSessions(Long orgId, Long userId, String reason, AuditActor actor) {
        int revoked = refreshTokenRepository.revokeAllByUserId(userId);
        audit(EVENT_SESSIONS_REVOKED, actor, orgId, userId, meta("reason", reason, "revokedCount", revoked));
        log.info("[ORG] Revoked {} refresh token(s) of user {} in org {} — reason={}", revoked, userId, orgId, reason);
    }

    /**
     * Lõi chung của {@link #transferOwnership} và {@link #forceOwnership}: chuyển ghế OWNER sang
     * {@code newOwner}, hạ từng {@code currentOwners} xuống MANAGER — cả {@code org_members.role}
     * lẫn danh tính nền tảng {@code users.role} (OWNER ↔ MANAGER), trong CÙNG transaction của caller
     * nên trung tâm không có khoảnh khắc nào 0 hoặc 2 OWNER sau commit. Caller lo xác thực ai được
     * gọi và ghi vết; ở đây chỉ đổi vai.
     *
     * @return entity {@code users} của chủ mới (null nếu dòng users không còn — chỉ đổi org_members)
     */
    private User moveOwnerSeat(Long orgId, OrgMember newOwner, List<OrgMember> currentOwners) {
        newOwner.setRole(ROLE_OWNER);
        memberRepo.save(newOwner);
        for (OrgMember old : currentOwners) {
            old.setRole(ROLE_MANAGER);
            memberRepo.save(old);
        }

        User newOwnerUser = userRepository.findById(newOwner.getId().getUserId()).orElse(null);
        if (newOwnerUser != null) {
            newOwnerUser.setOrgId(orgId);   // bất biến users.org_id == org_members.org_id (ACTIVE)
            syncPlatformRole(newOwnerUser, ROLE_OWNER);
            userRepository.save(newOwnerUser);
        }
        for (OrgMember old : currentOwners) {
            userRepository.findById(old.getId().getUserId()).ifPresent(u -> {
                syncPlatformRole(u, ROLE_MANAGER);  // OWNER → MANAGER platform identity
                userRepository.save(u);
            });
        }
        return newOwnerUser;
    }

    private OrgMemberDto toDto(Long userId, User user, OrgMember member) {
        return new OrgMemberDto(
                userId,
                user != null ? user.getEmail() : null,
                user != null ? user.getDisplayName() : null,
                member.getRole(),
                member.getStatus(),
                member.getJoinedAt(),
                null); // D4 chỉ tính ở đường danh sách học viên (OrgService.toMemberDto)
    }

    private String deactivate(Long orgId, Long userId, String status, AuditActor actor) {
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
        // V-14: bất biến trên chỉ che OWNER, nên một MANAGER (cũng qua được OrgGuard.assertOrgAdmin)
        // gỡ được MỌI MANAGER khác — ban quản lý tự thanh trừng nhau mà giám đốc không hay biết.
        // Gỡ MANAGER là thao tác cấp chủ sở hữu: chỉ OWNER ĐANG HOẠT ĐỘNG của chính org này mới làm
        // được. Đường OWNER gỡ MANAGER không bị chặn; các vai còn lại (TEACHER, STUDENT) không đổi.
        if (ROLE_MANAGER.equals(member.getRole()) && !isActiveOwner(orgId, actor)) {
            throw new ForbiddenException(
                    "Chỉ chủ sở hữu mới được gỡ quản lý khỏi tổ chức.");
        }
        String role = member.getRole();
        member.setStatus(status);
        member.setLeftAt(Instant.now());
        memberRepo.save(member);
        closeOrgFootprint(orgId, userId);
        detachUser(orgId, userId);
        return role;
    }

    /**
     * G-03: mọi thứ phải TẮT khi một người thôi là thành viên trung tâm — dùng chung cho cả hai
     * đường ra (admin gỡ và tự rời), nên hai đường không thể lệch nhau nữa.
     *
     * <ul>
     *   <li><b>Quyền duyệt học vụ</b> (Security H1, PR-2): thu hồi soft mọi phân công đang hiệu lực,
     *       để nếu người này quay lại org (ví dụ {@code ensureStudentSeat} tái kích hoạt membership
     *       với vai trò STUDENT) thì phân công cũ KHÔNG sống lại theo. Trước bản này chỉ đường admin
     *       gọi, còn {@link #selfLeave} thì không — nợ đã ghi ở PR #617.</li>
     *   <li><b>Ghi danh lớp</b>: đóng mọi dòng {@code class_students} thuộc các lớp CỦA CHÍNH trung
     *       tâm này. Thiếu bước này thì người đã thôi học vẫn đọc được tài liệu, bài tập và kênh
     *       chat của lớp vô thời hạn, vì roster lớp không hề biết membership đã tắt. Lớp B2C của
     *       chính họ (org_id NULL) và lớp của trung tâm khác KHÔNG bị đụng tới.</li>
     * </ul>
     */
    private void closeOrgFootprint(Long orgId, Long userId) {
        academicApproverRepo.revokeAllActiveFor(orgId, userId, java.time.LocalDateTime.now(), null);
        classStudentRepository.endEnrollmentsInOrg(orgId, userId,
                java.time.LocalDateTime.now(), ClassStudent.END_REASON_LEFT_ORG);
    }

    /** True khi {@code actor} là OWNER ĐANG HOẠT ĐỘNG của org — đọc lại từ DB, không tin vai trong token. */
    private boolean isActiveOwner(Long orgId, AuditActor actor) {
        if (actor == null || actor.id() == null) {
            return false;
        }
        return memberRepo.findByIdOrgIdAndIdUserId(orgId, actor.id())
                .filter(m -> STATUS_ACTIVE.equals(m.getStatus()))
                .map(m -> ROLE_OWNER.equals(m.getRole()))
                .orElse(false);
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
     * matching platform identity. Joining as STUDENT never overrides an existing staff identity
     * (that is handled on detach).
     *
     * <p>Nhánh ADMIN bên dưới nay là phòng thủ theo tầng, KHÔNG còn là hành vi có chủ đích: từ
     * DEC-13 (09/09/2026) admin nền tảng bị chặn ngay đầu {@link #upsertMember} nên không đường
     * thành viên nào tới được đây với {@code role == ADMIN}. Giữ lại để một caller tương lai gọi
     * thẳng syncPlatformRole không âm thầm hạ vai admin — đừng đọc nó như "admin làm thành viên
     * được, chỉ là không bị hạ vai".
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
