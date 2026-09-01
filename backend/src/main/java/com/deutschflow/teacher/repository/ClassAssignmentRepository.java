package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.ClassAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClassAssignmentRepository extends JpaRepository<ClassAssignment, Long> {
    List<ClassAssignment> findByClassIdOrderByCreatedAtDesc(Long classId);
    long countByClassId(Long classId);

    /** Số bài tập gắn vào các bài học cho trước — dấu vết chặn đổi/gỡ giáo trình (PR-1). */
    long countByLessonIdIn(List<Long> lessonIds);
    void deleteByClassId(Long classId);
    List<ClassAssignment> findByClassIdIn(List<Long> classIds);

    java.util.List<ClassAssignment> findBySessionId(Long sessionId);
}
