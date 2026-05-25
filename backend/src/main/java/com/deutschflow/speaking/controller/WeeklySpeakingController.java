package com.deutschflow.speaking.controller;

import com.deutschflow.speaking.dto.WeeklySpeakingDtos;
import com.deutschflow.speaking.service.WeeklySpeakingService;
import com.deutschflow.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Weekly speaking API used by the roadmap recording flow.
 *
 * Frontend contract:
 * - GET  /api/ai-speaking/weekly/current-prompt
 * - POST /api/ai-speaking/weekly/submissions
 * - GET  /api/ai-speaking/weekly/me/submissions
 * - GET  /api/ai-speaking/weekly/me/submissions/{id}
 */
@Slf4j
@RestController
@RequestMapping("/api/ai-speaking/weekly")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('STUDENT','TEACHER','ADMIN')")
public class WeeklySpeakingController {

    private final WeeklySpeakingService weeklySpeakingService;

    @GetMapping("/current-prompt")
    public WeeklySpeakingDtos.WeeklyPromptResponse getCurrentPrompt(
            @AuthenticationPrincipal User user,
            @RequestParam(value = "cefrBand", required = false) String cefrBand) {
        return weeklySpeakingService.getCurrentPrompt(user.getId(), cefrBand);
    }

    @PostMapping("/submissions")
    public WeeklySpeakingDtos.WeeklySubmissionResponse submit(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody WeeklySpeakingDtos.WeeklySubmissionRequest request) {
        return weeklySpeakingService.submit(user.getId(), request);
    }

    @GetMapping("/me/submissions")
    public Page<WeeklySpeakingDtos.WeeklySubmissionListItem> listMySubmissions(
            @AuthenticationPrincipal User user,
            Pageable pageable) {
        return weeklySpeakingService.listMySubmissions(user.getId(), pageable);
    }

    @GetMapping("/me/submissions/{id}")
    public WeeklySpeakingDtos.WeeklySubmissionDetailDto getMySubmission(
            @AuthenticationPrincipal User user,
            @PathVariable long id) {
        return weeklySpeakingService.getSubmissionForUser(user.getId(), id);
    }
}
