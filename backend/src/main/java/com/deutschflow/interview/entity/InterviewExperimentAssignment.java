package com.deutschflow.interview.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "interview_experiment_assignment")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InterviewExperimentAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "session_id")
    private Long sessionId;

    @Column(name = "experiment_key", nullable = false, length = 100)
    private String experimentKey;

    @Column(name = "variant_key", nullable = false, length = 50)
    private String variantKey;

    @Column(name = "assigned_at", nullable = false, updatable = false)
    private LocalDateTime assignedAt;

    @Column(name = "reason", length = 200)
    private String reason;

    @PrePersist
    void onCreate() {
        if (assignedAt == null) assignedAt = LocalDateTime.now();
    }
}
