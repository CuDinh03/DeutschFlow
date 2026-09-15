package com.deutschflow.organization.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "organizations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Organization {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String slug;

    /** Optional co-brand logo URL shown on issued certificates (D5). Null = name-only branding. */
    @Column(name = "logo_url", length = 512)
    private String logoUrl;

    @Column(name = "plan_code")
    private String planCode;

    @Column(name = "seat_limit", nullable = false)
    @Builder.Default
    private int seatLimit = 0;

    /** Trung tâm hoạt động bình thường. Mọi giá trị khác của {@link #status} = đang bị đình chỉ. */
    public static final String STATUS_ACTIVE = "ACTIVE";

    @Column(nullable = false)
    @Builder.Default
    private String status = STATUS_ACTIVE; // ACTIVE | SUSPENDED

    /**
     * Hạn mức token AI/tháng. {@code 0} = CHƯA cấu hình (org member bị free-tier cap nếu
     * {@link #poolUnlimited} = false). {@code > 0} = metered theo pool. Xem M-5.
     */
    @Column(name = "monthly_token_pool", nullable = false)
    @Builder.Default
    private long monthlyTokenPool = 0;

    /**
     * Cờ unlimited tường minh (M-5). {@code true} = org đã mua gói unlimited → bypass mọi cap.
     * {@code false} (default fail-safe) = chịu free-tier cap (pool=0) hoặc metered (pool&gt;0).
     * Tách khỏi sentinel {@code monthly_token_pool=0} để đóng backdoor "quên set pool = unlimited".
     */
    @Column(name = "pool_unlimited", nullable = false)
    @Builder.Default
    private boolean poolUnlimited = false;

    @Column(name = "valid_until")
    private Instant validUntil; // license end; null = perpetual while ACTIVE

    /**
     * Mốc bắt đầu bị đình chỉ — điểm neo để đếm 7 ngày ân hạn chỉ-đọc. {@code null} = không bị
     * đình chỉ. Cố ý là cột RIÊNG chứ không mượn {@link #updatedAt}: mọi lần sửa bản ghi đều đẩy
     * {@code updatedAt} ra xa, ân hạn sẽ không bao giờ hết (fail-open).
     * Kiểu {@link Instant} khớp {@link #validUntil} để máy trạng thái giấy phép so hai mốc được.
     */
    @Column(name = "suspended_at")
    private Instant suspendedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = Instant.now();
    }

    /**
     * Đổi trạng thái trung tâm VÀ giữ đúng mốc neo đình chỉ trong cùng một bước. Dùng thay cho
     * {@code setStatus} ở MỌI đường đổi trạng thái (admin đổi tay, hoá đơn thu tự động qua webhook,
     * hoá đơn đối soát tay).
     *
     * <p>Vì sao phải gộp: {@link #suspendedAt} là mốc đếm 7 ngày ân hạn chỉ-đọc, mà backfill của
     * V316 chỉ đóng mốc cho các trung tâm đã bị đình chỉ SẴN lúc chạy migration. Nếu đình chỉ mà
     * không đóng mốc thì mọi lần đình chỉ sau ngày deploy đều để {@code suspended_at} NULL — máy
     * trạng thái giấy phép không có gì để trừ (fail-open). Nếu mở lại mà không xoá mốc thì lần
     * đình chỉ SAU thừa hưởng mốc cũ đã quá 7 ngày, trung tâm bị cắt ngay không còn ân hạn.
     *
     * <p>Đình chỉ lại một trung tâm ĐANG bị đình chỉ giữ nguyên mốc đầu tiên: ân hạn đếm từ lần
     * đình chỉ thật, không phải từ lần bấm lưu gần nhất. Cùng luật với chốt {@code IS NULL} của
     * câu backfill trong V316.
     */
    public void changeStatus(String newStatus) {
        if (STATUS_ACTIVE.equals(newStatus)) {
            this.suspendedAt = null;
        } else if (this.suspendedAt == null) {
            this.suspendedAt = Instant.now();
        }
        this.status = newStatus;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
