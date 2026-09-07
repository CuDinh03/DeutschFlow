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

    /**
     * Danh sách lớp của trung tâm, lọc PHÍA MÁY CHỦ theo tên và theo "chưa có ai dạy" (PR-A3).
     *
     * <p>{@code :q} null nghĩa là không lọc tên. "Chưa có ai dạy" = không còn ai đang là TEACHER
     * ACTIVE của trung tâm đứng lớp — xét CẢ {@code teacher_id} lẫn {@code class_teachers}. Không
     * dùng {@code teacher_id IS NULL} được vì cột đó NOT NULL (xem OrgService#countClassesWithoutTeacher).
     *
     * <p>Native query: điều kiện NOT EXISTS trên bảng không có entity ánh xạ.
     */
    @Query(value = """
            SELECT * FROM teacher_classes tc
            WHERE tc.org_id = :orgId
              AND (CAST(:q AS text) IS NULL OR tc.name ILIKE '%' || CAST(:q AS text) || '%')
              AND (
                :withoutTeacher = FALSE
                OR NOT EXISTS (
                    SELECT 1 FROM org_members om
                     WHERE om.org_id = tc.org_id
                       AND om.status = 'ACTIVE' AND om.role = 'TEACHER'
                       AND (om.user_id = tc.teacher_id
                            OR om.user_id IN (SELECT ct.teacher_id FROM class_teachers ct WHERE ct.class_id = tc.id))
                )
              )
            """,
            countQuery = """
            SELECT COUNT(*) FROM teacher_classes tc
            WHERE tc.org_id = :orgId
              AND (CAST(:q AS text) IS NULL OR tc.name ILIKE '%' || CAST(:q AS text) || '%')
              AND (
                :withoutTeacher = FALSE
                OR NOT EXISTS (
                    SELECT 1 FROM org_members om
                     WHERE om.org_id = tc.org_id
                       AND om.status = 'ACTIVE' AND om.role = 'TEACHER'
                       AND (om.user_id = tc.teacher_id
                            OR om.user_id IN (SELECT ct.teacher_id FROM class_teachers ct WHERE ct.class_id = tc.id))
                )
              )
            """,
            nativeQuery = true)
    Page<TeacherClass> searchByOrg(@Param("orgId") Long orgId,
                                   @Param("q") String q,
                                   @Param("withoutTeacher") boolean withoutTeacher,
                                   Pageable pageable);

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
