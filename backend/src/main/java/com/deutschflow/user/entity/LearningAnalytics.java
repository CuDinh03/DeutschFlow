package com.deutschflow.user.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.List;

@Entity
@Table(name = "learning_analytics",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "analytics_date"}))
public class LearningAnalytics {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "analytics_date", nullable = false)
    private LocalDate analyticsDate;

    @Column(name = "words_learned", nullable = false)
    private int wordsLearned;

    @Column(name = "words_reviewed", nullable = false)
    private int wordsReviewed;

    @Column(name = "speaking_minutes", nullable = false)
    private int speakingMinutes;

    @Column(name = "sessions_completed", nullable = false)
    private int sessionsCompleted;

    @Column(name = "avg_accuracy", nullable = false, precision = 5, scale = 2)
    private BigDecimal avgAccuracy = BigDecimal.ZERO;

    @Column(name = "avg_confidence", nullable = false, precision = 5, scale = 2)
    private BigDecimal avgConfidence = BigDecimal.ZERO;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "errors_by_type", columnDefinition = "jsonb")
    private Map<String, Integer> errorsByType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "focus_areas", columnDefinition = "jsonb")
    private List<String> focusAreas;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public LearningAnalytics() {}

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public LocalDate getAnalyticsDate() { return analyticsDate; }
    public int getWordsLearned() { return wordsLearned; }
    public int getWordsReviewed() { return wordsReviewed; }
    public int getSpeakingMinutes() { return speakingMinutes; }
    public int getSessionsCompleted() { return sessionsCompleted; }
    public BigDecimal getAvgAccuracy() { return avgAccuracy; }
    public BigDecimal getAvgConfidence() { return avgConfidence; }
    public Map<String, Integer> getErrorsByType() { return errorsByType; }
    public List<String> getFocusAreas() { return focusAreas; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public void setId(Long id) { this.id = id; }
    public void setUserId(Long userId) { this.userId = userId; }
    public void setAnalyticsDate(LocalDate analyticsDate) { this.analyticsDate = analyticsDate; }
    public void setWordsLearned(int wordsLearned) { this.wordsLearned = wordsLearned; }
    public void setWordsReviewed(int wordsReviewed) { this.wordsReviewed = wordsReviewed; }
    public void setSpeakingMinutes(int speakingMinutes) { this.speakingMinutes = speakingMinutes; }
    public void setSessionsCompleted(int sessionsCompleted) { this.sessionsCompleted = sessionsCompleted; }
    public void setAvgAccuracy(BigDecimal avgAccuracy) { this.avgAccuracy = avgAccuracy; }
    public void setAvgConfidence(BigDecimal avgConfidence) { this.avgConfidence = avgConfidence; }
    public void setErrorsByType(Map<String, Integer> errorsByType) { this.errorsByType = errorsByType; }
    public void setFocusAreas(List<String> focusAreas) { this.focusAreas = focusAreas; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private Long userId;
        private LocalDate analyticsDate;
        private int wordsLearned, wordsReviewed, speakingMinutes, sessionsCompleted;
        private BigDecimal avgAccuracy = BigDecimal.ZERO;
        private BigDecimal avgConfidence = BigDecimal.ZERO;
        private Map<String, Integer> errorsByType;
        private List<String> focusAreas;

        public Builder userId(Long v) { this.userId = v; return this; }
        public Builder analyticsDate(LocalDate v) { this.analyticsDate = v; return this; }
        public Builder wordsLearned(int v) { this.wordsLearned = v; return this; }
        public Builder wordsReviewed(int v) { this.wordsReviewed = v; return this; }
        public Builder speakingMinutes(int v) { this.speakingMinutes = v; return this; }
        public Builder sessionsCompleted(int v) { this.sessionsCompleted = v; return this; }
        public Builder avgAccuracy(BigDecimal v) { this.avgAccuracy = v; return this; }
        public Builder avgConfidence(BigDecimal v) { this.avgConfidence = v; return this; }
        public Builder errorsByType(Map<String, Integer> v) { this.errorsByType = v; return this; }
        public Builder focusAreas(List<String> v) { this.focusAreas = v; return this; }

        public LearningAnalytics build() {
            LearningAnalytics a = new LearningAnalytics();
            a.userId = userId;
            a.analyticsDate = analyticsDate;
            a.wordsLearned = wordsLearned;
            a.wordsReviewed = wordsReviewed;
            a.speakingMinutes = speakingMinutes;
            a.sessionsCompleted = sessionsCompleted;
            a.avgAccuracy = avgAccuracy;
            a.avgConfidence = avgConfidence;
            a.errorsByType = errorsByType;
            a.focusAreas = focusAreas;
            a.createdAt = java.time.LocalDateTime.now();
            a.updatedAt = java.time.LocalDateTime.now();
            return a;
        }
    }
}
