package com.deutschflow.curriculum.controller;

import com.deutschflow.curriculum.dto.RoadmapSetupRequest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/roadmap")
@RequiredArgsConstructor
public class RoadmapSetupController {

    private final UserLearningProfileRepository profileRepository;

    @PostMapping("/setup")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> createOrUpdateSetup(
            @AuthenticationPrincipal User user,
            @RequestBody RoadmapSetupRequest request
    ) {
        UserLearningProfile profile = profileRepository.findByUserId(user.getId())
                .orElse(UserLearningProfile.builder().user(user).build());

        profile.setGoalType(request.resolveGoalType());
        profile.setCurrentLevel(request.resolveCurrentLevel());
        profile.setTargetLevel(request.resolveTargetLevel());
        profile.setSessionsPerWeek(request.sessionsPerWeek() == null ? 3 : request.sessionsPerWeek());
        profile.setMinutesPerSession(request.minutesPerSession() == null ? 30 : request.minutesPerSession());
        profile.setLearningSpeed(request.resolveLearningSpeed());
        profile.setIndustry(request.industry());
        profile.setExamType(request.examType());
        profile.setInterestsJson(request.focusAreas() == null ? "[]" : new com.fasterxml.jackson.databind.ObjectMapper().valueToTree(request.focusAreas()).toString());

        profileRepository.save(profile);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("saved", true);
        response.put("roadmapVersion", profile.getCurrentLevel() == UserLearningProfile.CurrentLevel.A0 ? "A0_A1_Foundation_First" : "PERSONALIZED_CEFR_V1");
        response.put("roadmapType", profile.getCurrentLevel() == UserLearningProfile.CurrentLevel.A0 ? "FOUNDATION_FIRST" : "PERSONALIZED");
        response.put("currentLevel", profile.getCurrentLevel().name());
        response.put("targetLevel", profile.getTargetLevel().name());
        response.put("nextRoute", "/roadmap");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/setup")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> getSetup(@AuthenticationPrincipal User user) {
        return profileRepository.findByUserId(user.getId())
                .map(profile -> {
                    Map<String, Object> response = new LinkedHashMap<>();
                    response.put("exists", true);
                    response.put("goalType", profile.getGoalType().name());
                    response.put("currentLevel", profile.getCurrentLevel().name());
                    response.put("targetLevel", profile.getTargetLevel().name());
                    response.put("sessionsPerWeek", profile.getSessionsPerWeek());
                    response.put("minutesPerSession", profile.getMinutesPerSession());
                    response.put("learningSpeed", profile.getLearningSpeed().name());
                    response.put("industry", profile.getIndustry());
                    response.put("examType", profile.getExamType());
                    response.put("interestsJson", profile.getInterestsJson());
                    return ResponseEntity.ok(response);
                })
                .orElseGet(() -> ResponseEntity.ok(Map.of("exists", false)));
    }
}
