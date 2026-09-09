package com.deutschflow.common.minor;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Một dòng trong SỔ BẰNG CHỨNG đồng ý của người giám hộ (DEC-22, V319).
 *
 * <p><b>CHỈ GHI THÊM.</b> Thu hồi đồng ý = ghi một dòng {@link Action#REVOKED} MỚI; không sửa và
 * không xoá dòng cũ. Xoá dòng là mất luôn câu trả lời cho "ai đồng ý, lúc nào, rồi rút lúc nào" —
 * đúng ba câu cơ quan bảo vệ dữ liệu sẽ hỏi.
 *
 * <p><b>Bất biến được rào ba lớp, cố ý thừa:</b>
 * <ol>
 *   <li>lớp này KHÔNG có {@code @Setter} và không có constructor công khai — chỉ dựng được qua
 *       {@code builder()}, nên không đường nào sửa một dòng đã ghi;</li>
 *   <li>mọi cột đều {@code updatable = false}, nên kể cả khi ai đó lách được vào trường (reflection,
 *       một {@code @Setter} thêm sau này) thì Hibernate vẫn không sinh ra câu UPDATE nào;</li>
 *   <li>trigger {@code trg_student_consents_immutable} chặn UPDATE/DELETE ở tầng DB.</li>
 * </ol>
 * Lớp 3 là lưới cuối, nhưng nó chỉ nổ LÚC CHẠY. Hai lớp đầu tồn tại để một PR viết sai không bao
 * giờ đi tới được production mà chỉ hỏng ở đó.
 *
 * <p>🪤 <b>{@code effectiveAt} ≠ {@code createdAt}.</b> {@code effectiveAt} là lúc người giám hộ
 * đồng ý THẬT (ngày ký giấy); {@code createdAt} là lúc nhân viên bấm nút nhập. Trạng thái hiện tại
 * đọc theo {@code effectiveAt}, vì một tờ giấy ký hôm qua nhập vào hôm nay vẫn có hiệu lực từ hôm
 * qua. Nguyên tắc lấy từ tiền lệ V284 ("consent được ghi nhận, không suy diễn từ việc có audio").
 */
@Entity
@Table(name = "student_consents")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class StudentConsent {

    /** Bốn phạm vi của {@code chk_student_consents_scope} — mỗi phạm vi hỏi và trả lời độc lập. */
    public enum Scope { DATA_PROCESSING, AI_PROCESSING, AUDIO_RECORDING, MESSAGING }

    /** Cấp hay thu hồi. Hai giá trị này là toàn bộ ngữ pháp của sổ chỉ-ghi-thêm. */
    public enum Action { GRANTED, REVOKED }

    /** Đồng ý được thu bằng đường nào — quyết định bằng chứng mạnh tới đâu khi bị hỏi lại. */
    public enum Method { PAPER, EMAIL, IN_APP, PHONE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "student_user_id", nullable = false, updatable = false)
    private Long studentUserId;

    /** Trung tâm đã thu đồng ý. NULL = học viên B2C. */
    @Column(name = "org_id", updatable = false)
    private Long orgId;

    @Enumerated(EnumType.STRING)
    @Column(name = "scope", nullable = false, length = 32, updatable = false)
    private Scope scope;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 16, updatable = false)
    private Action action;

    /** Người giám hộ đã đồng ý. NULL khi chính học viên đủ tuổi tự đồng ý. */
    @Column(name = "guardian_id", updatable = false)
    private Long guardianId;

    @Enumerated(EnumType.STRING)
    @Column(name = "method", nullable = false, length = 24, updatable = false)
    private Method method;

    /**
     * Phiên bản điều khoản đã được đồng ý. Không có nó thì bằng chứng không nói được người giám hộ
     * đã đồng ý với CÁI GÌ — mà điều khoản thì đổi, còn chữ ký thì không ký lại.
     */
    @Column(name = "terms_version", nullable = false, length = 32, updatable = false)
    private String termsVersion;

    /** Lúc đồng ý THẬT — xem javadoc lớp. */
    @Column(name = "effective_at", nullable = false, updatable = false)
    private Instant effectiveAt;

    @Column(name = "recorded_by_user_id", updatable = false)
    private Long recordedByUserId;

    @Column(name = "note", length = 255, updatable = false)
    private String note;

    /** Lúc bấm nút nhập — xem javadoc lớp. */
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
