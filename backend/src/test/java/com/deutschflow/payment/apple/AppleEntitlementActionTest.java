package com.deutschflow.payment.apple;

import com.apple.itunes.storekit.model.NotificationTypeV2;
import com.apple.itunes.storekit.model.Subtype;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static com.deutschflow.payment.apple.AppleServerNotificationService.decideAction;
import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Apple notification → entitlement action mapping")
class AppleEntitlementActionTest {

    @Test
    @DisplayName("SUBSCRIBED (initial buy / resubscribe) grants and notifies")
    void subscribed_grants() {
        assertThat(decideAction(NotificationTypeV2.SUBSCRIBED, Subtype.INITIAL_BUY))
                .isEqualTo(AppleEntitlementAction.GRANT);
        assertThat(decideAction(NotificationTypeV2.SUBSCRIBED, Subtype.RESUBSCRIBE))
                .isEqualTo(AppleEntitlementAction.GRANT);
    }

    @Test
    @DisplayName("DID_RENEW / RENEWAL_EXTENDED extend the entitlement forward")
    void renew_extends() {
        assertThat(decideAction(NotificationTypeV2.DID_RENEW, null))
                .isEqualTo(AppleEntitlementAction.EXTEND);
        assertThat(decideAction(NotificationTypeV2.RENEWAL_EXTENDED, null))
                .isEqualTo(AppleEntitlementAction.EXTEND);
    }

    @Test
    @DisplayName("DID_FAIL_TO_RENEW in grace keeps access; without grace waits for EXPIRED")
    void failedRenewal_branchesOnGrace() {
        assertThat(decideAction(NotificationTypeV2.DID_FAIL_TO_RENEW, Subtype.GRACE_PERIOD))
                .isEqualTo(AppleEntitlementAction.SET_GRACE);
        assertThat(decideAction(NotificationTypeV2.DID_FAIL_TO_RENEW, null))
                .isEqualTo(AppleEntitlementAction.IGNORE);
    }

    @Test
    @DisplayName("EXPIRED / GRACE_PERIOD_EXPIRED / REVOKE end the entitlement")
    void terminalEvents_end() {
        assertThat(decideAction(NotificationTypeV2.EXPIRED, Subtype.VOLUNTARY))
                .isEqualTo(AppleEntitlementAction.END);
        assertThat(decideAction(NotificationTypeV2.GRACE_PERIOD_EXPIRED, null))
                .isEqualTo(AppleEntitlementAction.END);
        assertThat(decideAction(NotificationTypeV2.REVOKE, null))
                .isEqualTo(AppleEntitlementAction.END);
    }

    @Test
    @DisplayName("REFUND maps to REFUND; REFUND_REVERSED re-grants access")
    void refundEvents() {
        assertThat(decideAction(NotificationTypeV2.REFUND, null))
                .isEqualTo(AppleEntitlementAction.REFUND);
        assertThat(decideAction(NotificationTypeV2.REFUND_REVERSED, null))
                .isEqualTo(AppleEntitlementAction.GRANT);
    }

    @Test
    @DisplayName("DID_CHANGE_RENEWAL_STATUS only updates the auto-renew flag")
    void renewalStatusChange_updatesFlag() {
        assertThat(decideAction(NotificationTypeV2.DID_CHANGE_RENEWAL_STATUS, Subtype.AUTO_RENEW_DISABLED))
                .isEqualTo(AppleEntitlementAction.UPDATE_RENEWAL_FLAG);
    }

    @Test
    @DisplayName("Informational notifications and null type are ignored")
    void informational_ignored() {
        assertThat(decideAction(NotificationTypeV2.DID_CHANGE_RENEWAL_PREF, Subtype.DOWNGRADE))
                .isEqualTo(AppleEntitlementAction.IGNORE);
        assertThat(decideAction(NotificationTypeV2.PRICE_INCREASE, null))
                .isEqualTo(AppleEntitlementAction.IGNORE);
        assertThat(decideAction(NotificationTypeV2.CONSUMPTION_REQUEST, null))
                .isEqualTo(AppleEntitlementAction.IGNORE);
        assertThat(decideAction(NotificationTypeV2.TEST, null))
                .isEqualTo(AppleEntitlementAction.IGNORE);
        assertThat(decideAction(null, null))
                .isEqualTo(AppleEntitlementAction.IGNORE);
    }
}
