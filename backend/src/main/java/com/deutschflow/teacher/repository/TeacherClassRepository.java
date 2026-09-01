package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.TeacherClass;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * NOTE: "which classes does this teacher work with" is the class_teachers relation
 * (PRIMARY/ASSISTANT) — resolve it via ClassTeacherRepository, not a creator-column query here.
 * The old {@code findByTeacherId} (creator column) hid co-taught classes from the aggregate
 * reports (F04) and was removed with its last caller.
 */
@Repository
public interface TeacherClassRepository extends JpaRepository<TeacherClass, Long> {
    Optional<TeacherClass> findByInviteCode(String inviteCode);

    /** Lớp có thuộc trung tâm không — guard học vụ tự vệ với classId do caller truyền (PR-2/M1). */
    boolean existsByIdAndOrgId(Long id, Long orgId);

    /** Org-scoped read for the B2B org admin (GET /api/org/classes). */
    Page<TeacherClass> findByOrgId(Long orgId, Pageable pageable);

    /** All classes in an org — for org-admin center-wide reads (G-3 schedule). */
    List<TeacherClass> findByOrgId(Long orgId);

    /**
     * So-khớp-và-tăng phiên bản lịch (V294, AC10) trong giao dịch áp đề xuất: 1 = nền còn đúng,
     * đã tăng; 0 = lịch đã đổi từ lúc đề xuất → người duyệt phải tính lại, giao dịch rollback.
     */
    @Modifying
    @Query("UPDATE TeacherClass c SET c.scheduleVersion = c.scheduleVersion + 1 " +
           "WHERE c.id = :classId AND c.scheduleVersion = :expected")
    int bumpScheduleVersion(@Param("classId") Long classId, @Param("expected") long expected);
}
