package com.deutschflow.curriculum.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Response of {@code GET /api/roadmap/setup} — a union of the two legacy branches:
 * <ul>
 *   <li>profile exists → {@code {exists:true, goalType, currentLevel, targetLevel, sessionsPerWeek,
 *       minutesPerSession, learningSpeed, industry, examType, interestsJson}}</li>
 *   <li>no profile      → {@code {exists:false}}</li>
 * </ul>
 * {@code @JsonInclude(NON_NULL)} makes the no-profile branch emit exactly {@code {exists:false}}. The
 * nullable {@code industry}/{@code examType} are therefore omitted (not {@code null}) when a profile
 * exists but they are unset — FE-safe: the web reads only {@code exists} here (routing), and the setup
 * form prefills from its own state, never from this response.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record RoadmapSetupStateDto(
        Boolean exists,
        String goalType,
        String currentLevel,
        String targetLevel,
        Integer sessionsPerWeek,
        Integer minutesPerSession,
        String learningSpeed,
        String industry,
        String examType,
        String interestsJson) {

    public static RoadmapSetupStateDto notExists() {
        return new RoadmapSetupStateDto(false, null, null, null, null, null, null, null, null, null);
    }

    public static RoadmapSetupStateDto exists(String goalType, String currentLevel, String targetLevel,
                                              Integer sessionsPerWeek, Integer minutesPerSession,
                                              String learningSpeed, String industry, String examType,
                                              String interestsJson) {
        return new RoadmapSetupStateDto(true, goalType, currentLevel, targetLevel, sessionsPerWeek,
                minutesPerSession, learningSpeed, industry, examType, interestsJson);
    }
}
