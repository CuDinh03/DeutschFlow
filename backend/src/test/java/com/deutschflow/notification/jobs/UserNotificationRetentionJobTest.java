package com.deutschflow.notification.jobs;

import com.deutschflow.notification.service.UserNotificationRetentionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserNotificationRetentionJobTest {

    @Mock
    UserNotificationRetentionService retentionService;

    private UserNotificationRetentionJob job(boolean enabled, int days) {
        return new UserNotificationRetentionJob(retentionService, enabled, days);
    }

    @Test
    void disabled_doesNothing() {
        job(false, 90).purgeReadNotifications();

        verifyNoInteractions(retentionService);
    }

    @Test
    void enabled_delegatesConfiguredWindow() {
        when(retentionService.deleteReadNotificationsOlderThan(90)).thenReturn(3);

        job(true, 90).purgeReadNotifications();

        verify(retentionService).deleteReadNotificationsOlderThan(90);
    }

    @Test
    void windowBelowOneDay_clampedToOneDay() {
        job(true, 0).purgeReadNotifications();

        verify(retentionService).deleteReadNotificationsOlderThan(1);
    }

    @Test
    void serviceFailure_doesNotPropagateToScheduler() {
        when(retentionService.deleteReadNotificationsOlderThan(anyInt()))
                .thenThrow(new RuntimeException("db down"));

        assertThatCode(() -> job(true, 90).purgeReadNotifications()).doesNotThrowAnyException();
    }
}
