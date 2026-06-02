package com.deutschflow.payment.service;

import com.deutschflow.notification.service.UserNotificationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DisplayName("SubscriptionActivationService — Apple-aware activation")
@ExtendWith(MockitoExtension.class)
class SubscriptionActivationServiceTest {

    @Mock
    JdbcTemplate jdbcTemplate;

    @Mock
    UserNotificationService userNotificationService;

    @InjectMocks
    SubscriptionActivationService service;

    private static final long USER = 7L;
    private static final Instant START = Instant.parse("2026-06-01T00:00:00Z");
    private static final Instant END = Instant.parse("2026-07-01T00:00:00Z");

    @Test
    @DisplayName("activateWithExplicitEnd inserts an ACTIVE row tagged with the source and notifies admins")
    void activateWithExplicitEnd_insertsWithSource_andNotifies() {
        service.activateWithExplicitEnd(USER, "PRO", START, END, "APPLE", true);

        verify(jdbcTemplate).update(contains("INSERT INTO user_subscriptions"),
                eq(USER), eq("PRO"), any(), any(), eq("APPLE"), any(), any());
        verify(userNotificationService).onLearnerSubscribed(USER, "PRO");
    }

    @Test
    @DisplayName("notifyAdmins=false suppresses the admin notification (silent renewals)")
    void activateWithExplicitEnd_notifyFalse_skipsNotification() {
        service.activateWithExplicitEnd(USER, "PRO", START, END, "APPLE", false);

        verify(userNotificationService, never()).onLearnerSubscribed(anyLong(), anyString());
    }

    @Test
    @DisplayName("legacy activatePlan delegates with a null source (Stripe/MoMo behavior unchanged)")
    void activatePlan_delegatesWithNullSource() {
        service.activatePlan(USER, "PRO", 1);

        verify(jdbcTemplate).update(contains("INSERT INTO user_subscriptions"),
                eq(USER), eq("PRO"), any(), any(), isNull(), any(), any());
        verify(userNotificationService).onLearnerSubscribed(USER, "PRO");
    }

    @Test
    @DisplayName("extendOrActivateApple extends an existing active Apple row forward-only (no new INSERT)")
    void extendOrActivateApple_existingActive_extendsForwardOnly() {
        when(jdbcTemplate.queryForObject(contains("COUNT(*) FROM user_subscriptions"), eq(Integer.class), eq(USER)))
                .thenReturn(1);
        when(jdbcTemplate.update(contains("SET ends_at = ?"), any(), any(), any(), any(), any()))
                .thenReturn(1);

        service.extendOrActivateApple(USER, "PRO", START, END, false);

        verify(jdbcTemplate).update(contains("SET ends_at = ?"), any(), any(), any(), any(), any());
        verify(jdbcTemplate, never()).update(contains("INSERT INTO user_subscriptions"),
                any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("extendOrActivateApple with no active Apple row falls back to a full activation")
    void extendOrActivateApple_noActive_activates() {
        when(jdbcTemplate.queryForObject(contains("COUNT(*) FROM user_subscriptions"), eq(Integer.class), eq(USER)))
                .thenReturn(0);

        service.extendOrActivateApple(USER, "ULTRA", START, END, true);

        verify(jdbcTemplate).update(contains("INSERT INTO user_subscriptions"),
                eq(USER), eq("ULTRA"), any(), any(), eq("APPLE"), any(), any());
    }

    @Test
    @DisplayName("endAppleSubscription ends only Apple-sourced rows")
    void endAppleSubscription_targetsAppleRowsOnly() {
        service.endAppleSubscription(USER);

        verify(jdbcTemplate).update(contains("source = 'APPLE'"), any(), eq(USER));
    }
}
