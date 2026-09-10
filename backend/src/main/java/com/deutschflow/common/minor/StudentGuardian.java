package com.deutschflow.common.minor;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Người giám hộ của một học viên chưa thành niên (DEC-22, V319).
 *
 * <p><b>Vì sao tách khỏi {@link StudentConsent}:</b> đây là THÔNG TIN LIÊN LẠC. Gõ sai số điện
 * thoại thì phải sửa được, và sửa số không được làm mất hiệu lực lần đồng ý đã thu. Gộp hai thứ
 * vào một bảng thì chỉ còn hai lựa chọn, cái nào cũng sai: hoặc không sửa nổi số gõ nhầm, hoặc sửa
 * được cả bằng chứng pháp lý. Vì vậy bảng này SỬA ĐƯỢC (có {@code @Setter}), bảng kia thì không.
 *
 * <p><b>Khoá theo {@code studentUserId} chứ không theo dòng ghi danh</b> — cùng lập luận đã ghi ở
 * V319 cho {@code users.birth_date}: học viên B2C không có dòng org nào, mà nghĩa vụ với trẻ chưa
 * thành niên không phụ thuộc việc em ấy có thuộc trung tâm hay không. {@code orgId} ở đây chỉ trả
 * lời "trung tâm nào đã nhập bản ghi này" cho đường đọc của giám đốc, KHÔNG phải khoá sở hữu.
 */
@Entity
@Table(name = "student_guardians")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentGuardian {

    /**
     * Bốn giá trị bị {@code chk_student_guardians_relationship} ràng ở tầng DB. Dùng enum để một
     * chuỗi gõ sai vỡ lúc BIÊN DỊCH, chứ không phải thành {@code DataIntegrityViolationException}
     * lúc INSERT trên production.
     */
    public enum Relationship { MOTHER, FATHER, LEGAL_GUARDIAN, OTHER }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Chủ thể dữ liệu. Bất biến: đổi chủ thể = một bản ghi khác, không phải sửa bản ghi này. */
    @Column(name = "student_user_id", nullable = false, updatable = false)
    private Long studentUserId;

    /** Trung tâm đã nhập bản ghi. NULL = học viên B2C, không thuộc trung tâm nào. */
    @Column(name = "org_id")
    private Long orgId;

    @Column(name = "full_name", nullable = false, length = 120)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(name = "relationship", nullable = false, length = 24)
    private Relationship relationship;

    @Column(name = "phone", length = 32)
    private String phone;

    @Column(name = "email", length = 255)
    private String email;

    /**
     * Người liên lạc CHÍNH. {@code uq_student_guardians_primary} là unique một phần nên mỗi học
     * viên chỉ có đúng một dòng {@code is_primary} — đổi người chính phải HẠ người cũ trước khi
     * thêm người mới, xem {@code MinorLearnerService#recordGuardian}.
     */
    @Column(name = "is_primary", nullable = false)
    @Builder.Default
    private boolean primary = true;

    @Column(name = "created_by", updatable = false)
    private Long createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
