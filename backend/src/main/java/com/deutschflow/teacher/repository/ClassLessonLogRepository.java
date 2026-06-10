package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.ClassLessonLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClassLessonLogRepository extends JpaRepository<ClassLessonLog, Long> {
    List<ClassLessonLog> findByClassIdOrderBySessionDateAscSessionNumberAsc(Long classId);
    List<ClassLessonLog> findByClassIdOrderBySessionDateDesc(Long classId);
    int countByClassId(Long classId);
}
