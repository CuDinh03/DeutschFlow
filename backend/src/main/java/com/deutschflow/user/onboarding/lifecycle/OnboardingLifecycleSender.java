package com.deutschflow.user.onboarding.lifecycle;

import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.service.NotificationContentRenderer;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Set;

/**
 * Gửi MỘT tin lifecycle đúng một lần cho một người (Đợt 6 kế hoạch onboarding 17/09/2026 §4.7).
 *
 * <p>Tách khỏi {@link OnboardingLifecycleService} để {@code @Transactional} đi qua proxy Spring thật
 * (tự gọi trong cùng bean thì annotation vô hiệu — bẫy đã ghi trong repo). Chốt trùng lặp là
 * {@code INSERT … ON CONFLICT DO NOTHING} vào {@code lifecycle_sends}: 0 dòng = đã gửi rồi, không
 * chèn thông báo. Chèn thông báo hỏng ⇒ rollback cả dòng sổ, giờ sau thử lại.
 *
 * <p>Kênh: in-app + Expo push (qua {@link UserNotificationService}) luôn; email chỉ khi cờ
 * {@code app.onboarding.lifecycle.email-enabled} bật VÀ tin thuộc nhóm dành cho người không mở app
 * (D1, D3, T3) — chờ SES production (cổng G-5/B0), mặc định TẮT.
 */
@Service
@Slf4j
public class OnboardingLifecycleSender {

    /** Tin gửi thêm qua email khi cờ bật — các tin "kéo người dùng quay lại". */
    static final Set<String> EMAIL_KEYS = Set.of("D1", "D3", "T3");

    private final JdbcTemplate jdbc;
    private final UserRepository userRepository;
    private final UserNotificationService userNotificationService;
    private final NotificationContentRenderer renderer;
    private final OnboardingLifecycleMailer mailer;
    private final boolean emailEnabled;

    public OnboardingLifecycleSender(JdbcTemplate jdbc,
                                     UserRepository userRepository,
                                     UserNotificationService userNotificationService,
                                     NotificationContentRenderer renderer,
                                     OnboardingLifecycleMailer mailer,
                                     @Value("${app.onboarding.lifecycle.email-enabled:false}") boolean emailEnabled) {
        this.jdbc = jdbc;
        this.userRepository = userRepository;
        this.userNotificationService = userNotificationService;
        this.renderer = renderer;
        this.mailer = mailer;
        this.emailEnabled = emailEnabled;
    }

    /**
     * @return true nếu chính lời gọi này gửi (lần đầu của {@code messageKey} cho {@code userId});
     *         false nếu đã gửi trước đó hoặc người dùng không còn hoạt động.
     */
    @Transactional
    public boolean sendOnce(long userId, String messageKey, NotificationType type, Map<String, Object> payload) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || !user.isActive()) return false;
        int inserted = jdbc.update(
                "INSERT INTO lifecycle_sends (user_id, message_key) VALUES (?, ?) ON CONFLICT DO NOTHING",
                userId, messageKey);
        if (inserted == 0) return false;
        userNotificationService.insertForUser(user, type, payload);
        if (emailEnabled && EMAIL_KEYS.contains(messageKey)) {
            NotificationContentRenderer.RenderedContent content = renderer.render(type, payload);
            mailer.send(user.getEmail(), user.getDisplayName(), content.title(), content.body());
        }
        log.info("[LIFECYCLE] userId={} key={} type={} — đã gửi", userId, messageKey, type);
        return true;
    }
}
