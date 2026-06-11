package com.deutschflow.marketing.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Một lead thu được từ lead magnet "AI chấm thử miễn phí" (checklist C8).
 *
 * <p>Không lưu nguyên văn bài viết (chỉ {@code essayChars}) để hạn chế dữ liệu cá nhân; IP được
 * hash SHA-256 ({@code ipHash}) phục vụ rate-limit/audit chứ không lưu IP thô.
 */
@Entity
@Table(name = "marketing_leads")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MarketingLead {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column
    private String name;

    @Column(nullable = false)
    private String contact;

    @Column(name = "contact_type", nullable = false)
    @Builder.Default
    private String contactType = "EMAIL"; // EMAIL | ZALO | PHONE

    @Column(nullable = false)
    @Builder.Default
    private String source = "FREE_GRADE_B1";

    @Column
    private String topic;

    @Column(name = "essay_chars", nullable = false)
    @Builder.Default
    private int essayChars = 0;

    @Column
    private Integer score;

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
