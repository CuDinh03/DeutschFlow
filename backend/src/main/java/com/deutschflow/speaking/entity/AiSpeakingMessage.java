package com.deutschflow.speaking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "ai_speaking_messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiSpeakingMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false)
    private MessageRole role;

    @Column(name = "user_text", columnDefinition = "TEXT")
    private String userText;

    @Column(name = "ai_speech_de", columnDefinition = "TEXT")
    private String aiSpeechDe;

    @Column(name = "correction", columnDefinition = "TEXT")
    private String correction;

    @Column(name = "explanation_vi", columnDefinition = "TEXT")
    private String explanationVi;

    @Column(name = "grammar_point", length = 200)
    private String grammarPoint;

    @Column(name = "new_word", length = 200)
    private String newWord;

    @Column(name = "user_interest_detected", length = 200)
    private String userInterestDetected;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    public enum MessageRole {
        USER, ASSISTANT
    }
}
