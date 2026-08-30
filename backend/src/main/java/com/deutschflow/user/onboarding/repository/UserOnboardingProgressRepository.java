package com.deutschflow.user.onboarding.repository;

import com.deutschflow.user.onboarding.entity.UserOnboardingProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserOnboardingProgressRepository extends JpaRepository<UserOnboardingProgress, Long> {
}
