package com.deutschflow.progress.controller;

import com.deutschflow.progress.dto.NextActionResponse;
import com.deutschflow.progress.dto.PhaseStateResponse;
import com.deutschflow.progress.service.PhaseEngineService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/phase")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class PhaseController {

    private final PhaseEngineService phaseEngineService;

    @GetMapping("/current")
    public PhaseStateResponse getCurrentPhase(@AuthenticationPrincipal User user) {
        var state = phaseEngineService.getOrCreatePhaseState(user);
        return PhaseStateResponse.from(state, phaseEngineService.isReadyToAdvance(state));
    }

    @GetMapping("/next-action")
    public NextActionResponse getNextActions(@AuthenticationPrincipal User user) {
        var state = phaseEngineService.getOrCreatePhaseState(user);
        return new NextActionResponse(
                state.getCurrentPhase().name(),
                phaseEngineService.getNextActions(state)
        );
    }
}
