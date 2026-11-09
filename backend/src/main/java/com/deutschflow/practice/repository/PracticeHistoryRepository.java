package com.deutschflow.practice.repository;

import com.deutschflow.practice.entity.PracticeHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

@Repository
public interface PracticeHistoryRepository extends JpaRepository<PracticeHistory, Long> {
    Page<PracticeHistory> findByUserIdOrderByCompletedAtDesc(Long userId, Pageable pageable);

    /**
     * A2: đã có lần hoàn thành bài này ĐƯỢC CỘNG XP trong khoảng [from, to) chưa — dùng để giới hạn
     * XP cố định của bài "external" ở 1 lần/bài/ngày (giờ VN).
     */
    @Query("SELECT COUNT(h) > 0 FROM PracticeHistory h WHERE h.user.id = :userId AND h.practiceExercise.id = :exerciseId"
            + " AND h.xpEarned > 0 AND h.completedAt >= :from AND h.completedAt < :to")
    boolean existsRewardedCompletionBetween(Long userId, Long exerciseId, LocalDateTime from, LocalDateTime to);
}
