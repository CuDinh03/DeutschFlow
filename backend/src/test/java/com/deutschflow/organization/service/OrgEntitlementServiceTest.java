package com.deutschflow.organization.service;

import com.deutschflow.organization.entity.Organization;
import com.deutschflow.payment.service.SubscriptionActivationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@DisplayName("OrgEntitlementService Unit Tests")
class OrgEntitlementServiceTest {

    @Mock private SubscriptionActivationService subscriptionActivationService;
    @Mock private JdbcTemplate jdbcTemplate;

    private OrgEntitlementService service;

    private static final Long USER_ID = 77L;

    @BeforeEach
    void setUp() {
        service = new OrgEntitlementService(subscriptionActivationService, jdbcTemplate);
    }

    // ------------------------------------------------------------------ helpers

    private Organization orgWithPlan(String planCode) {
        return Organization.builder()
                .id(1L)
                .name("Acme Org")
                .slug("acme")
                .planCode(planCode)
                .build();
    }

    private Organization orgWithPlanAndValidUntil(String planCode, Instant validUntil) {
        return Organization.builder()
                .id(1L)
                .name("Acme Org")
                .slug("acme")
                .planCode(planCode)
                .validUntil(validUntil)
                .build();
    }

    // ------------------------------------------------------------------ grantStudent — with planCode

    @Test
    @DisplayName("grantStudent with planCode: calls activateWithExplicitEnd with ORG source + notifyAdmins=false")
    void grantStudent_withPlanCode_callsActivateWithExplicitEnd() {
        Organization org = orgWithPlan("PRO");

        service.grantStudent(USER_ID, org);

        verify(subscriptionActivationService).activateWithExplicitEnd(
                eq(USER_ID),
                eq("PRO"),
                any(Instant.class),
                any(Instant.class),
                eq("ORG"),
                eq(false)
        );
    }

    @Test
    @DisplayName("grantStudent with planCode: startsAt is approximately now (within 5 seconds)")
    void grantStudent_withPlanCode_startsAtIsNow() {
        Organization org = orgWithPlan("ULTRA");
        Instant before = Instant.now();

        service.grantStudent(USER_ID, org);

        ArgumentCaptor<Instant> startsAtCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(subscriptionActivationService).activateWithExplicitEnd(
                anyLong(), anyString(),
                startsAtCaptor.capture(),
                any(Instant.class),
                anyString(), anyBoolean()
        );
        Instant startsAt = startsAtCaptor.getValue();
        assertThat(startsAt).isAfterOrEqualTo(before);
        assertThat(startsAt).isBefore(before.plusSeconds(5));
    }

    @Test
    @DisplayName("grantStudent with explicit validUntil: endsAt equals org.validUntil")
    void grantStudent_withValidUntil_endsAtEqualsValidUntil() {
        Instant validUntil = Instant.now().plus(365, ChronoUnit.DAYS);
        Organization org = orgWithPlanAndValidUntil("PRO", validUntil);

        service.grantStudent(USER_ID, org);

        ArgumentCaptor<Instant> endsAtCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(subscriptionActivationService).activateWithExplicitEnd(
                anyLong(), anyString(),
                any(Instant.class),
                endsAtCaptor.capture(),
                anyString(), anyBoolean()
        );
        assertThat(endsAtCaptor.getValue()).isEqualTo(validUntil);
    }

    @Test
    @DisplayName("grantStudent with null validUntil: endsAt falls back to ~5-year horizon")
    void grantStudent_nullValidUntil_endsAtIsDefaultHorizon() {
        Organization org = orgWithPlan("PRO"); // validUntil = null → default 1825-day horizon

        Instant before = Instant.now();
        service.grantStudent(USER_ID, org);

        ArgumentCaptor<Instant> endsAtCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(subscriptionActivationService).activateWithExplicitEnd(
                anyLong(), anyString(),
                any(Instant.class),
                endsAtCaptor.capture(),
                anyString(), anyBoolean()
        );
        Instant endsAt = endsAtCaptor.getValue();
        // Default horizon is 1825 days (≈ 5 years); verify it is well into the future
        assertThat(endsAt).isAfter(before.plus(1820, ChronoUnit.DAYS));
        assertThat(endsAt).isBefore(before.plus(1830, ChronoUnit.DAYS));
    }

    // ------------------------------------------------------------------ grantStudent — null / blank planCode

    @Test
    @DisplayName("grantStudent with null planCode: does nothing (no-op)")
    void grantStudent_nullPlanCode_doesNothing() {
        Organization org = orgWithPlan(null);

        service.grantStudent(USER_ID, org);

        verify(subscriptionActivationService, never())
                .activateWithExplicitEnd(anyLong(), anyString(), any(), any(), anyString(), anyBoolean());
    }

    @Test
    @DisplayName("grantStudent with blank planCode: does nothing (no-op)")
    void grantStudent_blankPlanCode_doesNothing() {
        Organization org = orgWithPlan("   ");

        service.grantStudent(USER_ID, org);

        verify(subscriptionActivationService, never())
                .activateWithExplicitEnd(anyLong(), anyString(), any(), any(), anyString(), anyBoolean());
    }

    @Test
    @DisplayName("grantStudent with empty planCode: does nothing (no-op)")
    void grantStudent_emptyPlanCode_doesNothing() {
        Organization org = orgWithPlan("");

        service.grantStudent(USER_ID, org);

        verify(subscriptionActivationService, never())
                .activateWithExplicitEnd(anyLong(), anyString(), any(), any(), anyString(), anyBoolean());
    }

    // ------------------------------------------------------------------ revokeStudent

    @Test
    @DisplayName("revokeStudent: runs UPDATE setting status=ENDED for user's ORG-sourced active subscription")
    void revokeStudent_runsEndedUpdate() {
        service.revokeStudent(USER_ID);

        ArgumentCaptor<Object[]> argsCaptor = ArgumentCaptor.forClass(Object[].class);
        verify(jdbcTemplate).update(
                anyString(),
                argsCaptor.capture()
        );
        Object[] args = argsCaptor.getValue();
        // args: [Timestamp(now), userId, "ORG"]
        assertThat(args).hasSize(3);
        assertThat(args[1]).isEqualTo(USER_ID);
        assertThat(args[2]).isEqualTo("ORG");
    }

    @Test
    @DisplayName("revokeStudent: SQL contains ENDED status and WHERE on source=ORG")
    void revokeStudent_sqlContainsEndedAndOrgSource() {
        service.revokeStudent(USER_ID);

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).update(sqlCaptor.capture(), any(Object[].class));
        String sql = sqlCaptor.getValue();
        assertThat(sql).containsIgnoringCase("ENDED");
        assertThat(sql).containsIgnoringCase("source");
    }

    @Test
    @DisplayName("revokeStudent: subscriptionActivationService is NOT involved (direct JDBC update)")
    void revokeStudent_doesNotCallActivationService() {
        service.revokeStudent(USER_ID);

        verify(subscriptionActivationService, never())
                .activateWithExplicitEnd(anyLong(), anyString(), any(), any(), anyString(), anyBoolean());
        verify(subscriptionActivationService, never())
                .activatePlan(anyLong(), anyString(), anyInt());
    }
}
