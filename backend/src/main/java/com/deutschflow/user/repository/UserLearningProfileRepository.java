package com.deutschflow.user.repository;

import com.deutschflow.user.entity.UserLearningProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserLearningProfileRepository extends JpaRepository<UserLearningProfile, Long> {
    Optional<UserLearningProfile> findByUserId(Long userId);
}

