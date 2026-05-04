package com.deutschflow.user.repository;

import com.deutschflow.user.entity.UserLearningProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserLearningProgressRepository extends JpaRepository<UserLearningProgress, Long> {
    Optional<UserLearningProgress> findByUserId(Long userId);
}
