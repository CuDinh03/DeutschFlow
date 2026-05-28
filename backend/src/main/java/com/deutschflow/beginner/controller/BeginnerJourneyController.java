package com.deutschflow.beginner.controller;

import com.deutschflow.beginner.dto.BeginnerSessionResponse;
import com.deutschflow.beginner.service.BeginnerJourneyService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/beginner")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class BeginnerJourneyController {

    private final BeginnerJourneyService beginnerJourneyService;

    @GetMapping("/first-session")
    public BeginnerSessionResponse getFirstSession() {
        return beginnerJourneyService.getFirstSession();
    }

    @PostMapping("/first-session/complete")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void completeFirstSession(@AuthenticationPrincipal User user) {
        beginnerJourneyService.recordFirstSessionCompletion(user);
    }
}
