package com.deutschflow.gamification.repository;

import com.deutschflow.gamification.entity.Achievement;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AchievementRepository extends JpaRepository<Achievement, Long> {
    List<Achievement> findByTriggerType(String triggerType);

    /**
     * The full achievement catalogue. Cached (Caffeine "achievements", 60-min TTL) because it is
     * read on every XP award and every summary load but changes only when an admin edits it.
     */
    @Cacheable("achievements")
    List<Achievement> findAll();
}
