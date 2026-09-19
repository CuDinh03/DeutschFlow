package com.deutschflow.user.onboarding.lifecycle;

import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Job lifecycle tuần đầu + trial (Đợt 6 §4.7): mỗi giờ phút 05 (sau {@code DailyNotificationJob}
 * phút 00 để cùng giờ thì tin lifecycle KHÔNG bị nhắc chuỗi chen trước — nhắc chuỗi đã bỏ qua ngày có
 * lifecycle nhờ {@code lifecycle_sends}, nhưng thứ tự này giữ hai tin không dính nhau trong một phút).
 *
 * <p>Một điểm vào, {@code @Scheduled} + {@code @SchedulerLock} ở đây, logic + transaction ở service
 * (khuôn {@code UserNotificationRetentionJob}). Tắt bằng {@code app.onboarding.lifecycle.enabled=false}.
 */
@Component
@Slf4j
public class OnboardingLifecycleJob {

    private final OnboardingLifecycleService service;
    private final boolean enabled;

    public OnboardingLifecycleJob(OnboardingLifecycleService service,
                                  @Value("${app.onboarding.lifecycle.enabled:true}") boolean enabled) {
        this.service = service;
        this.enabled = enabled;
    }

    @Scheduled(cron = "${app.onboarding.lifecycle.cron:0 5 * * * *}")
    @SchedulerLock(name = "onboardingLifecycle", lockAtMostFor = "PT20M", lockAtLeastFor = "PT1M")
    public void run() {
        if (!enabled) return;
        try {
            service.runHourly(Instant.now());
        } catch (Exception e) {
            log.warn("[LIFECYCLE] lượt chạy lỗi: {}", e.toString());
        }
    }
}
