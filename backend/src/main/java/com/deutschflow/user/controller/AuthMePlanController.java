package com.deutschflow.user.controller;

import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrganizationRepository;
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
    private final OrganizationRepository organizationRepository;

    @GetMapping("/plan")
    public MyPlanResponse plan(@AuthenticationPrincipal User user) {
        var badge = quotaService.resolvePlanBadge(user.getId(), Instant.now());
        return new MyPlanResponse(badge.planCode(), badge.tier(), badge.startsAtUtc(), badge.endsAtUtc(),
                badge.isTrial(), badge.trialEndsAt(), badge.source(), orgNameFor(user, badge.source()));
    }

    /**
     * Tên trung tâm — CHỈ tra khi gói thật sự do trung tâm cấp (V-06). Không tra cho mọi request:
     * người B2C không có orgId, và thành viên trung tâm tự mua gói Apple thì tên trung tâm không
     * liên quan gì tới cái gói ấy.
     */
    private String orgNameFor(User user, String source) {
        if (!"ORG".equals(source) || user.getOrgId() == null) {
            return null;
        }
        return organizationRepository.findById(user.getOrgId())
                .map(Organization::getName)
                .orElse(null);
    }
}
