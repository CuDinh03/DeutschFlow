package com.deutschflow.interview.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "interview_question")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InterviewQuestion {

    @Id
    @Column(name = "id", length = 100)
    private String id;

    @Column(name = "persona_code", nullable = false, length = 32)
    private String personaCode;

    @Column(name = "phase", nullable = false, length = 30)
    private String phase;

    @Column(name = "topic_key", nullable = false, length = 80)
    private String topicKey;

    @Column(name = "question_de", nullable = false, columnDefinition = "TEXT")
    private String questionDe;

    @Column(name = "industry", length = 100)
    private String industry;

    @Column(name = "difficulty", nullable = false, length = 20)
    @Builder.Default
    private String difficulty = "INTERMEDIATE";

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "version", nullable = false)
    @Builder.Default
    private int version = 1;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
