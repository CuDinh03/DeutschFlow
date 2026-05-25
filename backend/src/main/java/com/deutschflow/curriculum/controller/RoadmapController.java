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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/roadmap")
@RequiredArgsConstructor
public class RoadmapController {

    private final RoadmapService roadmapService;

    /**
     * Returns the roadmap for the authenticated student.
     * A0 users follow the foundation branch first; A1+ users follow the personalized branch.
     */
    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public List<RoadmapNodeDto> getMyRoadmap(@AuthenticationPrincipal User user) {
        return roadmapService.generateRoadmapForUser(user.getId());
    }

    /**
     * Exposes roadmap metadata for clients that need to render a learning header.
     */
    @GetMapping("/me/meta")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> getMyRoadmapMeta(@AuthenticationPrincipal User user) {
        return roadmapService.getRoadmapMeta(user.getId());
    }
}
