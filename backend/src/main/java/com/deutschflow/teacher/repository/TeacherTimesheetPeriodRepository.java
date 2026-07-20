package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.TeacherTimesheetPeriod;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface TeacherTimesheetPeriodRepository extends JpaRepository<TeacherTimesheetPeriod, Long> {

    Optional<TeacherTimesheetPeriod> findByTeacherIdAndPeriodStart(Long teacherId, LocalDate periodStart);

    /**
     * Kỳ đang phủ một ngày cụ thể. Dùng để biết một dòng công có nằm trong kỳ đã khoá hay không
     * trước khi cho thêm/sửa/xoá.
     */
    Optional<TeacherTimesheetPeriod> findByTeacherIdAndPeriodStartLessThanEqualAndPeriodEndGreaterThanEqual(
            Long teacherId, LocalDate onDate, LocalDate sameDate);

    /** Mọi kỳ của một tổ chức trong khoảng — màn hình duyệt của manager. */
    List<TeacherTimesheetPeriod> findByOrgIdAndPeriodStartGreaterThanEqualAndPeriodStartLessThanEqualOrderByPeriodStartDescTeacherIdAsc(
            Long orgId, LocalDate from, LocalDate to);

    List<TeacherTimesheetPeriod> findByTeacherIdOrderByPeriodStartDesc(Long teacherId);
}
