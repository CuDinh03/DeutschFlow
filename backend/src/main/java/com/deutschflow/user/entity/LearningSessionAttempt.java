package com.deutschflow.user.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Table(name = "learning_session_attempts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LearningSessionAttempt {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "week_number", nullable = false)
    private int weekNumber;

    @Column(name = "session_index", nullable = false)
    private int sessionIndex;

    @Column(name = "attempt_no", nullable = false)
    private int attemptNo;

    @Column(name = "score_percent", nullable = false)
    private int scorePercent;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "mistakes_json")
    private String mistakesJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }
}

