package com.deutschflow.speaking.repository;

import com.deutschflow.speaking.dto.WeakPoint;
import com.deutschflow.speaking.entity.UserGrammarError;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UserGrammarErrorRepository extends JpaRepository<UserGrammarError, Long> {

    List<UserGrammarError> findTop20ByUserIdOrderByCreatedAtDesc(Long userId);

    List<UserGrammarError> findByMessageIdIn(Collection<Long> messageIds);

    boolean existsByMessageIdAndErrorCode(Long messageId, String errorCode);

    boolean existsByMessageIdAndSeverityAndRepairStatus(
            Long messageId,
            String severity,
            String repairStatus);

    Optional<UserGrammarError> findFirstByMessageIdAndSeverityAndRepairStatusOrderByIdAsc(
            Long messageId,
            String severity,
            String repairStatus);

    Optional<UserGrammarError> findFirstByUserIdAndErrorCodeOrderByCreatedAtDesc(Long userId, String errorCode);

    Optional<UserGrammarError> findFirstByUserIdAndGrammarPointOrderByCreatedAtDesc(Long userId, String grammarPoint);

    /**
     * Returns the top grammar weak points for a user, ordered by occurrence frequency.
     * Use {@code Pageable.ofSize(5)} to limit to top 5.
     */
    @Query("""
            SELECT new com.deutschflow.speaking.dto.WeakPoint(e.grammarPoint, COUNT(e))
            FROM UserGrammarError e
            WHERE e.userId = :userId
            GROUP BY e.grammarPoint
            ORDER BY COUNT(e) DESC
            """)
    List<WeakPoint> findTopWeakPoints(@Param("userId") Long userId, Pageable pageable);

    @Query("""
            SELECT COALESCE(e.errorCode, e.grammarPoint), COUNT(e), MAX(e.createdAt)
            FROM UserGrammarError e
            WHERE e.userId = :userId AND e.createdAt >= :since
            GROUP BY COALESCE(e.errorCode, e.grammarPoint)
            ORDER BY COUNT(e) DESC
            """)
    List<Object[]> aggregateErrorGroups(@Param("userId") Long userId, @Param("since") LocalDateTime since);

    @Modifying
    @Query("""
            UPDATE UserGrammarError e SET e.repairStatus = :status
            WHERE e.userId = :userId
              AND e.repairStatus = 'OPEN'
              AND (e.errorCode = :code OR (e.errorCode IS NULL AND e.grammarPoint = :code))
            """)
    int updateRepairStatusForOpenErrors(@Param("userId") Long userId,
                                        @Param("code") String code,
                                        @Param("status") String status);
}
