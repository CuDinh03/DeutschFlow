package com.deutschflow.speaking.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for SessionTurnGuard using the in-memory fallback (null Redis).
 * Redis-backed behaviour is structurally identical; only the storage layer changes.
 */
@DisplayName("SessionTurnGuard (in-memory fallback) Unit Tests")
class SessionTurnGuardTest {

    private final SessionTurnGuard guard = new SessionTurnGuard(null);

    @Test
    @DisplayName("tryAcquire returns true on first acquire for a session")
    void tryAcquire_firstCall_returnsTrue() {
        assertThat(guard.tryAcquire(1L)).isTrue();
    }

    @Test
    @DisplayName("tryAcquire returns false when session is already locked")
    void tryAcquire_alreadyLocked_returnsFalse() {
        guard.tryAcquire(2L);

        assertThat(guard.tryAcquire(2L)).isFalse();
    }

    @Test
    @DisplayName("tryAcquire succeeds after release")
    void tryAcquire_afterRelease_returnsTrue() {
        guard.tryAcquire(3L);
        guard.release(3L);

        assertThat(guard.tryAcquire(3L)).isTrue();
    }

    @Test
    @DisplayName("locks for different sessions are independent")
    void tryAcquire_differentSessions_independent() {
        assertThat(guard.tryAcquire(10L)).isTrue();
        assertThat(guard.tryAcquire(11L)).isTrue();
    }

    @Test
    @DisplayName("release of unknown session is a no-op")
    void release_unknownSession_noException() {
        guard.release(999L); // must not throw
    }
}
