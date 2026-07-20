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
     * Các kỳ giao với một khoảng {@code [startLe, endGe]} của giáo viên: {@code period_start <= startLe
     * AND period_end >= endGe}. Hai cách gọi:
     * <ul>
     *   <li>{@code (onDate, onDate)} — kỳ đang phủ một ngày, để biết dòng công có nằm trong kỳ đã khoá
     *       không trước khi cho thêm/sửa/xoá;</li>
     *   <li>{@code (newEnd, newStart)} — mọi kỳ chồng lấp khoảng {@code [newStart, newEnd]}, để chặn mở
     *       kỳ mới đè lên kỳ đã có.</li>
     * </ul>
     * Trả về {@code List} (không phải {@code Optional}) một cách có chủ đích: dù ràng buộc EXCLUDE ở
     * V267 đã cấm chồng kỳ, một truy vấn khớp nhiều dòng phải degrade thành xử lý tường minh, không
     * ném {@code IncorrectResultSizeDataAccessException} (HTTP 500).
     */
    List<TeacherTimesheetPeriod> findByTeacherIdAndPeriodStartLessThanEqualAndPeriodEndGreaterThanEqual(
            Long teacherId, LocalDate startLe, LocalDate endGe);

    /** Mọi kỳ của một tổ chức trong khoảng — màn hình duyệt của manager. */
    List<TeacherTimesheetPeriod> findByOrgIdAndPeriodStartGreaterThanEqualAndPeriodStartLessThanEqualOrderByPeriodStartDescTeacherIdAsc(
            Long orgId, LocalDate from, LocalDate to);

    List<TeacherTimesheetPeriod> findByTeacherIdOrderByPeriodStartDesc(Long teacherId);
}
