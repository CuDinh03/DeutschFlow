package com.deutschflow.teacher.entity;

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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.Set;

/**
 * Một LẦN PHÁT HÀNH phiếu đánh giá cho gia đình (R1/R2, V323) — ảnh chụp BẤT BIẾN.
 *
 * <p>Kỳ ({@link Period}) là thuộc tính của lần phát hành, không có bảng kỳ riêng. Phát hành lại cùng kỳ
 * = dòng MỚI, dòng cũ {@link #revoke} với {@link #REVOKE_SUPERSEDED} (giữ lịch sử, link cũ chết ngay).
 * {@link #payload} mang TOÀN BỘ nội dung phiếu: trang công khai và PDF không đọc lại bảng nguồn, nên
 * sửa điểm sau khi phát hành không làm phiếu đã gửi tự đổi.
 *
 * <p><b>Bất biến rào hai lớp, cố ý thừa</b> (cùng lối {@code StudentConsent}): mọi cột nội dung là
 * {@code updatable = false} nên Hibernate không bao giờ sinh UPDATE cho chúng; trigger
 * {@code trg_student_report_issues_immutable} chặn ở tầng DB mọi UPDATE ngoài nhóm token / thu hồi /
 * lượt xem. Lớp Java không có {@code @Setter}: đổi được gì thì có hàm tên rõ ({@link #revoke},
 * {@link #rotateToken}); lượt xem chỉ tăng qua {@code StudentReportIssueRepository.recordView} (UPDATE
 * nguyên tử, không lost-update giữa hai phụ huynh mở cùng lúc) nên hai cột đó cũng {@code updatable = false}
 * — {@code save()} không bao giờ ghi lại một bộ đếm cũ.
 *
 * <p>{@link #orgId} đóng băng theo LỚP lúc phát hành, không suy từ {@code users.org_id} (V320 đã trả giá).
 * Xoá tài khoản học viên mang theo phiếu (FK CASCADE — App Store 5.1.1(v)).
 *
 * <p>Đợt này (PR-R1) chỉ có entity + repository; service phát hành, PDF, endpoint công khai là PR-R2.
 */
@Entity
@Table(name = "student_report_issues")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class StudentReportIssue {

    /** Kỳ phát hành ({@code chk_student_report_issues_period}). Mở rộng = sửa CHECK + enum cùng lúc. */
    public enum Period { MIDTERM, FINAL }

    /** Ngôn ngữ phiếu ({@code chk_student_report_issues_lang}, R8). Mặc định {@link #LANG_VI}. */
    public static final String LANG_VI = "vi";
    public static final String LANG_EN = "en";
    public static final String LANG_DE = "de";
    public static final Set<String> SUPPORTED_LANGS = Set.of(LANG_VI, LANG_EN, LANG_DE);

    /** Mã lý do thu hồi — VARCHAR(64), MÃ chứ không phải văn tự do. */
    public static final String REVOKE_SUPERSEDED = "SUPERSEDED";
    public static final String REVOKE_BY_OWNER = "OWNER";
    public static final String REVOKE_BY_MANAGER = "MANAGER";
    public static final String REVOKE_BY_TEACHER = "TEACHER";

    /**
     * Trạng thái ĐỌC ĐƯỢC của một phiếu (R2/R9), suy từ ba cột chứ không lưu: SUPERSEDED tách khỏi
     * REVOKED vì với giáo viên/giám đốc "bị phát hành lại" và "bị thu hồi có lý do" là hai chuyện khác
     * nhau; với phụ huynh cả hai (và EXPIRED) đều là 404 đồng nhất — phân biệt chỉ tồn tại ở phía trong.
     */
    public enum Status { ACTIVE, EXPIRED, SUPERSEDED, REVOKED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "class_id", nullable = false, updatable = false)
    private Long classId;

    @Column(name = "student_id", nullable = false, updatable = false)
    private Long studentId;

    /** Trung tâm của LỚP tại thời điểm phát hành (ảnh chụp). NULL = lớp B2C. */
    @Column(name = "org_id", updatable = false)
    private Long orgId;

    @Enumerated(EnumType.STRING)
    @Column(name = "period", nullable = false, length = 16, updatable = false)
    private Period period;

    @Column(name = "lang", nullable = false, length = 2, updatable = false)
    private String lang;

    /**
     * Toàn bộ nội dung phiếu (R4). CẤM chứa: email học viên, ghi âm, transcript, bài nguyên văn,
     * {@code ai_score}, tin nhắn. Người dựng payload (PR-R2) chịu trách nhiệm; ca AC kiểm khoá.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload_json", columnDefinition = "jsonb", nullable = false, updatable = false)
    private Map<String, Object> payload;

    @Column(name = "org_name_snapshot", length = 160, updatable = false)
    private String orgNameSnapshot;

    @Column(name = "org_logo_url_snapshot", length = 512, updatable = false)
    private String orgLogoUrlSnapshot;

    @Column(name = "student_name_snapshot", nullable = false, length = 160, updatable = false)
    private String studentNameSnapshot;

    /** Người phát hành (FK SET NULL) — tên đã snapshot ở {@link #issuedByNameSnapshot}. */
    @Column(name = "issued_by", updatable = false)
    private Long issuedBy;

    @Column(name = "issued_by_name_snapshot", length = 160, updatable = false)
    private String issuedByNameSnapshot;

    @Column(name = "issued_at", nullable = false, updatable = false)
    private Instant issuedAt;

    /** Bí mật trong URL công khai (R1/R9). UNIQUE toàn bảng: token đã thu hồi không bao giờ cấp lại. */
    @Column(name = "token", nullable = false, length = 40)
    private String token;

    @Column(name = "token_expires_at", nullable = false)
    private Instant tokenExpiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    /** Người thu hồi (FK SET NULL); NULL khi hệ thống tự thu hồi (SUPERSEDED). */
    @Column(name = "revoked_by")
    private Long revokedBy;

    /** {@link #REVOKE_SUPERSEDED} | {@link #REVOKE_BY_OWNER} | {@link #REVOKE_BY_TEACHER} | … */
    @Column(name = "revoke_reason", length = 64)
    private String revokeReason;

    /** Chỉ tăng qua {@code StudentReportIssueRepository.recordView} — xem javadoc lớp. */
    @Column(name = "view_count", nullable = false, updatable = false)
    @Builder.Default
    private int viewCount = 0;

    @Column(name = "last_viewed_at", updatable = false)
    private Instant lastViewedAt;

    @PrePersist
    void onCreate() {
        if (issuedAt == null) {
            issuedAt = Instant.now();
        }
        if (lang == null) {
            lang = LANG_VI;
        }
    }

    public boolean isRevoked() {
        return revokedAt != null;
    }

    /** Còn mở được qua link: chưa thu hồi VÀ chưa hết hạn — đúng điều kiện của {@code findActiveByToken}. */
    public boolean isActiveAt(Instant now) {
        return !isRevoked() && tokenExpiresAt != null && tokenExpiresAt.isAfter(now);
    }

    /** Xem {@link Status}. Thu hồi thắng hết hạn: phiếu vừa thu hồi vừa quá hạn đọc là REVOKED/SUPERSEDED. */
    public Status statusAt(Instant now) {
        if (isRevoked()) {
            return REVOKE_SUPERSEDED.equals(revokeReason) ? Status.SUPERSEDED : Status.REVOKED;
        }
        return isActiveAt(now) ? Status.ACTIVE : Status.EXPIRED;
    }

    /**
     * Thu hồi. Lần thu hồi ĐẦU thắng: gọi lại trên phiếu đã thu hồi là no-op (trả {@code false}) để không
     * viết đè "ai thu hồi, vì sao" — đó là bằng chứng. {@code byUserId} NULL khi hệ thống tự thu hồi.
     */
    public boolean revoke(Long byUserId, String reason, Instant at) {
        if (isRevoked()) {
            return false;
        }
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("Thu hồi phiếu phải có mã lý do (chk_student_report_issues_revoke_pair)");
        }
        this.revokedAt = at == null ? Instant.now() : at;
        this.revokedBy = byUserId;
        this.revokeReason = reason;
        return true;
    }

    /** Xoay token (R9): token mới + hạn mới trên CÙNG dòng, link cũ chết ngay. Không xoay phiếu đã thu hồi. */
    public void rotateToken(String newToken, Instant newExpiresAt) {
        if (isRevoked()) {
            throw new IllegalStateException("Phiếu đã thu hồi, không xoay token — phát hành lại nếu cần");
        }
        if (newToken == null || newToken.isBlank() || newExpiresAt == null) {
            throw new IllegalArgumentException("Xoay token cần token mới và hạn mới");
        }
        this.token = newToken;
        this.tokenExpiresAt = newExpiresAt;
    }
}
