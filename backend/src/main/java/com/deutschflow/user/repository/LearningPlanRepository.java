package com.deutschflow.user.repository;

import com.deutschflow.user.entity.LearningPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LearningPlanRepository extends JpaRepository<LearningPlan, Long> {
    Optional<LearningPlan> findByUserId(Long userId);
}

