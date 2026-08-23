package com.deutschflow.examspeaking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

/** Một đề/stimulus trong ngân hàng (thẻ chủ đề, thẻ hình, đề thuyết trình…). provider NULL = dùng chung. */
@Entity
@Table(name = "speaking_exam_tasks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SpeakingExamTask {

    public static final String STATUS_APPROVED = "APPROVED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "provider", length = 16)
    private String provider;

    @Column(name = "level", nullable = false, length = 4)
    private String level;

    @Column(name = "teil_no", nullable = false)
    private int teilNo;

    @Column(name = "archetype", nullable = false, length = 32)
    private String archetype;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "stimulus_json", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> stimulusJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "asset_refs_json", columnDefinition = "jsonb")
    private Map<String, Object> assetRefsJson;

    @Column(name = "status", nullable = false, length = 16)
    private String status;

    @Column(name = "source", nullable = false, length = 16)
    private String source;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
