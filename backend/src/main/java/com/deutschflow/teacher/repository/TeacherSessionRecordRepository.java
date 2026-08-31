package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.TeacherSessionRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface TeacherSessionRecordRepository extends JpaRepository<TeacherSessionRecord, Long> {

    /** Bảng công của một giáo viên trong kỳ [from, to). Mốc là thời điểm THỰC DẠY. */
    List<TeacherSessionRecord> findByTeacherIdAndStartedAtGreaterThanEqualAndStartedAtLessThanOrderByStartedAt(
            Long teacherId, LocalDateTime from, LocalDateTime to);

    /** Đã ghi công cho buổi lịch này chưa (dùng để đánh dấu gợi ý đã xử lý). */
    List<TeacherSessionRecord> findByTeacherIdAndSessionIdIn(Long teacherId, List<Long> sessionIds);

    /**
     * Tổng hợp toàn tổ chức trong kỳ — phục vụ màn hình manager. Dùng {@code org_id} đã snapshot
     * nên không phải bắc cầu qua teacher_classes như {@code weekForOrg} buộc phải làm.
     */
    @Query("""
            SELECT r FROM TeacherSessionRecord r
            WHERE r.orgId = :orgId AND r.startedAt >= :from AND r.startedAt < :to
            ORDER BY r.teacherId, r.startedAt
            """)
    List<TeacherSessionRecord> findForOrgInRange(@Param("orgId") Long orgId,
                                                 @Param("from") LocalDateTime from,
                                                 @Param("to") LocalDateTime to);
}
