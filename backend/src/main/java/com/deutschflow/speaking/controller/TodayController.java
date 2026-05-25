package com.deutschflow.speaking.controller;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.speaking.dto.TodayPlanDto;
import com.deutschflow.speaking.service.AdaptivePolicyService;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.service.StudentDashboardService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/today")
@RequiredArgsConstructor
public class TodayController {

    private final AdaptivePolicyService adaptivePolicyService;
    private final UserLearningProfileRepository profileRepository;
    private final ObjectMapper objectMapper;
    private final StudentDashboardService studentDashboardService;

    @GetMapping("/me")
    public TodayPlanDto me(@AuthenticationPrincipal User user) {
        UserLearningProfile profile = profileRepository.findByUserId(user.getId()).orElse(null);
        List<String> interests = parseInterests(profile);
        int streak = 0;
        try {
            streak = studentDashboardService.getDashboard(user).streakDays();
        } catch (NotFoundException ignored) {
            // No learning plan yet — streak not applicable
        }
        return adaptivePolicyService.todayPlanForUser(user.getId(), profile, interests, streak);
    }

    private List<String> parseInterests(UserLearningProfile profile) {
        if (profile == null || profile.getInterestsJson() == null || profile.getInterestsJson().isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(profile.getInterestsJson(), new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }
}
