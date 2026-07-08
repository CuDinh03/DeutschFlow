package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.LessonKnowledgePoint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LessonKnowledgePointRepository extends JpaRepository<LessonKnowledgePoint, Long> {

    List<LessonKnowledgePoint> findByLessonIdOrderByOrderIndexAsc(Long lessonId);

    /** Batch-load points for many lessons (avoids N+1 when listing a class). */
    List<LessonKnowledgePoint> findByLessonIdInOrderByLessonIdAscOrderIndexAsc(List<Long> lessonIds);

    @Modifying
    @Query("DELETE FROM LessonKnowledgePoint p WHERE p.lessonId = :lessonId")
    void deleteByLessonId(@Param("lessonId") Long lessonId);
}
