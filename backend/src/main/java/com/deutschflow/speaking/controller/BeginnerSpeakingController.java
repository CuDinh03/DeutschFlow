package com.deutschflow.speaking.controller;

import com.deutschflow.speaking.dto.BeginnerSpeakingResponse;
import com.deutschflow.speaking.service.BeginnerSpeakingService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/speaking/beginner")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class BeginnerSpeakingController {

    private final BeginnerSpeakingService beginnerSpeakingService;

    @GetMapping("/day1")
    public BeginnerSpeakingResponse getDay1Prompt() {
        return beginnerSpeakingService.getDay1SpeakingPrompt();
    }

    @GetMapping("/templates")
    public List<BeginnerSpeakingResponse> getAllBeginnerTemplates() {
        return beginnerSpeakingService.getAllBeginnerTemplates();
    }
}
