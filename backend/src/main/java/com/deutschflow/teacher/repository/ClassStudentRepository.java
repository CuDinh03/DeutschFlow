package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClassStudentRepository extends JpaRepository<ClassStudent, ClassStudentId> {
    List<ClassStudent> findByIdClassId(Long classId);
    List<ClassStudent> findByIdStudentId(Long studentId);
    boolean existsByIdClassIdAndIdStudentId(Long classId, Long studentId);
}
