package com.deutschflow.gamification.coin.repository;

import com.deutschflow.gamification.coin.entity.UserMockTrialPass;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface UserMockTrialPassRepository extends JpaRepository<UserMockTrialPass, Long> {

    boolean existsByUserIdAndPackIdAndStatus(Long userId, Long packId, String status);

    Optional<UserMockTrialPass> findFirstByUserIdAndPackIdAndStatusOrderByPurchasedAtAsc(
            Long userId, Long packId, String status);

    @Query("SELECT t.packId FROM UserMockTrialPass t WHERE t.userId = ?1 AND t.status = ?2")
    List<Long> findPackIdsByUserIdAndStatus(Long userId, String status);
}
