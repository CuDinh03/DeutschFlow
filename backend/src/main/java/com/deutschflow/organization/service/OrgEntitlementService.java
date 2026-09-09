package com.deutschflow.organization.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.OrgReadOnlyException;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.payment.service.SubscriptionActivationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Bridges org membership to the per-user subscription system: when a student joins an
 * org that carries a {@code planCode}, we activate that plan on their account with
 * {@code source="ORG"} so it is clearly distinguishable from web (Stripe/MoMo) and Apple
 * entitlements and can be revoked independently when the student leaves the org.
 *
 * <p>Authorization is enforced by callers; this service trusts the {@code org}/{@code userId}
 * it receives.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrgEntitlementService {

    private static final String SOURCE_ORG = "ORG";
    /** Default license horizon when the org has no explicit {@code validUntil} (perpetual). */
    private static final long DEFAULT_ENTITLEMENT_DAYS = 1825; // ~5 years

    private final SubscriptionActivationService subscriptionActivationService;
    private final AuditLogService auditLogService;
    private final JdbcTemplate jdbcTemplate;

    /**
     * Grants the org's plan to a student. No-op when the org has no plan configured.
     *
     * <p>Gói cá nhân người học đang trả tiền KHÔNG bị xoá sổ mà chuyển sang tạm dừng, giữ nguyên phần
     * thời hạn còn lại (DEC-09 — owner chốt Q1 ngày 07/09). Trước đợt này đường cấp đi qua
     * {@code activateWithExplicitEnd}, hàm đó ENDED mọi dòng ACTIVE: thêm một học viên đang trả tiền
     * vào trung tâm là đốt sạch phần họ đã mua, và rời trung tâm cũng không lấy lại được.
     *
     * <p><b>Cổng D5 (nợ ghi trong PR #617, nay owner đã chốt):</b> trung tâm bị đình chỉ hoặc đã
     * hết hạn thì KHÔNG cấp thêm quyền lợi — chặn NGAY từ mốc neo, không đợi hết 7 ngày ân hạn
     * (ân hạn là quãng chỉ-đọc trước khi CẮT, xem {@link OrgLicenseState}). Cổng đặt ở ĐÂY chứ không ở từng call-site
     * vì cả hai đường TỰ PHỤC VỤ đều đi qua hàm này ({@code OrgMembershipService.ensureStudentSeat}
     * khi học viên gõ mã lớp, {@code OrgRosterRowImporter} khi org import roster) — trước đây chỉ
     * cần một học viên gõ mã lớp là trung tâm nợ tiền vẫn cấp được gói mới. Ném (chứ không lặng lẽ bỏ qua) để lượt duyệt/import thất bại rõ ràng và cùng
     * rollback với ghế vừa cấp, thay vì đẻ ra thành viên không có quyền lợi.
     *
     * <p>Đường KHÔI PHỤC (quản trị nền tảng bật lại trung tâm, webhook ghi nhận hoá đơn đã thu) đi
     * bằng {@link #grantStudentOnRestore} — KHÔNG qua cổng này, vì {@code validUntil} có thể vẫn
     * còn quá hạn ngay lúc bật lại và cổng sẽ khoá đúng cái nút thoát khỏi chế độ chỉ đọc.
     * {@link #revokeStudent} và {@link #expireAndResume} cũng không đi qua cổng.
     */
    @Transactional
    public void grantStudent(Long userId, Organization org) {
        assertOrgMayGrant(org);
        doGrant(userId, org);
    }

    /**
     * Cấp gói cho đường KHÔI PHỤC — quản trị NỀN TẢNG bật lại trung tâm, hoặc cổng thanh toán ghi
     * nhận hoá đơn đã thu — nên CỐ Ý không đi qua cổng D5.
     *
     * <p><b>Vì sao phải tách:</b> {@code AdminOrgService.updateOrganization} đặt {@code status =
     * ACTIVE} nhưng KHÔNG tự gia hạn {@code validUntil}; {@code SepayWebhookService.activateOrg}
     * chỉ nới {@code validUntil} khi hoá đơn có {@code period_end} và mốc đó xa hơn hạn cũ (hoá đơn
     * truy thu kỳ đã qua thì không nới). Trong cả hai trường hợp, trung tâm vừa được bật lại vẫn
     * còn "hết hạn quá ân hạn" tại thời điểm cấp — nếu đi qua cổng D5 thì {@code grantStudent} ném,
     * kéo rollback CẢ giao dịch bật lại / ghi nhận thanh toán. Nghĩa là: đúng cái nút để thoát khỏi
     * chế độ chỉ đọc lại bị chính chế độ chỉ đọc khoá, và webhook ngân hàng thì lỗi lặp vô hạn.
     *
     * <p>Chỉ hai đường quản trị/hệ thống dùng hàm này. Đường tự phục vụ (học viên gõ mã lớp, org
     * import roster) vẫn đi {@link #grantStudent} và vẫn bị cổng D5 chặn.
     */
    @Transactional
    public void grantStudentOnRestore(Long userId, Organization org) {
        doGrant(userId, org);
    }

    private void doGrant(Long userId, Organization org) {
        String planCode = org.getPlanCode();
        if (!StringUtils.hasText(planCode)) {
            return; // org sells no plan — membership only, no entitlement to grant
        }
        var paused = subscriptionActivationService.activateOrg(
                userId, planCode, Instant.now(), resolveEnd(org));
        for (var row : paused) {
            auditLogService.log("org_entitlement_paused", (AuditActor) null, "USER", String.valueOf(userId),
                    meta(org, row.source(), row.planCode(), row.remainingSeconds()));
        }
        log.info("[ORG-ENT] Granted plan={} to userId={} via org={} (tạm dừng {} gói cá nhân)",
                planCode, userId, org.getId(), paused.size());
    }

    /**
     * Ends the user's org-granted entitlement, then khôi phục gói cá nhân đang tạm dừng (nếu có).
     * Leaves web/Apple subscriptions untouched apart from resuming what this service itself paused.
     */
    @Transactional
    public void revokeStudent(Long userId) {
        int ended = jdbcTemplate.update("""
                UPDATE user_subscriptions
                SET status = 'ENDED', updated_at = ?
                WHERE user_id = ? AND source = ? AND status = 'ACTIVE'
                """, Timestamp.from(Instant.now()), userId, SOURCE_ORG);
        log.info("[ORG-ENT] Revoked {} org entitlement(s) for userId={}", ended, userId);
        resumeAndAudit(userId);
    }

    /**
     * Giấy phép của trung tâm hết hạn: kết thúc quyền lợi ORG rồi trả gói cá nhân về.
     * Gọi từ job đối soát nền — không có người thao tác nên sổ kiểm toán ghi actor rỗng.
     */
    @Transactional
    public void expireAndResume(Long userId) {
        int ended = jdbcTemplate.update("""
                UPDATE user_subscriptions
                SET status = 'ENDED', updated_at = ?
                WHERE user_id = ? AND source = ? AND status = 'ACTIVE'
                  AND ends_at IS NOT NULL AND ends_at <= ?
                """, Timestamp.from(Instant.now()), userId, SOURCE_ORG, Timestamp.from(Instant.now()));
        if (ended == 0) {
            return; // đã có đường khác xử lý trước — không ghi sổ trùng
        }
        log.info("[ORG-ENT] Giấy phép trung tâm hết hạn cho userId={} — kết thúc {} quyền lợi", userId, ended);
        resumeAndAudit(userId);
    }

    /** Cổng D5 — xem {@link #grantStudent}. Tách ra để đọc được ý định ở một chỗ. */
    private static void assertOrgMayGrant(Organization org) {
        if (!OrgLicenseState.evaluate(org.getStatus(), org.getValidUntil(), org.getSuspendedAt(),
                Instant.now()).writable()) {
            throw new OrgReadOnlyException(org.getId(), OrgLicenseState.reason(org.getStatus()));
        }
    }

    private void resumeAndAudit(Long userId) {
        subscriptionActivationService.resumePausedIfAny(userId).ifPresent(row ->
                auditLogService.log("org_entitlement_resumed", (AuditActor) null, "USER", String.valueOf(userId),
                        meta(null, row.source(), row.planCode(), row.remainingSeconds())));
    }

    private static Map<String, Object> meta(Organization org, String source, String planCode, long remainingSeconds) {
        Map<String, Object> meta = new LinkedHashMap<>();
        if (org != null) {
            meta.put("orgId", org.getId());
        }
        meta.put("source", source);
        meta.put("planCode", planCode);
        meta.put("remainingSeconds", remainingSeconds);
        return meta;
    }

    /** License end for the org: explicit {@code validUntil} or the default horizon from now. */
    private Instant resolveEnd(Organization org) {
        return org.getValidUntil() != null
                ? org.getValidUntil()
                : Instant.now().plus(DEFAULT_ENTITLEMENT_DAYS, ChronoUnit.DAYS);
    }
}
