package com.deutschflow.organization.service;

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
    private final JdbcTemplate jdbcTemplate;

    /**
     * Grants the org's plan to a student. No-op when the org has no plan configured.
     * Replaces any prior ACTIVE subscription for the user (latest-wins) via
     * {@link SubscriptionActivationService#activateWithExplicitEnd}; admins are not notified.
     */
    @Transactional
    public void grantStudent(Long userId, Organization org) {
        String planCode = org.getPlanCode();
        if (!StringUtils.hasText(planCode)) {
            return; // org sells no plan — membership only, no entitlement to grant
        }
        subscriptionActivationService.activateWithExplicitEnd(
                userId, planCode, Instant.now(), resolveEnd(org), SOURCE_ORG, false);
        log.info("[ORG-ENT] Granted plan={} to userId={} via org={}", planCode, userId, org.getId());
    }

    /** Ends the user's org-granted entitlement. Leaves web/Apple subscriptions untouched. */
    @Transactional
    public void revokeStudent(Long userId) {
        int ended = jdbcTemplate.update("""
                UPDATE user_subscriptions
                SET status = 'ENDED', updated_at = ?
                WHERE user_id = ? AND source = ? AND status = 'ACTIVE'
                """, Timestamp.from(Instant.now()), userId, SOURCE_ORG);
        log.info("[ORG-ENT] Revoked {} org entitlement(s) for userId={}", ended, userId);
    }

    /** License end for the org: explicit {@code validUntil} or the default horizon from now. */
    private Instant resolveEnd(Organization org) {
        return org.getValidUntil() != null
                ? org.getValidUntil()
                : Instant.now().plus(DEFAULT_ENTITLEMENT_DAYS, ChronoUnit.DAYS);
    }
}
