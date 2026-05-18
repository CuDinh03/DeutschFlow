package com.deutschflow.speaking.repository;

import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.entity.AiSpeakingSession.SessionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface AiSpeakingSessionRepository extends JpaRepository<AiSpeakingSession, Long> {

    Page<AiSpeakingSession> findByUserId(Long userId, Pageable pageable);

    List<AiSpeakingSession> findByUserIdOrderByStartedAtDesc(Long userId);

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

    /** Count ENDED sessions for a user before a given timestamp. */
    @Query("SELECT COUNT(s) FROM AiSpeakingSession s WHERE s.userId = :userId " +
           "AND s.status = 'ENDED' AND s.startedAt < :before")
    long countEndedBefore(@Param("userId") Long userId, @Param("before") LocalDateTime before);

    /** Average effective score (teacherScore if present, else aiScore) for sessions before a timestamp. */
    @Query("SELECT COALESCE(AVG(CASE WHEN s.teacherScore IS NOT NULL THEN s.teacherScore ELSE s.aiScore END), 0) " +
           "FROM AiSpeakingSession s WHERE s.userId = :userId AND s.status = 'ENDED' " +
           "AND s.startedAt < :before " +
           "AND (s.teacherScore IS NOT NULL OR s.aiScore IS NOT NULL)")
    double avgScoreBefore(@Param("userId") Long userId, @Param("before") LocalDateTime before);

    /** Count ENDED sessions for a user on or after a given timestamp. */
    @Query("SELECT COUNT(s) FROM AiSpeakingSession s WHERE s.userId = :userId " +
           "AND s.status = 'ENDED' AND s.startedAt >= :after")
    long countEndedAfter(@Param("userId") Long userId, @Param("after") LocalDateTime after);

    /** Average effective score for sessions on or after a timestamp. */
    @Query("SELECT COALESCE(AVG(CASE WHEN s.teacherScore IS NOT NULL THEN s.teacherScore ELSE s.aiScore END), 0) " +
           "FROM AiSpeakingSession s WHERE s.userId = :userId AND s.status = 'ENDED' " +
           "AND s.startedAt >= :after " +
           "AND (s.teacherScore IS NOT NULL OR s.aiScore IS NOT NULL)")
    double avgScoreAfter(@Param("userId") Long userId, @Param("after") LocalDateTime after);
}
