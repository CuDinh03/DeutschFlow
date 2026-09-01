package com.deutschflow.organization.controller;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.organization.service.OrgSettingsService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Cấu hình trung tâm (V298, PR-10): P04 chính sách tính công + 2 ngưỡng gợi ý hỗ trợ (§7).
 * OWNER-only — đây là chính sách vận hành/tiền nong của giám đốc, không phải việc hằng ngày
 * của MANAGER.
 */
@RestController
@RequestMapping("/api/org/settings")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class OrgSettingsController {

    private final OrgSettingsService settingsService;
    private final OrgGuard orgGuard;

    @GetMapping
    public Map<String, String> all(@AuthenticationPrincipal User user) {
        Long orgId = requireOrgContext(user);
        orgGuard.assertOrgOwner(user.getId(), orgId);
        return settingsService.all(orgId);
    }

    public record PutBody(Map<String, String> settings) {}

    @PutMapping
    public Map<String, String> put(@AuthenticationPrincipal User user, @RequestBody PutBody body) {
        Long orgId = requireOrgContext(user);
        orgGuard.assertOrgOwner(user.getId(), orgId);
        if (body == null || body.settings() == null || body.settings().isEmpty()) {
            throw new BadRequestException("Không có cấu hình nào để lưu");
        }
        // Validate giá trị theo key TRƯỚC khi ghi bất kỳ dòng nào.
        for (Map.Entry<String, String> e : body.settings().entrySet()) {
            validate(e.getKey(), e.getValue());
        }
        for (Map.Entry<String, String> e : body.settings().entrySet()) {
            settingsService.put(orgId, e.getKey(), e.getValue().trim(), user.getId());
        }
        return settingsService.all(orgId);
    }

    private static void validate(String key, String value) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException("Giá trị trống cho " + key);
        }
        switch (key) {
            case OrgSettingsService.TIMESHEET_BREAK_INCLUDED -> {
                if (!"true".equals(value) && !"false".equals(value)) {
                    throw new BadRequestException(key + " chỉ nhận true/false");
                }
            }
            case OrgSettingsService.SUPPORT_INDIVIDUAL_MAX, OrgSettingsService.REVIEW_GROUP_MIN -> {
                try {
                    int n = Integer.parseInt(value.trim());
                    if (n < 1 || n > 100) throw new NumberFormatException();
                } catch (NumberFormatException ex) {
                    throw new BadRequestException(key + " phải là số nguyên 1–100");
                }
            }
            default -> throw new BadRequestException("Key cấu hình không hợp lệ: " + key);
        }
    }

    private Long requireOrgContext(User user) {
        Long orgId = user.getOrgId();
        if (orgId == null) {
            throw new ForbiddenException("Bạn không thuộc tổ chức nào");
        }
        return orgId;
    }
}
