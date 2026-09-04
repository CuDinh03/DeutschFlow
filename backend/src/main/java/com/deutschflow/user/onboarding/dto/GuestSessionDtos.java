package com.deutschflow.user.onboarding.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** DTO cho luồng guest onboarding (spec docs/onboarding-flow-spec.md §4.3). */
public final class GuestSessionDtos {

    private GuestSessionDtos() {}

    /** POST /api/onboarding/guest-session */
    public record CreateRequest(
            @NotBlank @Pattern(regexp = "WEB|IOS|ANDROID", message = "platform phải là WEB, IOS hoặc ANDROID")
            String platform,
            @NotBlank @Pattern(regexp = "vi|en|de", message = "locale phải là vi, en hoặc de")
            String locale
    ) {}

    /**
     * PATCH /api/onboarding/guest-session/{id}
     *
     * <p>Mọi trường đều tuỳ chọn: client cập nhật từng phần khi người dùng đi qua
     * các bước. Trường null = "không đổi", KHÔNG phải "xoá".
     */
    public record UpdateRequest(
            @Size(max = 32) String currentStep,
            Map<String, Object> answers,
            Map<String, Object> activityResult
    ) {}

    /** Trả về cho client sau create/patch. KHÔNG lộ claimedByUserId. */
    public record SessionResponse(
            UUID sessionId,
            String currentStep,
            String flowVersion,
            Instant expiresAt
    ) {}

    /** POST /api/onboarding/claim */
    public record ClaimRequest(@NotBlank String sessionId) {}

    /**
     * Kết quả claim.
     *
     * @param claimed true = phiên này vừa được (hoặc đã được) gắn vào user hiện tại
     * @param alreadyClaimed true = user gọi claim lần thứ hai; đây KHÔNG phải lỗi (I-6)
     */
    public record ClaimResponse(
            boolean claimed,
            boolean alreadyClaimed,
            ProgressResponse progress
    ) {}

    /** GET /api/onboarding/progress — nguồn để resume trên thiết bị khác (I-2). */
    public record ProgressResponse(
            String flowVersion,
            String lastStep,
            List<String> completedActivities,
            Instant activatedAt,
            Instant coreCompletedAt
    ) {}
}
