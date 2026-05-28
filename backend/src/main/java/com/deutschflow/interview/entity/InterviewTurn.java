package com.deutschflow.interview.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "interview_turn")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InterviewTurn {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(name = "turn_index", nullable = false)
    private int turnIndex;

    @Column(name = "phase", nullable = false, length = 30)
    private String phase;

    @Column(name = "question_id", length = 100)
    private String questionId;

    @Column(name = "question_text", nullable = false, columnDefinition = "TEXT")
    private String questionText;

    @Column(name = "user_answer", columnDefinition = "TEXT")
    private String userAnswer;

    @Column(name = "ai_follow_up", columnDefinition = "TEXT")
    private String aiFollowUp;

    @Column(name = "answer_analysis_json", columnDefinition = "TEXT")
    private String answerAnalysisJson;

    @Column(name = "score_json", columnDefinition = "TEXT")
    private String scoreJson;

    @Column(name = "directive_type", length = 50)
    private String directiveType;

    @Column(name = "latency_ms")
    private Integer latencyMs;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
