package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

/**
 * Ghi danh của học viên trong lớp.
 *
 * <p><b>G-01 — mặc định an toàn.</b> Từ V316 mỗi dòng mang một trạng thái vòng đời, và người đã rời
 * lớp KHÔNG bị xoá dòng (D2: bài nộp/điểm/điểm danh giữ nguyên). Vì vậy các phương thức "trần"
 * dưới đây được viết lại bằng {@code @Query} để LUÔN lọc, thay vì để hàng chục call-site tự nhớ:
 *
 * <ul>
 *   <li><b>Còn chiếm ghế</b> = {@code {ACTIVE, RESERVED}} — mặc định của mọi phép đếm sĩ số, dựng
 *       roster, và kiểm quyền vào lớp. Bảo lưu VẪN tính chỗ và VẪN xem được nội dung (D1).</li>
 *   <li><b>Đang học</b> = {@code {ACTIVE}} — dùng cho điểm danh và giao bài mới; người bảo lưu chỉ
 *       đọc nên không có mặt trong hai việc đó. Xem {@link #findActiveByIdClassId}.</li>
 * </ul>
 *
 * <p>{@link #findById}/{@link #existsById} kế thừa vẫn thấy MỌI dòng — cố ý, để chấm/đọc lại đánh
 * giá của một học viên đã rời lớp vẫn hoạt động.
 */
@Repository
public interface ClassStudentRepository extends JpaRepository<ClassStudent, ClassStudentId> {

    /** Roster "còn chiếm ghế" của một lớp (ACTIVE + RESERVED). */
    @Query("SELECT cs FROM ClassStudent cs WHERE cs.id.classId = :classId "
            + "AND cs.status IN ('ACTIVE', 'RESERVED')")
    List<ClassStudent> findByIdClassId(@Param("classId") Long classId);

    /** Batch variant to avoid an N+1 across a teacher's classes (audit L-4). */
    @Query("SELECT cs FROM ClassStudent cs WHERE cs.id.classId IN :classIds "
            + "AND cs.status IN ('ACTIVE', 'RESERVED')")
    List<ClassStudent> findByIdClassIdIn(@Param("classIds") Collection<Long> classIds);

    /** Các lớp học viên còn ghi danh (kể cả bảo lưu — D1 cho phép xem chỉ đọc). */
    @Query("SELECT cs FROM ClassStudent cs WHERE cs.id.studentId = :studentId "
            + "AND cs.status IN ('ACTIVE', 'RESERVED')")
    List<ClassStudent> findByIdStudentId(@Param("studentId") Long studentId);

    /**
     * MỌI ghi danh của một học viên, KỂ CẢ đã kết thúc hoặc chuyển lớp — dành riêng cho các đường
     * NHÌN LẠI QUÁ TRÌNH (R12: trung tâm đọc hồ sơ đánh giá của một học viên).
     *
     * <p>🪤 Khác {@link #findByIdStudentId}: bản kia lọc {@code ACTIVE/RESERVED} nên trả lời câu
     * "học viên này đang học ở đâu" — đó mới là thứ mọi đường nghiệp vụ (điểm danh, giao bài, tính
     * ghế) phải dùng. Lấy nhầm bản đầy đủ này vào một đường ghi là hồi sinh ghi danh đã đóng.
     */
    @Query("SELECT cs FROM ClassStudent cs WHERE cs.id.studentId = :studentId")
    List<ClassStudent> findAllEnrollmentsOfStudent(@Param("studentId") Long studentId);

    /** Biên quyền "người này có thuộc lớp không" — người đã rời lớp trả false. */
    @Query("SELECT CASE WHEN COUNT(cs) > 0 THEN true ELSE false END FROM ClassStudent cs "
            + "WHERE cs.id.classId = :classId AND cs.id.studentId = :studentId "
            + "AND cs.status IN ('ACTIVE', 'RESERVED')")
    boolean existsByIdClassIdAndIdStudentId(@Param("classId") Long classId,
                                            @Param("studentId") Long studentId);

    /** Sĩ số = số người còn chiếm ghế (D1: bảo lưu vẫn tính). */
    @Query("SELECT COUNT(cs) FROM ClassStudent cs WHERE cs.id.classId = :classId "
            + "AND cs.status IN ('ACTIVE', 'RESERVED')")
    long countByIdClassId(@Param("classId") Long classId);

    /** Chỉ người ĐANG HỌC — biên cho điểm danh và fan-out bài tập mới (bảo lưu = chỉ đọc). */
    @Query("SELECT cs FROM ClassStudent cs WHERE cs.id.classId = :classId AND cs.status = 'ACTIVE'")
    List<ClassStudent> findActiveByIdClassId(@Param("classId") Long classId);

    /** Xoá cứng — chỉ dùng khi xoá cả lớp (không còn gì để giữ lịch sử cho). */
    void deleteByIdClassId(Long classId);

    /**
     * G-03: đóng mọi ghi danh của một học viên trong các lớp CỦA MỘT TRUNG TÂM khi họ rời trung tâm.
     *
     * <p>Một câu UPDATE, join sang {@code teacher_classes} để chỉ chạm lớp có {@code org_id} đúng
     * bằng trung tâm ấy — lớp B2C của chính học viên đó ({@code org_id IS NULL}) và lớp của trung
     * tâm khác KHÔNG bị đụng tới.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE class_students cs
            SET    status = 'ENDED', ended_at = :endedAt, end_reason = :reason
            FROM   teacher_classes tc
            WHERE  tc.id = cs.class_id
              AND  tc.org_id = :orgId
              AND  cs.student_id = :studentId
              AND  cs.status IN ('ACTIVE', 'RESERVED')
            """, nativeQuery = true)
    int endEnrollmentsInOrg(@Param("orgId") Long orgId,
                            @Param("studentId") Long studentId,
                            @Param("endedAt") LocalDateTime endedAt,
                            @Param("reason") String reason);

    /**
     * Mở lại một ghi danh đã đóng mà GIỮ NGUYÊN nhận xét + điểm kỹ năng (D2).
     *
     * <p>Cần thiết vì các đường thêm học viên dựng một {@code ClassStudent} mới rồi {@code save()};
     * với khoá chính đã tồn tại thì đó là một lần merge và mọi cột không được gán (teacher_comment,
     * skill_*) bị ghi đè NULL.
     *
     * <p>🔑 Chỉ mở lại {@code ENDED} và {@code TRANSFERRED}. Người đang {@code RESERVED} (bảo lưu)
     * KHÔNG bị lật về ACTIVE: bảo lưu là một quyết định có chủ ý của trung tâm (D1), mà đường dễ vấp
     * nhất là nhập lại roster CSV — một học viên đang bảo lưu có tên trong tệp sẽ âm thầm mất trạng
     * thái đó. Trả 0 nghĩa là "lượt này không đưa ai (trở) vào lớp", đúng cho cờ {@code enrolled}.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE ClassStudent cs
            SET    cs.status = 'ACTIVE', cs.endedAt = null, cs.endReason = null,
                   cs.transferredToClassId = null
            WHERE  cs.id.classId = :classId AND cs.id.studentId = :studentId
              AND  cs.status IN ('ENDED', 'TRANSFERRED')
            """)
    int reopenEnrollment(@Param("classId") Long classId, @Param("studentId") Long studentId);
}
