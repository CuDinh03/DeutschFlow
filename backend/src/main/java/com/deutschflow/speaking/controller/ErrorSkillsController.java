package com.deutschflow.speaking.controller;

import com.deutschflow.speaking.dto.ErrorSkillDto;
import com.deutschflow.speaking.service.ErrorSkillsService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/error-skills")
@RequiredArgsConstructor
public class ErrorSkillsController {

    private final ErrorSkillsService errorSkillsService;

    /**
     * GET /api/error-skills/me?days=30 — aggregated error skills for the current user.
     */
    @GetMapping("/me")
    public List<ErrorSkillDto> getMySkills(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "30") int days) {
        return errorSkillsService.getSkills(user.getId(), days);
    }

    /**
     * POST /api/error-skills/me/{errorCode}/repair-attempt — mark open structured rows as RESOLVED after a successful drill.
     */
    @PostMapping("/me/{errorCode}/repair-attempt")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void repairAttempt(
            @AuthenticationPrincipal User user,
            @PathVariable String errorCode) {
        errorSkillsService.recordRepairAttempt(user.getId(), errorCode);
    }

    /**
     * GET /api/error-skills/me/resolved — completed (resolved) error skills.
     */
    @GetMapping("/me/resolved")
    public List<ErrorSkillDto> getMyResolvedSkills(@AuthenticationPrincipal User user) {
        return errorSkillsService.getResolvedSkills(user.getId());
    }
}
