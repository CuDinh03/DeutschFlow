package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.ClassSchedulePattern;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClassSchedulePatternRepository extends JpaRepository<ClassSchedulePattern, Long> {

    List<ClassSchedulePattern> findByClassIdOrderByDayOfWeekAscStartTimeAsc(Long classId);

    List<ClassSchedulePattern> findByClassIdAndDayOfWeek(Long classId, short dayOfWeek);
}
