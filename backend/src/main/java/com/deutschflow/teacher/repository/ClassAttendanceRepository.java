package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.ClassAttendance;
import com.deutschflow.teacher.entity.ClassAttendanceId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClassAttendanceRepository extends JpaRepository<ClassAttendance, ClassAttendanceId> {

    List<ClassAttendance> findByIdLessonLogId(Long lessonLogId);

    @Query("SELECT a FROM ClassAttendance a WHERE a.id.lessonLogId IN :lessonLogIds")
    List<ClassAttendance> findByLessonLogIds(@Param("lessonLogIds") List<Long> lessonLogIds);

    void deleteByIdLessonLogId(Long lessonLogId);
}
