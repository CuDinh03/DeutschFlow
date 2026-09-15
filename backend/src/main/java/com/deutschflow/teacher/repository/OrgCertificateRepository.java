package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.OrgCertificate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrgCertificateRepository extends JpaRepository<OrgCertificate, Long> {

    Optional<OrgCertificate> findByVerifyToken(String verifyToken);

    List<OrgCertificate> findByClassIdOrderByCreatedAtDesc(Long classId);

    /**
     * Chứng nhận theo id NHƯNG ép thuộc đúng trung tâm (DEC-20): giám đốc chỉ với tới chứng nhận
     * của trung tâm mình; id của trung tâm khác ⇒ rỗng ⇒ 404, không phải 403 — không để lộ là id
     * đó có tồn tại.
     */
    Optional<OrgCertificate> findByIdAndOrgId(Long id, Long orgId);

    /**
     * Sổ chứng nhận TOÀN TRUNG TÂM (DEC-20), lọc phía máy chủ theo lớp / trạng thái / tên học viên.
     *
     * <p>Native query cùng khuôn {@code TeacherClassRepository#searchByOrg}: tham số tuỳ chọn được
     * {@code CAST} tường minh để Postgres biết kiểu khi giá trị là NULL ("could not determine data
     * type of parameter" nếu không). Tên học viên tìm trên bản chụp {@code student_name_snapshot}
     * — đúng cái tên in trên chứng nhận, không join sang {@code users} (HV đổi tên sau này không
     * làm chứng nhận "biến mất" khỏi kết quả tìm).
     *
     * <p>Chưa có index {@code (org_id, created_at)} — V214 chỉ đánh theo class/issuer/student; nợ
     * migration ghi ở bàn giao DEC-20, số dòng mỗi trung tâm còn nhỏ nên tạm chấp nhận quét.
     */
    @Query(value = """
            SELECT * FROM org_certificates c
            WHERE c.org_id = :orgId
              AND (CAST(:classId AS bigint) IS NULL OR c.class_id = CAST(:classId AS bigint))
              AND (CAST(:active AS boolean) IS NULL OR c.active = CAST(:active AS boolean))
              AND (CAST(:q AS text) IS NULL OR c.student_name_snapshot ILIKE '%' || CAST(:q AS text) || '%')
            ORDER BY c.created_at DESC, c.id DESC
            """,
            countQuery = """
            SELECT COUNT(*) FROM org_certificates c
            WHERE c.org_id = :orgId
              AND (CAST(:classId AS bigint) IS NULL OR c.class_id = CAST(:classId AS bigint))
              AND (CAST(:active AS boolean) IS NULL OR c.active = CAST(:active AS boolean))
              AND (CAST(:q AS text) IS NULL OR c.student_name_snapshot ILIKE '%' || CAST(:q AS text) || '%')
            """,
            nativeQuery = true)
    Page<OrgCertificate> searchByOrg(@Param("orgId") Long orgId,
                                     @Param("classId") Long classId,
                                     @Param("active") Boolean active,
                                     @Param("q") String q,
                                     Pageable pageable);
}
