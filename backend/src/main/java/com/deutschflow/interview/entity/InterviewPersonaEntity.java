package com.deutschflow.interview.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Table(name = "interview_persona")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InterviewPersonaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code", nullable = false, unique = true, length = 32)
    private String code;

    @Column(name = "label", nullable = false, length = 100)
    private String label;

    @Column(name = "industry", nullable = false, length = 100)
    private String industry;

    @Column(name = "role_title", nullable = false, length = 150)
    private String roleTitle;

    @Column(name = "tone", nullable = false, length = 50)
    private String tone;

    @Column(name = "difficulty", nullable = false, length = 20)
    private String difficulty;

    @Column(name = "question_style", nullable = false, length = 50)
    private String questionStyle;

    @Column(name = "follow_up_style", nullable = false, length = 50)
    private String followUpStyle;

    @Column(name = "evaluation_bias", length = 100)
    private String evaluationBias;

    /**
     * Session topic-focus pools for this persona, as a JSON array-of-arrays
     * (e.g. {@code [["Systemdesign","API"],["Testing","Performance"]]}).
     * Replaces the per-persona {@code topicPools()} switch in
     * {@link com.deutschflow.speaking.interview.PersonaInterviewRegistry}.
     * Nullable: non-interview personas (DEFAULT/TUAN/LAN/MINH) keep using the
     * in-memory fallback during the transition release.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "topic_pools_json", columnDefinition = "jsonb")
    private String topicPoolsJson;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "version", nullable = false)
    @Builder.Default
    private int version = 1;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        var now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
