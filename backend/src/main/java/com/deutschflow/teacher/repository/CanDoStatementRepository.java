package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.CanDoStatement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CanDoStatementRepository extends JpaRepository<CanDoStatement, Long> {

    List<CanDoStatement> findByLessonIdOrderByOrderIndexAsc(Long lessonId);

    /** Batch-load can-dos for many lessons (avoids N+1 when listing a class). */
    List<CanDoStatement> findByLessonIdInOrderByLessonIdAscOrderIndexAsc(List<Long> lessonIds);

    @Modifying
    @Query("DELETE FROM CanDoStatement c WHERE c.lessonId = :lessonId")
    void deleteByLessonId(@Param("lessonId") Long lessonId);
}
