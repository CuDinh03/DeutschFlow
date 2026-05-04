package com.deutschflow.notification.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.deutschflow.notification.repository.UserNotificationRepository;
import com.deutschflow.user.repository.UserRepository;
import com.deutschflow.notification.sse.NotificationUnreadPushCoordinator;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class UserNotificationServiceUnitTest {
    @Mock com.deutschflow.notification.repository.UserNotificationRepository notificationRepository;
    @Mock com.deutschflow.user.repository.UserRepository userRepository;
    @Mock com.deutschflow.notification.sse.NotificationUnreadPushCoordinator unreadPushCoordinator;

    @InjectMocks
    UserNotificationService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
