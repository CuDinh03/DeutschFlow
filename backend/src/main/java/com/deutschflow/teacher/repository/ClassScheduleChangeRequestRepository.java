package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.ClassScheduleChangeRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ClassScheduleChangeRequestRepository extends JpaRepository<ClassScheduleChangeRequest, Long> {

    List<ClassScheduleChangeRequest> findByClassIdOrderByRequestedAtDesc(Long classId);

    Optional<ClassScheduleChangeRequest> findByIdAndClassId(Long id, Long classId);

    /** Hàng chờ duyệt của trung tâm — join qua lớp vì request không lưu org_id (org đổi thì theo lớp). */
    @Query("""
            SELECT r FROM ClassScheduleChangeRequest r, TeacherClass c
            WHERE r.classId = c.id AND c.orgId = :orgId AND r.status = 'PENDING'
            ORDER BY r.requestedAt ASC
            """)
    List<ClassScheduleChangeRequest> findPendingByOrg(@Param("orgId") Long orgId);

    /**
     * Chuyển PENDING → trạng thái duyệt bằng UPDATE CÓ ĐIỀU KIỆN — hai người duyệt cùng lúc thì một
     * người thắng (1 row), người kia nhận 0 row (AC10). Gọi trong CÙNG giao dịch với bước áp lịch:
     * áp thất bại (base_version lệch, xung đột giờ…) → rollback trả request về PENDING nguyên vẹn.
     */
    @Modifying
    @Query("""
            UPDATE ClassScheduleChangeRequest r
            SET r.status = :status, r.reviewedBy = :reviewerId, r.reviewedAt = :now,
                r.rejectReason = :rejectReason, r.updatedAt = :now
            WHERE r.id = :id AND r.status = 'PENDING'
            """)
    int transitionFromPending(@Param("id") Long id,
                              @Param("status") ClassScheduleChangeRequest.Status status,
                              @Param("reviewerId") Long reviewerId,
                              @Param("rejectReason") String rejectReason,
                              @Param("now") LocalDateTime now);

    /** Giáo viên rút đề xuất của CHÍNH MÌNH khi còn PENDING — cùng kỹ thuật UPDATE có điều kiện. */
    @Modifying
    @Query("""
            UPDATE ClassScheduleChangeRequest r
            SET r.status = 'CANCELLED', r.updatedAt = :now
            WHERE r.id = :id AND r.requestedBy = :teacherId AND r.status = 'PENDING'
            """)
    int cancelOwnPending(@Param("id") Long id, @Param("teacherId") Long teacherId,
                         @Param("now") LocalDateTime now);
}
