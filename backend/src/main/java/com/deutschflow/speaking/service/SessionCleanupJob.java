package com.deutschflow.speaking.service;

import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Scheduled job that auto-ends zombie sessions.
 *
 * <p>A zombie session is one that is still ACTIVE but has had no activity for over 2 hours.
 * This happens when users close the browser tab or navigate away without pressing "Kết thúc".
 *
 * <p>Runs every 30 minutes.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SessionCleanupJob {

    private final AiSpeakingSessionRepository sessionRepository;

    /**
     * End all ACTIVE sessions whose last activity was more than 2 hours ago.
     * Runs every 30 minutes (fixedRate = 30 * 60 * 1000).
     * Initial delay of 60 seconds to let the app finish startup.
     */
    @Scheduled(fixedRate = 30 * 60 * 1000, initialDelay = 60_000)
    @Transactional
    public void cleanupZombieSessions() {
        LocalDateTime cutoff = LocalDateTime.now().minusHours(2);
        LocalDateTime now = LocalDateTime.now();
        int ended = sessionRepository.endStaleSessions(cutoff, now);
        if (ended > 0) {
            log.info("[Session-Cleanup] Auto-ended {} zombie sessions (idle > 2h)", ended);
        }
    }
}
