package com.deutschflow.notification.service;

import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.entity.UserNotification;
import com.deutschflow.notification.repository.UserNotificationRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Chạy trên Postgres thật vì điều cần chứng minh là câu DELETE JPQL: chỉ dòng ĐÃ ĐỌC quá hạn bị
 * xoá; dòng chưa đọc (dù cũ hơn nhiều) và dòng đọc gần đây còn nguyên. Gọi thẳng service thay vì
 * method @Scheduled của job — @SchedulerLock skip im lặng khi không giữ được lock nên test qua
 * job là test flaky.
 */
@SpringBootTest
@DisplayName("User notification retention IT — chỉ xoá thông báo đã đọc quá hạn")
class UserNotificationRetentionServiceIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final int RETENTION_DAYS = 90;

    @Autowired private UserNotificationRetentionService retentionService;
    @Autowired private UserNotificationRepository notificationRepository;
    @Autowired private UserRepository userRepository;

    @Test
    @DisplayName("đã đọc quá 90 ngày bị xoá; đã đọc gần đây và chưa đọc (kể cả rất cũ) còn nguyên")
    void purge_deletesOnlyReadRowsPastCutoff() {
        // DB integration dùng lại giữa các lần chạy — dọn trước các dòng khớp điều kiện còn sót
        // từ lần chạy trước để đếm chính xác "xoá đúng 1 dòng" bên dưới.
        retentionService.deleteReadNotificationsOlderThan(RETENTION_DAYS);

        User u = newStudent();
        LocalDateTime now = LocalDateTime.now();

        Long readExpired = seed(u, now.minusDays(RETENTION_DAYS + 1), now.minusDays(200));
        Long readRecent = seed(u, now.minusDays(1), now.minusDays(10));
        Long unreadAncient = seed(u, null, now.minusDays(400));
        Long readJustInsideWindow = seed(u, now.minusDays(RETENTION_DAYS).plusHours(1), now.minusDays(120));

        int deleted = retentionService.deleteReadNotificationsOlderThan(RETENTION_DAYS);

        assertThat(deleted).isEqualTo(1);
        assertThat(notificationRepository.findById(readExpired)).isEmpty();
        assertThat(notificationRepository.findById(readRecent)).isPresent();
        assertThat(notificationRepository.findById(unreadAncient)).isPresent();
        assertThat(notificationRepository.findById(readJustInsideWindow)).isPresent();
    }

    @Test
    @DisplayName("không có gì quá hạn thì trả 0 và không đụng dòng nào")
    void purge_nothingExpired_returnsZero() {
        retentionService.deleteReadNotificationsOlderThan(RETENTION_DAYS);

        User u = newStudent();
        Long readRecent = seed(u, LocalDateTime.now().minusDays(2), LocalDateTime.now().minusDays(3));

        assertThat(retentionService.deleteReadNotificationsOlderThan(RETENTION_DAYS)).isZero();
        assertThat(notificationRepository.findById(readRecent)).isPresent();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private User newStudent() {
        return userRepository.save(User.builder()
                .email("unr-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Retention IT")
                .role(User.Role.STUDENT)
                .build());
    }

    private Long seed(User recipient, LocalDateTime readAt, LocalDateTime createdAt) {
        return notificationRepository.save(UserNotification.builder()
                .recipient(recipient)
                .type(NotificationType.ADMIN_BROADCAST)
                .payload(Map.of("title", "retention-it"))
                .readAt(readAt)
                .createdAt(createdAt)
                .build()).getId();
    }
}
