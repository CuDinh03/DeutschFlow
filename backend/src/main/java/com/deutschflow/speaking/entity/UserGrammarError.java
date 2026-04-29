package com.deutschflow.speaking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_grammar_errors")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserGrammarError {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "session_id")
    private Long sessionId;

    @Column(name = "message_id")
    private Long messageId;

    @Column(name = "grammar_point", nullable = false, length = 255)
    private String grammarPoint;

    @Column(name = "original_text", columnDefinition = "TEXT")
    private String originalText;

    @Column(name = "correction_text", columnDefinition = "TEXT")
    private String correctionText;

    @Column(name = "severity", length = 16)
    @Builder.Default
    private String severity = "medium";

    @Column(name = "cefr_level", length = 8)
    private String cefrLevel;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
