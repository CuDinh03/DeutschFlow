package com.deutschflow.gamification.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Immutable ledger entry for every XP-earning action.
 * Never delete rows — use aggregates (user_xp_summary) for fast totals.
 */
@Entity
@Table(name = "user_xp_events")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserXpEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "xp_amount", nullable = false)
    private int xpAmount;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 64)
    private XpEventType eventType;

    @Column(name = "ref_session_id")
    private Long refSessionId;

    @Column(name = "ref_message_id")
    private Long refMessageId;

    @Column(name = "note")
    private String note;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    public enum XpEventType {
        SPEAKING_TURN,      // +5 XP per chat turn
        SESSION_COMPLETE,   // +30 XP when session ends
        STREAK_BONUS,       // +10 XP per streak day milestone
        VOCAB_REVIEW,       // +3 XP per vocab flashcard reviewed
        ERROR_FIXED,        // +15 XP per grammar error resolved
        FIRST_SESSION,      // +100 XP one-time
        DAILY_GOAL,         // +50 XP when daily goal met
        ACHIEVEMENT_REWARD  // XP awarded when achievement unlocked
    }
}
