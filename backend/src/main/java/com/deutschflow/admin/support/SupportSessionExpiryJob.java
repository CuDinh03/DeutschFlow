package com.deutschflow.admin.support;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Entry point LỊCH đóng các phiên hỗ trợ đã quá hạn mà chưa ai đóng ({@code end_reason=expired}, vết
 * {@code support_session.ended} có {@code expired=true}) — logic ở {@link SupportSessionService#expireOverdue}.
 *
 * <p>Token support tự hết hạn cùng phiên (exp ≤ expires_at) và {@link SupportSessionVerifier} so hạn từng request,
 * nên job này chỉ để sổ sách khớp thực tế (danh sách phiên, Hoạt động bảo mật của người dùng). Mỗi phút một lần,
 * ShedLock để chỉ một node chạy (cùng khuôn {@code StaleAsyncJobExpirer}); method {@code void} theo
 * {@code SchedulerLockVoidContractTest}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SupportSessionExpiryJob {

    private final SupportSessionService service;

    @Scheduled(
            fixedDelayString = "${app.support-session.expire-sweep-delay-ms:60000}",
            initialDelayString = "${app.support-session.expire-sweep-initial-delay-ms:60000}")
    @SchedulerLock(name = "supportSessionExpire", lockAtMostFor = "PT2M", lockAtLeastFor = "PT20S")
    public void expireOverdueSessions() {
        try {
            int n = service.expireOverdue();
            if (n > 0) {
                log.info("[SupportSession] Đã đóng {} phiên hỗ trợ quá hạn", n);
            }
        } catch (RuntimeException e) {
            log.warn("[SupportSession] Quét phiên quá hạn thất bại: {}", e.getMessage());
        }
    }
}
