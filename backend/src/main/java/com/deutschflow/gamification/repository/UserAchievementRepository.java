package com.deutschflow.gamification.repository;

import com.deutschflow.gamification.entity.UserAchievement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface UserAchievementRepository extends JpaRepository<UserAchievement, Long> {

    List<UserAchievement> findByUserId(Long userId);

    /** Pending notification (unlocked but FE hasn't shown the badge toast yet). */
    List<UserAchievement> findByUserIdAndNotifiedFalse(Long userId);

    boolean existsByUserIdAndAchievementId(Long userId, Long achievementId);
}
