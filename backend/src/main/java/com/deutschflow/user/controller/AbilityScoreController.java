package com.deutschflow.user.controller;

import com.deutschflow.user.dto.AbilityScoreRequest;
import com.deutschflow.user.dto.AbilityScoreResponse;
import com.deutschflow.user.service.AbilityScoreService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ability")
@RequiredArgsConstructor
public class AbilityScoreController {

    private final AbilityScoreService abilityScoreService;

    @PostMapping("/score")
    public AbilityScoreResponse score(@Valid @RequestBody AbilityScoreRequest request) {
        double s = abilityScoreService.compute(request);
        return new AbilityScoreResponse(s);
    }
}

