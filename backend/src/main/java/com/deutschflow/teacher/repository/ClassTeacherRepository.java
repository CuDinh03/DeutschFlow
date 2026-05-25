package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.ClassTeacherId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClassTeacherRepository extends JpaRepository<ClassTeacher, ClassTeacherId> {
    List<ClassTeacher> findByIdTeacherId(Long teacherId);
    boolean existsByIdClassIdAndIdTeacherId(Long classId, Long teacherId);
    void deleteByIdClassId(Long classId);
}
