package com.deutschflow.marketing.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Một yêu cầu đặt lịch demo gửi từ trang trung tâm ({@code /trung-tam/}, {@code /en/schools/}) — đợt 3a.
 *
 * <p>IP chỉ lưu dạng SHA-256 ({@code ipHash}) để chống spam, như {@link MarketingLead}.
 */
@Entity
@Table(name = "school_demo_requests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SchoolDemoRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String organization;

    @Column(nullable = false)
    private String country;

    /** LT20 | S20_50 | S50_200 | GT200 (CHECK trong V341). */
    @Column(name = "student_count", nullable = false)
    private String studentCount;

    /** EMAIL | ZALO | WHATSAPP | PHONE (CHECK trong V341). */
    @Column(name = "contact_channel", nullable = false)
    private String contactChannel;

    @Column(nullable = false)
    private String contact;

    @Column
    private String message;

    @Column(nullable = false)
    @Builder.Default
    private String locale = "vi";

    @Column(name = "ip_hash")
    private String ipHash;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
