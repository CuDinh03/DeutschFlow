package com.deutschflow.gamification.repository;

import com.deutschflow.gamification.entity.UserXpEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserXpEventRepository extends JpaRepository<UserXpEvent, Long> {

    /** Total XP for a user across all events. */
    @Query("SELECT COALESCE(SUM(e.xpAmount), 0) FROM UserXpEvent e WHERE e.userId = :userId")
    long sumXpByUserId(@Param("userId") Long userId);

    /** Count of completed speaking sessions for achievement triggers. */
    @Query("SELECT COUNT(e) FROM UserXpEvent e WHERE e.userId = :userId AND e.eventType = 'SESSION_COMPLETE'")
    long countSessionCompleteByUserId(@Param("userId") Long userId);

    /** Count of errors fixed for achievement triggers. */
    @Query("SELECT COUNT(e) FROM UserXpEvent e WHERE e.userId = :userId AND e.eventType = 'ERROR_FIXED'")
    long countErrorsFixedByUserId(@Param("userId") Long userId);

    /** Check if a specific one-time event already exists. */
    boolean existsByUserIdAndEventType(Long userId, UserXpEvent.XpEventType eventType);

    /** Count satellite/industry node completions */
    @Query("SELECT COUNT(e) FROM UserXpEvent e WHERE e.userId = :userId AND e.eventType = 'SATELLITE_COMPLETE'")
    long countSatelliteCompleteByUserId(@Param("userId") Long userId);

    /** Count SRS review events (for achievement triggers) */
    @Query("SELECT COUNT(e) FROM UserXpEvent e WHERE e.userId = :userId AND e.eventType = 'SRS_REVIEW'")
    long countSrsReviewsByUserId(@Param("userId") Long userId);

    /** Count satellite completions with a specific industry tag (stored in note field) */
    @Query("SELECT COUNT(e) FROM UserXpEvent e WHERE e.userId = :userId AND e.eventType = 'SATELLITE_COMPLETE' AND e.note LIKE :industryPrefix")
    long countSatelliteByIndustry(@Param("userId") Long userId, @Param("industryPrefix") String industryPrefix);

    /**
     * Top users by total XP for the leaderboard.
     * Returns Object[] rows: [userId (Long), displayName (String), totalXp (Long)]
     * Joins to the users table to fetch displayName without exposing email.
     */
    @Query("""
        SELECT e.userId, u.displayName, COALESCE(SUM(e.xpAmount), 0) AS totalXp
        FROM UserXpEvent e
        JOIN User u ON u.id = e.userId
        GROUP BY e.userId, u.displayName
        ORDER BY totalXp DESC
        """)
    List<Object[]> findTopUsersByXp(Pageable pageable);

    @Query("""
        SELECT e.userId, u.displayName, COALESCE(SUM(e.xpAmount), 0) AS totalXp
        FROM UserXpEvent e
        JOIN User u ON u.id = e.userId
        WHERE e.userId IN (SELECT cs.id.studentId FROM ClassStudent cs WHERE cs.id.classId = :classId)
        GROUP BY e.userId, u.displayName
        ORDER BY totalXp DESC
        """)
    List<Object[]> findClassLeaderboardAllTime(@Param("classId") Long classId);

    @Query("""
        SELECT e.userId, u.displayName, COALESCE(SUM(e.xpAmount), 0) AS totalXp
        FROM UserXpEvent e
        JOIN User u ON u.id = e.userId
        WHERE e.userId IN (SELECT cs.id.studentId FROM ClassStudent cs WHERE cs.id.classId = :classId)
          AND e.createdAt >= :startDate
        GROUP BY e.userId, u.displayName
        ORDER BY totalXp DESC
        """)
    List<Object[]> findClassLeaderboardSince(@Param("classId") Long classId, @Param("startDate") java.time.LocalDateTime startDate);
}

