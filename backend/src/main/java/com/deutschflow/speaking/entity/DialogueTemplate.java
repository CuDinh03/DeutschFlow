package com.deutschflow.speaking.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Dialogue Template Entity - pre-defined conversation scenarios for greeting practice
 */
@Entity
@Table(name = "dialogue_templates", indexes = {
        @Index(name = "idx_dialogue_difficulty", columnList = "difficulty_level")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DialogueTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "template_name", nullable = false, unique = true)
    private String templateName;

    @Column(name = "difficulty_level", nullable = false)
    @Builder.Default
    private Integer difficultyLevel = 1;

    @Column(name = "user_prompt_template", nullable = false, columnDefinition = "TEXT")
    private String userPromptTemplate;

    @Column(name = "ai_system_prompt", nullable = false, columnDefinition = "TEXT")
    private String aiSystemPrompt;

    @Column(name = "expected_response_patterns", columnDefinition = "TEXT")
    private String expectedResponsePatterns;

    @Column(name = "vocabulary_ids", columnDefinition = "TEXT")
    private String vocabularyIds;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
