package com.deutschflow.payment.apple;

/**
 * The effect an App Store Server Notification V2 has on the user's entitlement, decoupled from the
 * raw Apple notification taxonomy so the mapping can be unit-tested in isolation.
 */
public enum AppleEntitlementAction {
    /** Initial buy / resubscribe / reinstated refund — activate entitlement and notify admins. */
    GRANT,
    /** Auto-renewal — extend entitlement forward only, no admin notification. */
    EXTEND,
    /** Billing-retry grace period — keep entitlement, mark the ledger GRACE. */
    SET_GRACE,
    /** Expired / grace expired / family-sharing revoke — end the Apple entitlement. */
    END,
    /** Refund issued — end the Apple entitlement (user-facing notification is a follow-up). */
    REFUND,
    /** Auto-renew toggled — metadata only, entitlement unchanged. */
    UPDATE_RENEWAL_FLAG,
    /** Informational notification with no entitlement impact. */
    IGNORE
}
