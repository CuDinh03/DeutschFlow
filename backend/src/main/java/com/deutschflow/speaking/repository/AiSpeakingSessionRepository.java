package com.deutschflow.speaking.repository;

import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.entity.AiSpeakingSession.SessionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;

public interface AiSpeakingSessionRepository extends JpaRepository<AiSpeakingSession, Long> {

    Page<AiSpeakingSession> findByUserId(Long userId, Pageable pageable);

    List<AiSpeakingSession> findTop7ByUserIdOrderByStartedAtDesc(Long userId);

    List<AiSpeakingSession> findByUserIdAndSessionModeOrderByStartedAtDesc(Long userId, String sessionMode);

    /** Find all ACTIVE sessions for a given user — used to auto-end old ones. */
    List<AiSpeakingSession> findByUserIdAndStatusOrderByStartedAtAsc(Long userId, SessionStatus status);

    /** Bulk-end zombie sessions that have been idle too long. Returns count of rows updated. */
    @Modifying
    @Query("UPDATE AiSpeakingSession s SET s.status = 'ENDED', s.endedAt = :now " +
           "WHERE s.status = 'ACTIVE' " +
           "AND (s.lastActivityAt < :cutoff OR (s.lastActivityAt IS NULL AND s.startedAt < :cutoff))")
    int endStaleSessions(LocalDateTime cutoff, LocalDateTime now);
}
