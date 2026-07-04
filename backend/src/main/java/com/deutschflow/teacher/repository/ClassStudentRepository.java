package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface ClassStudentRepository extends JpaRepository<ClassStudent, ClassStudentId> {
    List<ClassStudent> findByIdClassId(Long classId);
    /** Batch variant to avoid an N+1 across a teacher's classes (audit L-4). */
    List<ClassStudent> findByIdClassIdIn(Collection<Long> classIds);
    List<ClassStudent> findByIdStudentId(Long studentId);
    boolean existsByIdClassIdAndIdStudentId(Long classId, Long studentId);
    long countByIdClassId(Long classId);
    void deleteByIdClassId(Long classId);
}
