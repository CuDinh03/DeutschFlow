package com.deutschflow.common.minor;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Đọc sổ đồng ý và ghi THÊM dòng mới.
 *
 * <p>⛔ <b>KHÔNG được thêm bất kỳ {@code @Modifying} UPDATE/DELETE nào vào đây.</b>
 * {@code student_consents} là sổ chỉ-ghi-thêm: thu hồi = {@code save()} một dòng
 * {@link StudentConsent.Action#REVOKED} mới. Trigger {@code trg_student_consents_immutable} sẽ
 * chặn, nhưng nó chặn LÚC CHẠY — một câu xoá lọt qua review sẽ thành sự cố production chứ không
 * phải lỗi biên dịch. {@code deleteById}/{@code delete} kế thừa từ {@link JpaRepository} vẫn tồn
 * tại vì Spring Data không cho ẩn; gọi chúng là chạm vào trigger.
 */
@Repository
public interface StudentConsentRepository extends JpaRepository<StudentConsent, Long> {

    /**
     * Dòng có hiệu lực MỚI NHẤT cho một phạm vi — đây là "trạng thái đồng ý hiện tại", không phải
     * dòng {@code GRANTED} gần nhất.
     *
     * <p>Sắp theo {@code effective_at} (lúc đồng ý thật) chứ không theo {@code created_at}: một tờ
     * giấy thu hồi ký hôm qua mà hôm nay mới nhập vào vẫn phải THẮNG lần cấp đã nhập từ tuần trước.
     * Phá vỡ thế cân bằng bằng {@code id DESC} để hai dòng trùng {@code effective_at} (nhập gộp,
     * cấp rồi thu hồi trong cùng một phút) luôn cho ra cùng một câu trả lời — dòng ghi SAU thắng.
     *
     * <p>Khớp index {@code idx_student_consents_subject (student_user_id, scope, effective_at DESC)}.
     */
    Optional<StudentConsent> findFirstByStudentUserIdAndScopeOrderByEffectiveAtDescIdDesc(
            Long studentUserId, StudentConsent.Scope scope);

    /** Toàn bộ sổ của một học viên, mới nhất trước — đường đọc bằng chứng khi bị hỏi lại. */
    List<StudentConsent> findByStudentUserIdOrderByEffectiveAtDescIdDesc(Long studentUserId);
}
