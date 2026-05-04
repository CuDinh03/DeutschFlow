package com.deutschflow.user.controller;

import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.user.dto.MyPlanResponse;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
@RequestMapping("/api/auth/me")
@RequiredArgsConstructor
public class AuthMePlanController {

    private final QuotaService quotaService;

    @GetMapping("/plan")
    public MyPlanResponse plan(@AuthenticationPrincipal User user) {
        var badge = quotaService.resolvePlanBadge(user.getId(), Instant.now());
        return new MyPlanResponse(badge.planCode(), badge.tier(), badge.startsAtUtc(), badge.endsAtUtc());
    }
}
