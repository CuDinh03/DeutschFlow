package com.deutschflow.examspeaking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "speaking_exam_blueprints")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SpeakingExamBlueprint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "provider", nullable = false, length = 16)
    private String provider;

    @Column(name = "level", nullable = false, length = 4)
    private String level;

    @Column(name = "version", nullable = false)
    private int version;

    @Column(name = "title", nullable = false, length = 160)
    private String title;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "parts_json", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> partsJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "rubric_json", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> rubricJson;

    @Column(name = "active", nullable = false)
    private boolean active;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
