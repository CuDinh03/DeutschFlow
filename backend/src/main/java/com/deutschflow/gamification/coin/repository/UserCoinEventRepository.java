package com.deutschflow.gamification.coin.repository;

import com.deutschflow.gamification.coin.entity.UserCoinEvent;
import com.deutschflow.gamification.coin.entity.UserCoinEvent.CoinEventType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserCoinEventRepository extends JpaRepository<UserCoinEvent, Long> {

    /** Anti-farming guard: has this node already earned a coin for this user? */
    boolean existsByUserIdAndRefNodeKindAndRefNodeIdAndEventType(
            Long userId, String refNodeKind, String refNodeId, CoinEventType eventType);

    Page<UserCoinEvent> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
}
