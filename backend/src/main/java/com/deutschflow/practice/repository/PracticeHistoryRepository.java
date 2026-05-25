package com.deutschflow.practice.repository;

import com.deutschflow.practice.entity.PracticeHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PracticeHistoryRepository extends JpaRepository<PracticeHistory, Long> {
    Page<PracticeHistory> findByUserIdOrderByCompletedAtDesc(Long userId, Pageable pageable);
}
