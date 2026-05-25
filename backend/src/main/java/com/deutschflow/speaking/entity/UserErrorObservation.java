package com.deutschflow.speaking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_error_observations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserErrorObservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "message_id", nullable = false)
    private Long messageId;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(name = "error_code", nullable = false, length = 80)
    private String errorCode;

    @Column(name = "severity", nullable = false, length = 16)
    private String severity;

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

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
