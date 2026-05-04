package com.deutschflow.speaking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
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

    /** Canonical code from {@link com.deutschflow.speaking.ai.ErrorCatalog}, e.g. WORD_ORDER.V2_MAIN_CLAUSE */
    @Column(name = "error_code", length = 80)
    private String errorCode;

    /** DECIMAL(4,3) in DB — use BigDecimal so Hibernate validates correctly on MySQL and H2. */
    @Column(name = "confidence", precision = 4, scale = 3)
    private BigDecimal confidence;

    @Column(name = "wrong_span", length = 500)
    private String wrongSpan;

    @Column(name = "corrected_span", length = 500)
    private String correctedSpan;

    @Column(name = "rule_vi_short", length = 500)
    private String ruleViShort;

    @Column(name = "example_correct_de", length = 500)
    private String exampleCorrectDe;

    /** OPEN | RESOLVED | SNOOZED */
    @Column(name = "repair_status", nullable = false, length = 16)
    @Builder.Default
    private String repairStatus = "OPEN";

    @Column(name = "original_text", columnDefinition = "TEXT")
    private String originalText;

    @Column(name = "correction_text", columnDefinition = "TEXT")
    private String correctionText;

    @Column(name = "severity", length = 16)
    @Builder.Default
    private String severity = "MINOR";

    @Column(name = "cefr_level", length = 8)
    private String cefrLevel;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
