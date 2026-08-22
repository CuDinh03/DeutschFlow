package com.deutschflow.examspeaking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "speaking_exam_results")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SpeakingExamResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false, unique = true)
    private Long sessionId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "provider", nullable = false, length = 16)
    private String provider;

    @Column(name = "level", nullable = false, length = 4)
    private String level;

    @Column(name = "rubric_version", nullable = false)
    private int rubricVersion;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "score_sheet_json", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> scoreSheetJson;

    @Column(name = "total_points", precision = 6, scale = 2)
    private BigDecimal totalPoints;

    @Column(name = "total_low", precision = 6, scale = 2)
    private BigDecimal totalLow;

    @Column(name = "total_high", precision = 6, scale = 2)
    private BigDecimal totalHigh;

    @Column(name = "max_points", precision = 6, scale = 2)
    private BigDecimal maxPoints;

    @Column(name = "passed")
    private Boolean passed;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
