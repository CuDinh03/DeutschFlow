package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.StudentReportIssue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Phiếu đã phát hành (V323, R2). Đợt này chỉ có đường đọc + hai thao tác nguyên tử; service phát hành là PR-R2.
 *
 * <p>⛔ Không thêm {@code @Modifying} UPDATE nào đụng cột nội dung: trigger
 * {@code trg_student_report_issues_immutable} sẽ chặn LÚC CHẠY, tức thành sự cố production chứ không phải
 * lỗi biên dịch. {@code delete*} kế thừa vẫn tồn tại — cố ý không chặn DELETE ở DB vì xoá tài khoản phải
 * mang phiếu đi; đừng gọi chúng từ tính năng, "thu hồi" mới là thao tác của sản phẩm.
 */
@Repository
public interface StudentReportIssueRepository extends JpaRepository<StudentReportIssue, Long> {

    /**
     * Phiếu còn mở được qua link: đúng token, CHƯA thu hồi, CHƯA hết hạn — đường đọc công khai duy nhất
     * (PR-R2 gắn rate limit fail-closed lên trên). Khớp {@code idx_student_report_issues_active_token}.
     * Không tách "hết hạn" khỏi "thu hồi" khỏi "không tồn tại" ở đây: trang công khai trả cùng một 404.
     */
    @Query("""
            SELECT i FROM StudentReportIssue i
             WHERE i.token = :token
               AND i.revokedAt IS NULL
               AND i.tokenExpiresAt > :now
            """)
    Optional<StudentReportIssue> findActiveByToken(@Param("token") String token, @Param("now") Instant now);

    /** Lịch sử phát hành một kỳ của lớp, mới nhất trước — màn phát hành của giáo viên. */
    List<StudentReportIssue> findByClassIdAndPeriodOrderByIssuedAtDesc(Long classId, StudentReportIssue.Period period);

    /** Toàn bộ phiếu của lớp (mọi kỳ), mới nhất trước. */
    List<StudentReportIssue> findByClassIdOrderByIssuedAtDesc(Long classId);

    /**
     * Phiếu CÒN HIỆU LỰC (chưa thu hồi) của một học viên cho một kỳ trong lớp — đây là tập mà "phát hành
     * lại cùng kỳ" phải thu hồi với lý do SUPERSEDED trước khi chèn dòng mới.
     */
    List<StudentReportIssue> findByClassIdAndStudentIdAndPeriodAndRevokedAtIsNull(
            Long classId, Long studentId, StudentReportIssue.Period period);

    /** "Phiếu đã gửi gia đình" của một học viên (R6: học viên xem đúng bản đã gửi), mới nhất trước. */
    List<StudentReportIssue> findByStudentIdOrderByIssuedAtDesc(Long studentId);

    /**
     * Ghi một lượt mở: tăng bộ đếm NGUYÊN TỬ ở DB và đóng dấu thời điểm. Cố ý không đi qua entity
     * ({@code viewCount} là {@code updatable = false}) để hai người mở cùng lúc không làm mất lượt của nhau.
     * Caller phải mở transaction (khuôn {@code UserNotificationRepository.markOneRead}).
     */
    @Modifying
    @Query("UPDATE StudentReportIssue i SET i.viewCount = i.viewCount + 1, i.lastViewedAt = :at WHERE i.id = :id")
    int recordView(@Param("id") Long id, @Param("at") Instant at);
}
