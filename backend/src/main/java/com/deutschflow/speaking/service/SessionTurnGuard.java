package com.deutschflow.speaking.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * In-memory per-session turn guard.
 * Prevents concurrent AI turns on the same speaking session while allowing long user answers.
 */
@Component
@Slf4j
public class SessionTurnGuard {

    private final ConcurrentHashMap<Long, AtomicBoolean> activeTurns = new ConcurrentHashMap<>();

    public boolean tryAcquire(long sessionId) {
        AtomicBoolean flag = activeTurns.computeIfAbsent(sessionId, id -> new AtomicBoolean(false));
        boolean acquired = flag.compareAndSet(false, true);
        if (!acquired) {
            log.debug("[SessionTurnGuard] session {} is already processing an active turn", sessionId);
        }
        return acquired;
    }

    public void release(long sessionId) {
        AtomicBoolean flag = activeTurns.get(sessionId);
        if (flag != null) {
            flag.set(false);
        }
    }
}
