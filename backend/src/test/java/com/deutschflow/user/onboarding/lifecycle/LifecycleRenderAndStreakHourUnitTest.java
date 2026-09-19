package com.deutschflow.user.onboarding.lifecycle;

import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.jobs.DailyNotificationJob;
import com.deutschflow.notification.service.NotificationContentRenderer;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Đợt 6: chữ của 6 loại thông báo mới và giờ nhắc chuỗi theo cột reminder_hour_local. */
class LifecycleRenderAndStreakHourUnitTest {

    private final NotificationContentRenderer renderer = new NotificationContentRenderer();

    @Test
    @DisplayName("6 loại lifecycle có tiêu đề riêng (không rơi về default) và thân lấy từ payload.message")
    void lifecycleTypesRender() {
        for (NotificationType t : new NotificationType[] {
                NotificationType.ONBOARDING_D0_WELCOME, NotificationType.ONBOARDING_D1_NEXT_LESSON,
                NotificationType.ONBOARDING_D3_CHECKIN, NotificationType.ONBOARDING_D7_SUMMARY,
                NotificationType.TRIAL_ENDING_SOON, NotificationType.TRIAL_ENDED}) {
            NotificationContentRenderer.RenderedContent c = renderer.render(t, Map.of("message", "Thân tin " + t.name()));
            assertThat(c.title()).as(t.name()).isNotBlank().doesNotContain("_");
            assertThat(c.body()).isEqualTo("Thân tin " + t.name());
            assertThat(renderer.render(t, null).body()).as("fallback khi thiếu payload").isNotBlank();
        }
    }

    @Test
    @DisplayName("Copy trial không viết cứng số ngày dùng thử")
    void trialCopyHasNoHardcodedDays() {
        for (NotificationType t : new NotificationType[] {NotificationType.TRIAL_ENDING_SOON, NotificationType.TRIAL_ENDED}) {
            NotificationContentRenderer.RenderedContent c = renderer.render(t, null);
            assertThat(c.title() + c.body()).doesNotContain("7 ngày").doesNotContain("45 ngày");
        }
    }

    @Test
    @DisplayName("DailyNotificationJob.streakHourFor: NULL/lạ → 18; 0–23 giữ nguyên (SMALLINT về Short)")
    void streakHourFor() throws Exception {
        Method m = DailyNotificationJob.class.getDeclaredMethod("streakHourFor", Object.class);
        m.setAccessible(true);
        assertThat(m.invoke(null, (Object) null)).isEqualTo(18);
        assertThat(m.invoke(null, (Object) Short.valueOf((short) 20))).isEqualTo(20);
        assertThat(m.invoke(null, (Object) Integer.valueOf(0))).isEqualTo(0);
        assertThat(m.invoke(null, (Object) Integer.valueOf(24))).isEqualTo(18);
        assertThat(m.invoke(null, (Object) "20")).isEqualTo(18);
    }
}
