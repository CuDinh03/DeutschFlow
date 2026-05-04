package com.deutschflow.notification.sse;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Schedules SSE pushes after the surrounding transaction commits so clients refetch consistent counts.
 */
@Component
@RequiredArgsConstructor
public class NotificationUnreadPushCoordinator {

    private final NotificationSseBroadcaster sseBroadcaster;

    public void afterCommit(Long recipientUserId) {
        if (recipientUserId == null) {
            return;
        }
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            sseBroadcaster.broadcastUnreadCount(recipientUserId);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == TransactionSynchronization.STATUS_COMMITTED) {
                    sseBroadcaster.broadcastUnreadCount(recipientUserId);
                }
            }
        });
    }
}
