package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.ClassAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClassAssignmentRepository extends JpaRepository<ClassAssignment, Long> {
    List<ClassAssignment> findByClassIdOrderByCreatedAtDesc(Long classId);
    long countByClassId(Long classId);
    void deleteByClassId(Long classId);
}
