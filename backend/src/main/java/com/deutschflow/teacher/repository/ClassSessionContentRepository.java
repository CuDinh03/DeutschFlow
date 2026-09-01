package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.ClassSessionContent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface ClassSessionContentRepository extends JpaRepository<ClassSessionContent, Long> {

    List<ClassSessionContent> findBySessionIdOrderByOrderIndexAsc(Long sessionId);

    List<ClassSessionContent> findByClassLessonIdOrderBySessionIdAscOrderIndexAsc(Long classLessonId);

    @Query("SELECT COALESCE(MAX(c.orderIndex), -1) FROM ClassSessionContent c WHERE c.sessionId = :sessionId")
    int findMaxOrderIndex(@Param("sessionId") Long sessionId);

    /** Các item bắt buộc ĐÃ dạy xong (TAUGHT) của một bài — nguồn suy hoàn thành Lektion (AC07/AC08). */
    @Query("""
            SELECT DISTINCT c.curriculumItemId FROM ClassSessionContent c
            WHERE c.classLessonId = :classLessonId AND c.status = 'TAUGHT' AND c.curriculumItemId IS NOT NULL
            """)
    List<Long> findTaughtItemIds(@Param("classLessonId") Long classLessonId);

    long countBySessionIdIn(Collection<Long> sessionIds);
}
