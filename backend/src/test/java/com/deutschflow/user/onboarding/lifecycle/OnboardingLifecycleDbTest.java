package com.deutschflow.user.onboarding.lifecycle;

import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.jobs.DailyNotificationJob;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.dto.UpdateProfileRequest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.deutschflow.user.service.AuthService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Đợt 6 §4.7 trên Postgres thật (V333): sổ {@code lifecycle_sends} chốt "một lần", thông báo vào
 * {@code user_notifications}, giờ nhắc ghi qua {@code AuthService.updateProfile}, và
 * {@code DailyNotificationJob.hasLifecycleSendToday} thấy dòng sổ đó (điểm nối để bỏ nhắc chuỗi).
 */
@SpringBootTest
@DisplayName("Lifecycle tuần đầu — DB thật")
class OnboardingLifecycleDbTest extends AbstractPostgresIntegrationTest {

    private static final ZoneId HCM = ZoneId.of("Asia/Ho_Chi_Minh");

    @Autowired private OnboardingLifecycleService service;
    @Autowired private DailyNotificationJob dailyNotificationJob;
    @Autowired private AuthService authService;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbc;

    private User newStudent() {
        return userRepository.save(User.builder()
                .email("lifecycle-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Lifecycle Tester")
                .role(User.Role.STUDENT)
                .build());
    }

    private void activate(long userId, Instant activatedAt) {
        jdbc.update("""
                INSERT INTO user_onboarding_progress (user_id, flow_version, last_step, completed_activities, activated_at, created_at, updated_at)
                VALUES (?, 'onb_v3', 'FIRST_LESSON', '["FIRST_LESSON:BEGINNER_SESSION"]'::jsonb, ?, NOW(), NOW())
                """, userId, Timestamp.from(activatedAt));
    }

    private int countNotifications(long userId, NotificationType type) {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM user_notifications WHERE recipient_user_id = ? AND notification_type = ?",
                Integer.class, userId, type.name());
        return n == null ? 0 : n;
    }

    @Test
    @DisplayName("D0: chạy job hai lần chỉ chèn MỘT thông báo; sổ lifecycle_sends có đúng một dòng")
    void d0SentOnce() {
        User u = newStudent();
        Instant now = Instant.now();
        activate(u.getId(), now.minus(Duration.ofHours(1)));

        service.runHourly(now);
        service.runHourly(now.plus(Duration.ofHours(1)));

        assertThat(countNotifications(u.getId(), NotificationType.ONBOARDING_D0_WELCOME)).isEqualTo(1);
        Integer ledger = jdbc.queryForObject(
                "SELECT COUNT(*) FROM lifecycle_sends WHERE user_id = ? AND message_key = 'D0'", Integer.class, u.getId());
        assertThat(ledger).isEqualTo(1);
        assertThat(service.hasSendOnLocalDay(u.getId(), HCM, now)).isTrue();
    }

    @Test
    @DisplayName("Điểm nối hai job: ngày đã có tin lifecycle ⇒ DailyNotificationJob.hasLifecycleSendToday = true (bỏ nhắc chuỗi); người khác = false")
    void streakReminderSuppressedOnLifecycleDay() throws Exception {
        User u = newStudent();
        User other = newStudent();
        Instant now = Instant.now();
        activate(u.getId(), now.minus(Duration.ofHours(1)));
        service.runHourly(now);

        // Bean có @SchedulerLock ⇒ Spring bọc proxy CGLIB; gọi private method qua reflection phải đi vào
        // TARGET thật, không thì field jdbcTemplate của lớp con proxy là null (catch → false, đỏ nhầm).
        Object target = org.springframework.test.util.AopTestUtils.getUltimateTargetObject(dailyNotificationJob);
        java.lang.reflect.Method m = DailyNotificationJob.class.getDeclaredMethod("hasLifecycleSendToday", long.class, ZoneId.class);
        m.setAccessible(true);
        assertThat((Boolean) m.invoke(target, u.getId(), HCM)).isTrue();
        assertThat((Boolean) m.invoke(target, other.getId(), HCM)).isFalse();
    }

    @Test
    @DisplayName("T0: trial ENDED trong 24 h ⇒ TRIAL_ENDED một lần; T3 chỉ khi đúng giờ nhắc của người dùng")
    void trialEndedAndEndingSoon() {
        User ended = newStudent();
        Instant now = Instant.now();
        jdbc.update("""
                INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at, source)
                VALUES (?, 'PRO', 'ENDED', ?, ?, 'TRIAL')
                """, ended.getId(), Timestamp.from(now.minus(Duration.ofDays(8))), Timestamp.from(now.minus(Duration.ofHours(3))));

        User soon = newStudent();
        int hourNow = ZonedDateTime.ofInstant(now, HCM).getHour();
        jdbc.update("UPDATE users SET reminder_hour_local = ?, notification_timezone = 'Asia/Ho_Chi_Minh' WHERE id = ?", hourNow, soon.getId());
        Instant endsAt = now.plus(Duration.ofDays(2));
        jdbc.update("""
                INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at, source)
                VALUES (?, 'PRO', 'ACTIVE', ?, ?, 'TRIAL')
                """, soon.getId(), Timestamp.from(now.minus(Duration.ofDays(5))), Timestamp.from(endsAt));

        service.runHourly(now);
        service.runHourly(now);

        assertThat(countNotifications(ended.getId(), NotificationType.TRIAL_ENDED)).isEqualTo(1);
        assertThat(countNotifications(soon.getId(), NotificationType.TRIAL_ENDING_SOON)).isEqualTo(1);
        String body = jdbc.queryForObject(
                "SELECT payload_json->>'message' FROM user_notifications WHERE recipient_user_id = ? AND notification_type = 'TRIAL_ENDING_SOON'",
                String.class, soon.getId());
        assertThat(body).contains(ZonedDateTime.ofInstant(endsAt, HCM).getDayOfMonth() + "/");
    }

    @Test
    @DisplayName("PATCH giờ nhắc: 20 → cột 20; -1 → NULL; null → giữ nguyên; ngoài 0–23 bị chặn ở validate (không tới đây)")
    void reminderHourViaUpdateProfile() {
        User u = newStudent();
        authService.updateProfile(u, new UpdateProfileRequest(null, null, null, null, 20));
        assertThat(jdbc.queryForObject("SELECT reminder_hour_local FROM users WHERE id = ?", Integer.class, u.getId())).isEqualTo(20);

        authService.updateProfile(userRepository.findById(u.getId()).orElseThrow(), new UpdateProfileRequest("Tên mới", null, null, null, null));
        assertThat(jdbc.queryForObject("SELECT reminder_hour_local FROM users WHERE id = ?", Integer.class, u.getId())).isEqualTo(20);

        authService.updateProfile(userRepository.findById(u.getId()).orElseThrow(), new UpdateProfileRequest(null, null, null, null, -1));
        assertThat(jdbc.queryForObject("SELECT reminder_hour_local FROM users WHERE id = ?", Integer.class, u.getId())).isNull();
    }

    @Test
    @DisplayName("Ràng buộc DB: reminder_hour_local ngoài 0–23 bị CHECK chặn")
    void checkConstraint() {
        User u = newStudent();
        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
                jdbc.update("UPDATE users SET reminder_hour_local = 24 WHERE id = ?", u.getId()))
                .hasMessageContaining("chk_users_reminder_hour_local");
    }
}
