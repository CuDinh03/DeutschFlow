package com.deutschflow.speaking.repository;

import com.deutschflow.speaking.entity.ErrorReviewTask;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ErrorReviewTaskRepository extends JpaRepository<ErrorReviewTask, Long> {

    @Query("""
            SELECT t FROM ErrorReviewTask t
            WHERE t.userId = :userId AND t.status = :status AND t.dueAt <= :now
            ORDER BY t.dueAt ASC
            """)
    List<ErrorReviewTask> findDueTasks(
            @Param("userId") Long userId,
            @Param("status") String status,
            @Param("now") LocalDateTime now,
            Pageable pageable);

    long countByUserIdAndErrorCodeAndStatus(Long userId, String errorCode, String status);

    @Modifying
    @Query("""
            UPDATE ErrorReviewTask t
            SET t.status = 'COMPLETED', t.completedAt = :now
            WHERE t.userId = :userId AND t.errorCode = :code AND t.status = 'PENDING'
            """)
    int completePendingForUserAndCode(
            @Param("userId") Long userId,
            @Param("code") String code,
            @Param("now") LocalDateTime now);
}
