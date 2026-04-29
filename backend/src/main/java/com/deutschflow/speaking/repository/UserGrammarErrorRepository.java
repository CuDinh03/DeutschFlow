package com.deutschflow.speaking.repository;

import com.deutschflow.speaking.dto.WeakPoint;
import com.deutschflow.speaking.entity.UserGrammarError;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface UserGrammarErrorRepository extends JpaRepository<UserGrammarError, Long> {

    List<UserGrammarError> findTop20ByUserIdOrderByCreatedAtDesc(Long userId);

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
}
