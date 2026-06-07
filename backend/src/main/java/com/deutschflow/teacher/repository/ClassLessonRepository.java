package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.ClassLesson;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClassLessonRepository extends JpaRepository<ClassLesson, Long> {

    List<ClassLesson> findByClassIdOrderByOrderIndexAsc(Long classId);

    long countByClassId(Long classId);

    long countByClassIdAndCompletedTrue(Long classId);

    @Query("SELECT COALESCE(MAX(l.orderIndex), -1) FROM ClassLesson l WHERE l.classId = :classId")
    int findMaxOrderIndex(@Param("classId") Long classId);
}
