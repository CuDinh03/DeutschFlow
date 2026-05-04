package com.deutschflow.speaking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "speaking_user_state")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SpeakingUserState {

    @Id
    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "rolling_accuracy_pct", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal rollingAccuracyPct = new BigDecimal("100.00");

    @Column(name = "rolling_window", nullable = false)
    @Builder.Default
    private int rollingWindow = 8;

    @Column(name = "difficulty_knob", nullable = false)
    @Builder.Default
    private short difficultyKnob = 0;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "current_focus_codes_json")
    private String currentFocusCodesJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "cooldown_codes_json")
    private String cooldownCodesJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "focus_success_streak_json")
    private String focusSuccessStreakJson;

    @Column(name = "last_topic", length = 200)
    private String lastTopic;

    @Column(name = "last_topic_at")
    private LocalDateTime lastTopicAt;

    @Column(name = "last_evaluated_turn_id")
    private Long lastEvaluatedTurnId;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = LocalDateTime.now();
    }
}
