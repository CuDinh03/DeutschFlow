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

    @Column(nullable = false)
    @Builder.Default
    private String status = "ACTIVE"; // ACTIVE | SUSPENDED

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

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
