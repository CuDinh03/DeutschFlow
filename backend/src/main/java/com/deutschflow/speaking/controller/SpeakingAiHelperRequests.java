package com.deutschflow.speaking.controller;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request DTOs for /api/speaking/ai endpoints.
 */
public final class SpeakingAiHelperRequests {
    private SpeakingAiHelperRequests() {}

    public record ConversationRequest(
            @NotBlank @Size(max = 4000) String message,
            @Size(max = 2000) String context,
            @Size(max = 8) String level
    ) {
        public String normalizedLevel() {
            return (level == null || level.isBlank()) ? "A2" : level.trim();
        }

        public String normalizedContext() {
            return context == null ? "" : context.trim();
        }
    }

    public record FeedbackRequest(
            @NotBlank @Size(max = 4000) String text,
            @Size(max = 2000) String topic
    ) {
        public String normalizedTopic() {
            return topic == null ? "" : topic.trim();
        }
    }

    public record ScenarioRequest(
            @NotBlank @Size(max = 2000) String topic,
            @Size(max = 8) String level
    ) {
        public String normalizedLevel() {
            return (level == null || level.isBlank()) ? "A2" : level.trim();
        }
    }

    public record ErrorPracticeRequest(
            @NotBlank @Size(max = 2000) String errorType,
            @Min(1) Integer exerciseCount
    ) {
        public int normalizedExerciseCount() {
            return exerciseCount == null ? 3 : exerciseCount;
        }
    }

    public record CulturalContextRequest(
            @NotBlank @Size(max = 2000) String topic
    ) {}

    public record RolePlayRequest(
            @NotBlank @Size(max = 2000) String situation,
            @Size(max = 200) String userRole,
            @Size(max = 200) String aiRole
    ) {
        public String normalizedUserRole() {
            return (userRole == null || userRole.isBlank()) ? "customer" : userRole.trim();
        }

        public String normalizedAiRole() {
            return (aiRole == null || aiRole.isBlank()) ? "shopkeeper" : aiRole.trim();
        }
    }
}
