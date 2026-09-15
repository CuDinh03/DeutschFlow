package com.deutschflow.common.minor;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Đọc/ghi người giám hộ. Bảng này SỬA ĐƯỢC (khác {@link StudentConsentRepository}), nên
 * {@code save()} của {@link JpaRepository} là đường ghi hợp lệ.
 */
@Repository
public interface StudentGuardianRepository extends JpaRepository<StudentGuardian, Long> {

    /** Danh sách giám hộ của một học viên, người liên lạc chính đứng đầu. */
    List<StudentGuardian> findByStudentUserIdOrderByPrimaryDescIdAsc(Long studentUserId);

    /**
     * Người liên lạc chính hiện tại — {@code uq_student_guardians_primary} bảo đảm tối đa một dòng,
     * nên {@link Optional} ở đây là chốt của DB chứ không phải giả định của tầng ứng dụng.
     */
    Optional<StudentGuardian> findByStudentUserIdAndPrimaryTrue(Long studentUserId);

    /** Số lượng giám hộ đang có — vào metadata audit (SỐ LƯỢNG được phép, nội dung thì không). */
    long countByStudentUserId(Long studentUserId);
}
