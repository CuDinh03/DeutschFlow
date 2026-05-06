package com.deutschflow.curriculum.controller;

import com.deutschflow.curriculum.dto.RoadmapNodeDto;
import com.deutschflow.curriculum.service.RoadmapService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/roadmap")
@RequiredArgsConstructor
public class RoadmapController {

    private final RoadmapService roadmapService;

    /**
     * Returns a personalized learning roadmap for the authenticated student,
     * built dynamically from their UserLearningProfile (industry, interests, goalType, etc.).
     */
    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public List<RoadmapNodeDto> getMyRoadmap(@AuthenticationPrincipal User user) {
        return roadmapService.generateRoadmapForUser(user.getId());
    }
}
