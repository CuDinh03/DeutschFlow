package com.deutschflow.marketing.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Báo cáo chấm công khai, chia sẻ được (checklist D6 — vòng lặp PLG).
 *
 * <p>Xem bằng {@code shareToken} (bí mật trong URL). KHÔNG chứa thông tin liên hệ — report công
 * khai chỉ có điểm + nhận xét + chủ đề, để chia sẻ qua Zalo kèm watermark "Chấm bởi DeutschFlow".
 */
@Entity
@Table(name = "shared_grade_reports")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SharedGradeReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "share_token", nullable = false, unique = true)
    private String shareToken;

    @Column
    private String topic;

    @Column(nullable = false)
    private int score;

    @Column(nullable = false, columnDefinition = "text")
    private String feedback;

    @Column(nullable = false)
    @Builder.Default
    private String source = "FREE_GRADE_B1";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
