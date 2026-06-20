package com.deutschflow.curriculum.controller;

import com.deutschflow.curriculum.dto.RoadmapSetupRequest;
import com.deutschflow.curriculum.dto.RoadmapSetupResultDto;
import com.deutschflow.curriculum.dto.RoadmapSetupStateDto;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/roadmap")
@RequiredArgsConstructor
public class RoadmapSetupController {

    private final UserLearningProfileRepository profileRepository;

    @PostMapping("/setup")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<RoadmapSetupResultDto> createOrUpdateSetup(
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

        RoadmapSetupResultDto response = new RoadmapSetupResultDto(
                true,
                profile.getCurrentLevel() == UserLearningProfile.CurrentLevel.A0 ? "A0_A1_Foundation_First" : "PERSONALIZED_CEFR_V1",
                profile.getCurrentLevel() == UserLearningProfile.CurrentLevel.A0 ? "FOUNDATION_FIRST" : "PERSONALIZED",
                profile.getCurrentLevel().name(),
                profile.getTargetLevel().name(),
                "/roadmap");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/setup")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<RoadmapSetupStateDto> getSetup(@AuthenticationPrincipal User user) {
        return profileRepository.findByUserId(user.getId())
                .map(profile -> ResponseEntity.ok(RoadmapSetupStateDto.exists(
                        profile.getGoalType().name(),
                        profile.getCurrentLevel().name(),
                        profile.getTargetLevel().name(),
                        profile.getSessionsPerWeek(),
                        profile.getMinutesPerSession(),
                        profile.getLearningSpeed().name(),
                        profile.getIndustry(),
                        profile.getExamType(),
                        profile.getInterestsJson())))
                .orElseGet(() -> ResponseEntity.ok(RoadmapSetupStateDto.notExists()));
    }
}
