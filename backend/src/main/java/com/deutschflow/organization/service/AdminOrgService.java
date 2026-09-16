package com.deutschflow.organization.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.exception.PrivilegedActionBlockedException;
import com.deutschflow.common.security.PasswordPolicy;
import com.deutschflow.organization.dto.AddMemberRequest;
import com.deutschflow.organization.dto.CreateOrgRequest;
import com.deutschflow.organization.dto.OrgDetailDto;
import com.deutschflow.organization.dto.OrgDto;
import com.deutschflow.organization.dto.OrgMemberDto;
import com.deutschflow.organization.dto.UpdateOrgRequest;
import com.deutschflow.organization.entity.OrgInvoice;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.notification.service.UserNotificationService;
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

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
    private final UserNotificationService userNotificationService;
    private final AuditLogService auditLogService;

    /** Lý do ép đổi giám đốc: đủ dài để đọc được trong sổ, đủ ngắn để không thành văn bản tuỳ ý. */
    static final int FORCE_OWNER_REASON_MIN = 10;
    static final int FORCE_OWNER_REASON_MAX = 500;

    /**
     * Creates an organization with a unique slug. If {@code ownerEmail} resolves to an existing
     * user, attaches them as OWNER (promoting STUDENT→TEACHER via membership service); otherwise
     * issues a pending invitation so the owner can self-register.
     */
    @Transactional
    public OrgDto createOrganization(CreateOrgRequest request, AuditActor actor) {
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

        // T-03: ghế âm không có nghĩa — 0 là "không giới hạn", nên clamp về 0 thay vì lưu số âm
        // rồi để mọi phép so sánh seat_limit > 0 hiểu ngầm thành không giới hạn.
        int seatLimit = request.seatLimit() == null ? 0 : Math.max(0, request.seatLimit());
        // T-03: hạn mức AI nhân sự đặt được ngay lúc tạo (xem CreateOrgRequest). Không truyền thì
        // giữ fail-safe cũ (pool=0, unlimited=false) — nhân sự bị 429 tới khi admin cấu hình.
        boolean poolUnlimited = Boolean.TRUE.equals(request.poolUnlimited());
        long monthlyTokenPool = request.monthlyTokenPool() == null ? 0L : Math.max(0L, request.monthlyTokenPool());
        Organization org = Organization.builder()
                .name(request.name().trim())
                .slug(slug)
                .planCode(normalizePlanCode(request.planCode()))
                .seatLimit(seatLimit)
                .status(STATUS_ACTIVE)
                .monthlyTokenPool(monthlyTokenPool)
                .poolUnlimited(poolUnlimited)
                .build();
        org = organizationRepository.save(org);

        attachOwner(actor, org.getId(), request.ownerEmail(), request.ownerName(), request.ownerPassword());

        // Audit F-M3 (03/09/2026): dựng một tổ chức mới là tạo ra một tenant — kèm gói, giới hạn
        // ghế và một tài khoản OWNER — mà trước đây không để lại vết nào.
        //
        // DEC-13: trung tâm BỊ TÁC ĐỘNG chính là trung tâm vừa dựng, truyền tường minh. Không
        // truyền thì vết suy org từ users.org_id của admin nền tảng — luôn NULL theo DEC-13 — nên
        // dòng đầu tiên trong lịch sử của một trung tâm lại là dòng giám đốc không bao giờ đọc được.
        auditLogService.log("admin.org.created", actor, "ORG", String.valueOf(org.getId()),
                org.getId(),
                Map.of(
                        "name", String.valueOf(org.getName()),
                        "slug", String.valueOf(org.getSlug()),
                        "planCode", String.valueOf(org.getPlanCode()),
                        "seatLimit", org.getSeatLimit(),
                        "ownerEmail", String.valueOf(request.ownerEmail()),
                        "monthlyTokenPool", org.getMonthlyTokenPool(),
                        "poolUnlimited", org.isPoolUnlimited()
                ));

        userNotificationService.onOrgCreated(org.getId(), org.getName(), org.getSlug());
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
                pendingInvites,
                org.getMonthlyTokenPool(),
                org.isPoolUnlimited(),
                org.getValidUntil(),
                org.getSuspendedAt()
        );
    }

    /**
     * Updates plan/seat-limit/status/licence-expiry/AI pool; only non-null fields are applied.
     *
     * <p>T-03 (10/09/2026): {@code seatLimit} clamp về 0 (0 = không giới hạn); {@code clearValidUntil}
     * đưa trung tâm về vô thời hạn; bật {@code poolUnlimited} giữ nguyên số pool; vết
     * {@code admin.org.updated} liệt kê trường đổi kèm giá trị cũ/mới và KHÔNG ghi khi không đổi gì.
     *
     * <p>Chuyển sang {@code SUSPENDED} đưa trung tâm vào chế độ CHỈ ĐỌC và đóng mốc neo ân hạn —
     * KHÔNG còn thu hồi quyền lợi học viên tại chỗ (owner chốt 09/09/2026, xem
     * {@link #applyStatusTransition}); việc CẮT khi quá ân hạn do {@code SubscriptionReconcileJob}
     * thi hành. Chuyển ngược về {@code ACTIVE} thì cấp lại quyền lợi ngay.
     */
    @Transactional
    public OrgDto updateOrganization(Long id, UpdateOrgRequest request, AuditActor actor) {
        Organization org = organizationRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tổ chức: " + id));
        if (request.status() != null && !VALID_ORG_STATUSES.contains(request.status())) {
            throw new BadRequestException("Trạng thái tổ chức không hợp lệ: " + request.status());
        }
        boolean clearValidUntil = Boolean.TRUE.equals(request.clearValidUntil());
        if (clearValidUntil && request.validUntil() != null) {
            throw new BadRequestException("Không thể vừa đặt hạn vừa xoá hạn giấy phép trong cùng một yêu cầu");
        }
        String previousStatus = org.getStatus();
        // T-03: từng trường đổi được ghi kèm giá trị cũ/mới — vết "admin đã sửa trung tâm" mà không
        // nói sửa GÌ thì giám đốc đọc sổ vẫn không trả lời được "ai hạ ghế của tôi từ 50 xuống 30".
        Map<String, Object> changes = new LinkedHashMap<>();
        if (request.planCode() != null) {
            String next = normalizePlanCode(request.planCode());
            recordChange(changes, "planCode", org.getPlanCode(), next);
            org.setPlanCode(next);
        }
        if (request.seatLimit() != null) {
            // T-03: trước đây gán thẳng — ghế ÂM lọt vào DB và mọi phép `seat_limit > 0` hiểu ngầm
            // thành "không giới hạn" mà không ai chủ ý. 0 mới là giá trị "không giới hạn" có tên.
            int next = Math.max(0, request.seatLimit());
            recordChange(changes, "seatLimit", org.getSeatLimit(), next);
            org.setSeatLimit(next);
        }
        if (clearValidUntil) {
            recordChange(changes, "validUntil", org.getValidUntil(), null);
            org.setValidUntil(null);
        } else if (request.validUntil() != null) {
            recordChange(changes, "validUntil", org.getValidUntil(), request.validUntil());
            org.setValidUntil(request.validUntil());
        }
        if (request.status() != null) {
            recordChange(changes, "status", previousStatus, request.status());
            org.changeStatus(request.status());
        }
        // M-5: pool giờ set được qua API (trước chỉ SQL tay). Clamp âm về 0.
        // T-03: hai cần gạt phải nhất quán — bật unlimited thì pool GIỮ NGUYÊN (số cũ còn đó để khi
        // tắt unlimited trung tâm trở lại đúng hạn mức trước, không rơi về 0 = bị chặn AI).
        if (Boolean.TRUE.equals(request.poolUnlimited())) {
            recordChange(changes, "poolUnlimited", org.isPoolUnlimited(), true);
            org.setPoolUnlimited(true);
        } else {
            if (request.poolUnlimited() != null) {
                recordChange(changes, "poolUnlimited", org.isPoolUnlimited(), false);
                org.setPoolUnlimited(false);
            }
            if (request.monthlyTokenPool() != null) {
                long next = Math.max(0L, request.monthlyTokenPool());
                recordChange(changes, "monthlyTokenPool", org.getMonthlyTokenPool(), next);
                org.setMonthlyTokenPool(next);
            }
        }
        org = organizationRepository.save(org);
        applyStatusTransition(org, previousStatus, request.status());
        if (changes.isEmpty()) {
            // Lưu mà không đổi gì (form bấm Lưu nguyên trạng, PATCH rỗng) thì không có gì để kể —
            // một dòng "đã cập nhật" trống trong sổ của giám đốc chỉ gây hoang mang.
            return toOrgDto(org);
        }
        // Audit F-M3 (03/09/2026): đây là chỗ đổi gói, giới hạn ghế, hạn dùng và hạn mức token của
        // cả một tổ chức — và một lần đổi status sang SUSPENDED sẽ khoá ghi CẢ trung tâm rồi khởi
        // động đồng hồ 7 ngày ân hạn, hết ân hạn là quyền lợi của MỌI học viên bị cắt.
        // Ghi cả trạng thái trước lẫn sau vì chính bước chuyển đó mới là thứ có hệ quả.
        // DEC-13: orgId của CHÍNH trung tâm bị đổi trạng thái — đây là vết mà giám đốc cần nhất
        // ("ai đã đình chỉ trung tâm tôi, lúc nào"), và cũng là vết mà đường suy-từ-actor bỏ sót
        // sạch vì người bấm là admin nền tảng.
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("fromStatus", String.valueOf(previousStatus));
        meta.put("toStatus", String.valueOf(org.getStatus()));
        meta.put("changedFields", new ArrayList<>(changes.keySet()));
        meta.put("changes", changes);
        auditLogService.log("admin.org.updated", actor, "ORG", String.valueOf(org.getId()),
                org.getId(), meta);
        return toOrgDto(org);
    }

    /**
     * Ghi một trường vào bản kê đổi khi giá trị THẬT SỰ khác. Chỉ số, chuỗi mã và mốc thời gian
     * (không PII). {@link Instant} chuyển thành chuỗi ISO để không phụ thuộc ObjectMapper của
     * {@code AuditLogService} có module thời gian hay không; {@code null} giữ nguyên là null
     * ("xoá hạn" phải đọc ra được là hạn trước đó → không còn hạn).
     */
    private static void recordChange(Map<String, Object> changes, String field, Object from, Object to) {
        if (Objects.equals(from, to)) {
            return;
        }
        Map<String, Object> change = new LinkedHashMap<>();
        change.put("from", from instanceof Instant i ? i.toString() : from);
        change.put("to", to instanceof Instant i ? i.toString() : to);
        changes.put(field, change);
    }

    /**
     * Cascades a status change to student entitlements.
     *
     * <p><b>Đình chỉ KHÔNG còn thu hồi quyền lợi ngay</b> (owner chốt 09/09/2026): trung tâm bị
     * đình chỉ rơi vào chế độ CHỈ ĐỌC — hết tạo mới, hết AI — nhưng học viên giữ gói thêm 7 ngày ân
     * hạn tính từ {@code suspended_at} do {@link Organization#changeStatus(String)} vừa đóng. Cắt
     * phăng tại giây bấm nút chính là hành vi owner bảo làm ngược. Việc CẮT khi quá ân hạn do
     * {@code SubscriptionReconcileJob} quét nền thi hành ({@link OrgLicenseState.Mode#CUT}) —
     * ở đây không có gì để làm vì mốc ân hạn chưa tới.
     *
     * <p>Mở lại thì cấp lại ngay, không đợi job: đó là thao tác người dùng đang chờ kết quả.
     * No-op when status is unchanged.
     */
    private void applyStatusTransition(Organization org, String previousStatus, String newStatus) {
        if (newStatus == null || newStatus.equals(previousStatus)) {
            return;
        }
        if (STATUS_SUSPENDED.equals(newStatus)) {
            log.info("[ORG-ADMIN] Đình chỉ trung tâm {}: chuyển CHỈ ĐỌC, giữ quyền lợi học viên đến"
                    + " hết {} ngày ân hạn kể từ {}",
                    org.getId(), OrgLicenseState.GRACE.toDays(), org.getSuspendedAt());
        } else if (STATUS_ACTIVE.equals(newStatus)) {
            List<OrgMember> students = orgMemberRepository
                    .findByIdOrgIdAndRoleAndStatus(org.getId(), ROLE_STUDENT, STATUS_ACTIVE);
            for (OrgMember member : students) {
                // Đường KHÔI PHỤC: không đi qua cổng D5. Admin bật lại status = ACTIVE nhưng
                // validUntil có thể vẫn còn quá hạn (chỉ đổi trạng thái, không gia hạn) — dùng
                // grantStudent ở đây thì chính thao tác bật lại bị chế độ chỉ đọc khoá và rollback.
                orgEntitlementService.grantStudentOnRestore(member.getId().getUserId(), org);
            }
            log.info("[ORG-ADMIN] Reactivated org {}: granted entitlements for {} student(s)",
                    org.getId(), students.size());
        }
    }

    /** Active members of the org (OWNER/MANAGER/TEACHER/STUDENT), with user email + display name. */
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

    /**
     * Manually assigns an existing user as OWNER/MANAGER (or any valid member role) of the org.
     *
     * <p>Audit F-M2 (03/09/2026): đường này gọi thẳng {@code upsertMember}, thứ chỉ ghi đè vai trò
     * chứ không biết gì về bất biến 1-OWNER. Mọi đường khác đều giữ bất biến đó —
     * {@code OrgMembershipService.changeRole} từ chối đụng OWNER, {@code removeMember}/
     * {@code selfLeave} từ chối gỡ OWNER, và OWNER chỉ được (tái) tạo qua
     * {@code transferOwnership} (thăng + giáng nguyên tử). Riêng endpoint admin này hạ được OWNER
     * duy nhất xuống TEACHER (org còn 0 OWNER) hoặc dựng thêm OWNER thứ hai. Hai guard dưới đây
     * khép lại lỗ đó; đổi chủ vẫn phải đi qua transferOwnership.
     */
    @Transactional
    public OrgMemberDto addMember(Long orgId, String email, String role, AuditActor actor) {
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tổ chức: " + orgId));
        if (email == null || email.isBlank()) {
            throw new BadRequestException("Email là bắt buộc");
        }
        String normalizedRole = normalizeRole(role);
        String normalizedEmail = email.trim();

        // Case-insensitive: an admin may type the member's address with any case; stored emails
        // are canonical lowercase. Matches the login/register lookup so a capital letter no longer
        // makes an existing user "not found".
        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng: " + normalizedEmail));

        // DEC-13: admin nền tảng không bao giờ là thành viên trung tâm. Chốt chặn thật nằm ở
        // OrgMembershipService.upsertMember; guard ở đây thêm hai thứ upsertMember không có —
        // thông báo nói đúng ngữ cảnh console admin, và targetEmail trong vết (upsertMember chỉ
        // cầm userId). Đây cũng là đường khai thác trực tiếp nhất: một lệnh HTTP với chính email
        // của mình là mở trọn console trung tâm.
        if (user.getRole() == User.Role.ADMIN) {
            throw new PrivilegedActionBlockedException(
                    "Quản trị viên nền tảng không được là thành viên trung tâm — hãy dùng một tài khoản riêng.",
                    "admin.org.admin_membership.blocked", "ORG", String.valueOf(org.getId()),
                    Map.of("reason", "platform_admin",
                            "targetUserId", user.getId(),
                            "targetEmail", user.getEmail(),
                            "requestedRole", normalizedRole));
        }

        OrgMember existing = orgMemberRepository.findByIdOrgIdAndIdUserId(org.getId(), user.getId())
                .orElse(null);
        boolean targetIsActiveOwner = existing != null
                && ROLE_OWNER.equals(existing.getRole())
                && STATUS_ACTIVE.equals(existing.getStatus());

        // Audit R-M9: ném subtype mang chất liệu audit — vết ghi ở GlobalExceptionHandler SAU khi
        // transaction rollback, nên lần thử phá bất biến 1-OWNER không còn vô hình trong audit_logs.
        if (targetIsActiveOwner && !ROLE_OWNER.equals(normalizedRole)) {
            throw new PrivilegedActionBlockedException(
                    "Không thể hạ vai trò của chủ sở hữu — hãy chuyển quyền sở hữu cho người khác trước.",
                    "admin.org.owner_invariant.blocked", "ORG", String.valueOf(org.getId()),
                    Map.of("reason", "demote_owner", "targetUserId", user.getId(), "requestedRole", normalizedRole));
        }
        if (ROLE_OWNER.equals(normalizedRole) && !targetIsActiveOwner
                && orgMembershipService.countActiveOwners(org.getId()) > 0) {
            throw new PrivilegedActionBlockedException(
                    "Tổ chức đã có chủ sở hữu — mỗi tổ chức chỉ một OWNER. Hãy dùng chuyển quyền sở hữu.",
                    "admin.org.owner_invariant.blocked", "ORG", String.valueOf(org.getId()),
                    Map.of("reason", "second_owner", "targetUserId", user.getId(), "requestedRole", normalizedRole));
        }

        String previousRole = existing == null ? null : existing.getRole();

        // Seat-limit enforcement (including the concurrent-add race) is centralized in
        // OrgMembershipService.upsertMember (ORG-1): it locks the org row and rejects a brand-new
        // STUDENT over seat_limit, so every add path inherits one race-safe gate.
        orgMembershipService.upsertMember(org.getId(), user.getId(), normalizedRole);

        OrgMember member = orgMemberRepository.findByIdOrgIdAndIdUserId(org.getId(), user.getId())
                .orElseThrow(() -> new NotFoundException("Không tạo được thành viên tổ chức"));

        // Gán vai trò trong tổ chức là thao tác đặc quyền — trước đây không để lại vết nào.
        // DEC-13: gán vai trò TRONG một trung tâm cụ thể ⇒ vết thuộc về trung tâm đó, không phải
        // "hệ thống". org.getId() đã có sẵn ở đây (chính org vừa tra ở đầu hàm).
        auditLogService.log(
                "admin.org.member.upserted",
                actor,
                "ORG",
                String.valueOf(org.getId()),
                org.getId(),
                java.util.Map.of(
                        "targetUserId", user.getId(),
                        "targetEmail", user.getEmail(),
                        "fromRole", String.valueOf(previousRole),
                        "toRole", normalizedRole
                )
        );
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
     * Đường khôi phục quyền giám đốc (DEC-13 / A6, owner chốt 10/09/2026): admin nền tảng chỉ định
     * một nhân sự đang hoạt động của trung tâm làm OWNER duy nhất, hạ mọi OWNER hiện tại xuống
     * MANAGER, kèm lý do bắt buộc đi vào sổ trung tâm.
     *
     * <p>Trước bản này sản phẩm KHÔNG có đường khôi phục: {@code addMember} chặn hạ OWNER và chặn
     * OWNER thứ hai, {@code removeMember}/{@code selfLeave} từ chối OWNER, còn
     * {@code transferOwnership} chỉ chính OWNER gọi được. Giám đốc mất tài khoản là trung tâm khoá
     * cứng, và cách "xử lý" thực tế — admin {@code setUserPassword} rồi đăng nhập thay — để lại vết
     * ghi actor là chính giám đốc. Đường này thay cho cách đó: actor là admin, lý do nằm trong vết.
     *
     * <p>Thứ tự guard cố ý: lý do → ADMIN → thành viên. Guard ADMIN đứng TRƯỚC kiểm tra thành viên
     * vì một dòng {@code org_members} của admin có thể còn sót từ trước DEC-13; nếu để kiểm thành
     * viên chạy trước thì ca đó đi lọt tới thăng vai, còn ca "admin không là thành viên" thì trả 400
     * chung chung thay vì vết {@code admin.org.admin_membership.blocked} mà giám sát cần.
     *
     * <p><b>Làm mới phiên</b>: refresh token của chủ mới lẫn mọi chủ cũ bị thu hồi TRONG lõi
     * ({@code OrgMembershipService.forceOwnership}, Gói 2 — cùng chỗ với gỡ/rời/đổi vai/chuyển
     * chủ), không còn làm ở façade này: access token đang lưu hành mang {@code orgRole} cũ, không
     * revoke thì giám đốc vừa bị hạ vẫn giữ quyền tới hết vòng đời refresh token.
     *
     * <p><b>Nợ</b>: chưa gửi thông báo trong ứng dụng cho giám đốc mới. Bộ {@code NotificationType}
     * không có loại "đổi vai/đổi chủ", còn đường broadcast có dedupe guard ném
     * {@code ConflictException} khi lặp trong cửa sổ ngắn — dùng nó sẽ phá idempotency của chính
     * endpoint này. Không thêm enum trong đợt này theo quyết định owner; ghi nợ.
     *
     * @throws NotFoundException               org không tồn tại
     * @throws BadRequestException             thiếu người nhận, lý do ngoài 10–500 ký tự, người nhận
     *                                         không phải nhân sự ACTIVE của trung tâm
     * @throws PrivilegedActionBlockedException người nhận là admin nền tảng (DEC-13)
     */
    @Transactional
    public OrgMemberDto forceOwner(AuditActor admin, Long orgId, Long newOwnerUserId, String reason) {
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tổ chức: " + orgId));
        if (newOwnerUserId == null) {
            throw new BadRequestException("Phải chọn người được chỉ định làm giám đốc.");
        }
        String cleanReason = reason == null ? "" : reason.trim();
        if (cleanReason.length() < FORCE_OWNER_REASON_MIN || cleanReason.length() > FORCE_OWNER_REASON_MAX) {
            throw new BadRequestException("Lý do là bắt buộc, từ " + FORCE_OWNER_REASON_MIN
                    + " đến " + FORCE_OWNER_REASON_MAX + " ký tự.");
        }

        // DEC-13: admin nền tảng không bao giờ là thành viên trung tâm — càng không là giám đốc.
        // Cùng sự kiện với addMember/attachOwner để một truy vấn sổ bắt trọn mọi lần thử.
        userRepository.findById(newOwnerUserId)
                .filter(u -> u.getRole() == User.Role.ADMIN)
                .ifPresent(u -> {
                    throw new PrivilegedActionBlockedException(
                            "Không thể chỉ định quản trị viên nền tảng làm giám đốc trung tâm — hãy dùng một tài khoản riêng.",
                            "admin.org.admin_membership.blocked", "ORG", String.valueOf(org.getId()),
                            Map.of("reason", "platform_admin",
                                    "targetUserId", u.getId(),
                                    "targetEmail", u.getEmail(),
                                    "requestedRole", ROLE_OWNER));
                });

        OrgMembershipService.ForcedOwnership result =
                orgMembershipService.forceOwnership(admin, org.getId(), newOwnerUserId, cleanReason);

        log.info("[ORG-ADMIN] Admin {} chỉ định user {} làm OWNER của org {} (hạ {} OWNER cũ)",
                admin == null ? null : admin.id(), newOwnerUserId, org.getId(),
                result.demotedOwnerUserIds().size());
        return result.newOwner();
    }

    /**
     * (Re)grants the org's plan to every ACTIVE STUDENT member — e.g. after the org's
     * {@code planCode}/{@code validUntil} changes. No-op per-student when the org sells no plan.
     * Returns the number of students processed.
     */
    @Transactional
    public int activateEntitlements(Long orgId, AuditActor actor) {
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tổ chức: " + orgId));
        List<OrgMember> students =
                orgMemberRepository.findByIdOrgIdAndRoleAndStatus(orgId, ROLE_STUDENT, STATUS_ACTIVE);
        int granted = 0;
        for (OrgMember member : students) {
            // Đường KHÔI PHỤC (admin bấm tay, hoặc SePay báo hoá đơn đã thu): không đi qua cổng D5.
            // Hoá đơn truy thu kỳ đã qua không nới validUntil, nên trung tâm vẫn "quá hạn" tại đây;
            // dùng grantStudent thì webhook ngân hàng ném và rollback cả lần ghi nhận thanh toán.
            orgEntitlementService.grantStudentOnRestore(member.getId().getUserId(), org);
            granted++;
        }
        log.info("[ORG-ADMIN] Re-activated entitlements for {} student(s) in org {}", granted, orgId);
        // Audit F-M3 (03/09/2026): cấp lại quyền lợi hàng loạt = cấp phát có giá trị tiền tệ.
        // DEC-13: orgId là tham số của hàm — trung tâm được cấp lại quyền lợi. Cần tường minh gấp
        // đôi ở đây vì hàm này còn được webhook SePay gọi với actor hệ thống (id null): không
        // truyền thì cả đường tự động lẫn đường admin đều rơi vào org_id NULL.
        auditLogService.log("admin.org.entitlements.activated", actor, "ORG", String.valueOf(orgId),
                orgId,
                Map.of("grantedCount", granted, "planCode", String.valueOf(org.getPlanCode())));
        return granted;
    }

    /**
     * Activates an org's licence after an invoice is settled through the MANUAL admin path
     * (audit M-16) — mirrors {@code SepayWebhookService.activateOrg} for the auto path so a
     * manually-reconciled payment provisions students identically: org → ACTIVE, extend
     * {@code validUntil} to the paid period end (never shorten), and re-grant member entitlements.
     */
    @Transactional
    public void activateForPaidInvoice(OrgInvoice invoice, AuditActor actor) {
        Organization org = organizationRepository.findById(invoice.getOrgId()).orElse(null);
        if (org == null) {
            log.warn("[ORG-ADMIN] paid invoice {} references missing org {}", invoice.getId(), invoice.getOrgId());
            return;
        }
        org.changeStatus(STATUS_ACTIVE);
        if (invoice.getPeriodEnd() != null) {
            java.time.Instant newEnd = invoice.getPeriodEnd()
                    .plusDays(1).atStartOfDay(java.time.ZoneOffset.UTC).toInstant();
            if (org.getValidUntil() == null || newEnd.isAfter(org.getValidUntil())) {
                org.setValidUntil(newEnd);
            }
        }
        organizationRepository.save(org);
        // Audit F-M3 (03/09/2026): đường thủ công đối ứng với webhook SePay — một hoá đơn được đánh
        // đã thu bằng tay sẽ kích hoạt giấy phép và gia hạn validUntil. Actor truyền từ đường gọi:
        // admin đánh dấu thì là admin đó, còn webhook tự chạy thì actor rỗng (đúng bản chất).
        auditLogService.log("admin.org.licence.activated_by_invoice", actor,
                "ORG", String.valueOf(org.getId()),
                org.getId(),
                Map.of(
                        "invoiceId", invoice.getId(),
                        "periodEnd", String.valueOf(invoice.getPeriodEnd()),
                        "validUntil", String.valueOf(org.getValidUntil())
                ));
        activateEntitlements(org.getId(), actor);
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
    private void attachOwner(AuditActor actor, Long orgId, String ownerEmail, String ownerName,
                             String ownerPassword) {
        if (ownerEmail == null || ownerEmail.isBlank()) {
            return;
        }
        // Canonical lowercase on write + case-insensitive lookup: keeps the owner account in the
        // same canonical form as register/createUser, and links an existing user regardless of
        // the case the admin typed.
        String email = ownerEmail.trim().toLowerCase();
        Optional<User> existing = userRepository.findByEmailIgnoreCase(email);
        if (existing.isPresent()) {
            // DEC-13: chặn TRƯỚC upsertMember để thông báo nói đúng ngữ cảnh "tạo trung tâm".
            // Ném ở đây rollback cả org đang tạo (cùng @Transactional với createOrganization) —
            // đúng ý muốn: thà không có trung tâm còn hơn có một trung tâm mà chủ sở hữu là admin
            // nền tảng, vì khi đó KHÔNG ai gỡ được (removeMember và selfLeave đều từ chối OWNER,
            // transferOwnership chỉ chính OWNER gọi được).
            if (existing.get().getRole() == User.Role.ADMIN) {
                throw new PrivilegedActionBlockedException(
                        "Không thể đặt quản trị viên nền tảng làm chủ sở hữu trung tâm — hãy dùng một tài khoản riêng.",
                        "admin.org.admin_membership.blocked", "ORG", String.valueOf(orgId),
                        Map.of("reason", "platform_admin_owner",
                                "targetUserId", existing.get().getId(),
                                "targetEmail", email,
                                "requestedRole", ROLE_OWNER));
            }
            orgMembershipService.upsertMember(orgId, existing.get().getId(), ROLE_OWNER);
            auditOwnerAttached(actor, orgId, existing.get().getId(), email, false);
            return;
        }
        // Để trống = hệ thống sinh ngẫu nhiên (UUID, thừa dài); có nhập thì chịu chung sàn.
        if (ownerPassword != null && !ownerPassword.isBlank()) {
            PasswordPolicy.requireStrongEnough(ownerPassword);
        }
        String rawPw = (ownerPassword != null && !ownerPassword.isBlank())
                ? ownerPassword : UUID.randomUUID().toString();
        String displayName = (ownerName != null && !ownerName.isBlank())
                ? ownerName.trim() : localPart(email);
        User owner = userRepository.save(User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(rawPw))
                .displayName(displayName)
                .role(User.Role.OWNER)
                .createdVia(User.CreatedVia.ADMIN)
                .build());
        orgMembershipService.upsertMember(orgId, owner.getId(), ROLE_OWNER);
        auditOwnerAttached(actor, orgId, owner.getId(), email, true);
        log.info("[Org] Pre-created OWNER account userId={} (email={}) cho org {}", owner.getId(), email, orgId);
    }

    /**
     * Vết cho đường kết nạp giám đốc đầu tiên của một trung tâm (nợ Gói 2, vá 11/09/2026).
     *
     * <p>{@code admin.org.created} chỉ nói "trung tâm được dựng"; thành viên OWNER thì xuất hiện mà
     * sổ hoạt động KHÔNG có dòng nào — trong khi mọi đường kết nạp khác (lời mời, CSV, console) đều
     * có. Giám đốc mở sổ của trung tâm mình thấy lịch sử bắt đầu bằng một khoảng trống, và câu hỏi
     * kiểm toán "ai đưa tài khoản này vào trung tâm" không trả lời được cho đúng thành viên quyền
     * cao nhất. {@code accountCreated} phân biệt hai nhánh: gắn tài khoản có sẵn, hay admin tạo
     * thẳng tài khoản OWNER mới.
     */
    private void auditOwnerAttached(AuditActor actor, Long orgId, Long ownerUserId, String email,
                                    boolean accountCreated) {
        auditLogService.log("admin.org.owner_attached", actor,
                "ORG_MEMBER", String.valueOf(ownerUserId), orgId,
                Map.of("orgId", orgId,
                        "targetUserId", ownerUserId,
                        "targetEmail", email,
                        "role", ROLE_OWNER,
                        "accountCreated", accountCreated));
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
                studentCount,
                org.getValidUntil(),
                org.getSuspendedAt(),
                org.getMonthlyTokenPool(),
                org.isPoolUnlimited()
        );
    }
}
