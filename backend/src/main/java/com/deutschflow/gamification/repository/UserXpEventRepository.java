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
}

