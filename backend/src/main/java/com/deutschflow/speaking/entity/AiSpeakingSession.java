package com.deutschflow.speaking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "ai_speaking_sessions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiSpeakingSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "topic", length = 200)
    private String topic;

    /** CEFR level selected by the user for this session (e.g. A1, A2, B1, B2). */
    @Column(name = "cefr_level", length = 8)
    private String cefrLevel;

    /** {@link com.deutschflow.speaking.persona.SpeakingPersona} name, e.g. DEFAULT, LUKAS. */
    @Column(name = "persona", length = 32, nullable = false)
    @Builder.Default
    private String persona = "DEFAULT";

    /** {@link com.deutschflow.speaking.contract.SpeakingResponseSchema} name: V1 | V2. */
    @Column(name = "response_schema", length = 8, nullable = false)
    @Builder.Default
    private String responseSchema = "V1";

    /** {@link com.deutschflow.speaking.contract.SpeakingSessionMode}: COMMUNICATION | INTERVIEW. */
    @Column(name = "session_mode", length = 20, nullable = false)
    @Builder.Default
    private String sessionMode = "COMMUNICATION";

    /** Interview mode: the position the candidate is applying for (e.g. "Backend Developer"). */
    @Column(name = "interview_position", length = 100)
    private String interviewPosition;

    /** Interview mode: candidate experience level (e.g. "0-6M", "1-2Y", "5Y"). */
    @Column(name = "experience_level", length = 20)
    private String experienceLevel;

    /** Interview mode: JSON evaluation report generated on session end. */
    @Column(name = "interview_report_json", columnDefinition = "TEXT")
    private String interviewReportJson;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private SessionStatus status = SessionStatus.ACTIVE;

    @Column(name = "started_at", nullable = false, updatable = false)
    private LocalDateTime startedAt;

    @Column(name = "last_activity_at", nullable = false)
    private LocalDateTime lastActivityAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    @Column(name = "message_count", nullable = false)
    @Builder.Default
    private int messageCount = 0;

    @PrePersist
    void onCreate() {
        var now = LocalDateTime.now();
        if (startedAt == null) startedAt = now;
        if (lastActivityAt == null) lastActivityAt = now;
    }

    public enum SessionStatus {
        ACTIVE, ENDED
    }
}
