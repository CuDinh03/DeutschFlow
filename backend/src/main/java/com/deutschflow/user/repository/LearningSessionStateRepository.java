package com.deutschflow.user.repository;

import com.deutschflow.user.entity.LearningSessionState;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LearningSessionStateRepository extends JpaRepository<LearningSessionState, Long> {
    Optional<LearningSessionState> findByUserIdAndWeekNumberAndSessionIndex(Long userId, int weekNumber, int sessionIndex);
}

