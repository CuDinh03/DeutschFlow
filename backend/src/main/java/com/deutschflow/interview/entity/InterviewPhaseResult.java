package com.deutschflow.interview.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "interview_phase_result")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InterviewPhaseResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(name = "phase", nullable = false, length = 30)
    private String phase;

    @Column(name = "score", precision = 4, scale = 2)
    private BigDecimal score;

    @Column(name = "rubric_template_id")
    private Long rubricTemplateId;

    @Column(name = "weights_json", columnDefinition = "TEXT")
    private String weightsJson;

    @Column(name = "strengths_json", columnDefinition = "TEXT")
    private String strengthsJson;

    @Column(name = "weaknesses_json", columnDefinition = "TEXT")
    private String weaknessesJson;

    @Column(name = "recommended_drill_json", columnDefinition = "TEXT")
    private String recommendedDrillJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
