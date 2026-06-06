package com.deutschflow.gamification.repository;

import com.deutschflow.gamification.entity.UserAchievement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Set;

@Repository
public interface UserAchievementRepository extends JpaRepository<UserAchievement, Long> {

    List<UserAchievement> findByUserId(Long userId);

    /** Pending notification (unlocked but FE hasn't shown the badge toast yet). */
    List<UserAchievement> findByUserIdAndNotifiedFalse(Long userId);

    boolean existsByUserIdAndAchievementId(Long userId, Long achievementId);

    /**
     * IDs of all achievements this user has already unlocked. Used to test membership in-memory
     * (one query) instead of an existsBy() call per achievement in the catalogue.
     */
    @Query("SELECT ua.achievement.id FROM UserAchievement ua WHERE ua.userId = :userId")
    Set<Long> findUnlockedAchievementIdsByUserId(@Param("userId") Long userId);

    /** Mark all of a user's pending badges as notified in one statement (instead of save-per-row). */
    @Modifying
    @Query("UPDATE UserAchievement ua SET ua.notified = true WHERE ua.userId = :userId AND ua.notified = false")
    int markAllNotifiedByUserId(@Param("userId") Long userId);
}
