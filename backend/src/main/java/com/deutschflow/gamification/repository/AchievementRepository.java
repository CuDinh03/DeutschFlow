package com.deutschflow.gamification.repository;

import com.deutschflow.gamification.entity.Achievement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AchievementRepository extends JpaRepository<Achievement, Long> {
    List<Achievement> findByTriggerType(String triggerType);
    List<Achievement> findAll();
}
