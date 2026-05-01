package com.deutschflow.speaking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_error_skills")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserErrorSkill {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "error_code", nullable = false, length = 80)
    private String errorCode;

    @Column(name = "total_count", nullable = false)
    @Builder.Default
    private int totalCount = 0;

    @Column(name = "last_seen_at", nullable = false)
    private LocalDateTime lastSeenAt;

    @Column(name = "last_severity", nullable = false, length = 16)
    private String lastSeverity;

    @Column(name = "open_count", nullable = false)
    @Builder.Default
    private int openCount = 0;

    @Column(name = "resolved_count", nullable = false)
    @Builder.Default
    private int resolvedCount = 0;

    @Column(name = "priority_score", nullable = false, precision = 8, scale = 3)
    @Builder.Default
    private BigDecimal priorityScore = BigDecimal.ONE;
}
