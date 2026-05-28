package com.deutschflow.interview.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "interview_rubric_template")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InterviewRubricTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "industry", nullable = false, length = 100)
    private String industry;

    @Column(name = "role_group", nullable = false, length = 100)
    private String roleGroup;

    @Column(name = "level_range", nullable = false, length = 50)
    private String levelRange;

    @Column(name = "phase", nullable = false, length = 30)
    private String phase;

    @Column(name = "criteria_json", nullable = false, columnDefinition = "TEXT")
    private String criteriaJson;

    @Column(name = "weight_json", nullable = false, columnDefinition = "TEXT")
    private String weightJson;

    @Column(name = "version", nullable = false)
    @Builder.Default
    private int version = 1;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
