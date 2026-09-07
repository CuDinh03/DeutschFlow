package com.deutschflow.organization.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
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
     */
    @Transactional
    public void grantStudent(Long userId, Organization org) {
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
