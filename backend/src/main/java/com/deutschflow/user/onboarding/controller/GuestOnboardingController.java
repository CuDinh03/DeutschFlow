package com.deutschflow.user.onboarding.controller;

import com.deutschflow.common.exception.RateLimitExceededException;
import com.deutschflow.common.web.ClientIpResolver;
import com.deutschflow.user.onboarding.dto.GuestSessionDtos.CreateRequest;
import com.deutschflow.user.onboarding.dto.GuestSessionDtos.SessionResponse;
import com.deutschflow.user.onboarding.dto.GuestSessionDtos.UpdateRequest;
import com.deutschflow.user.onboarding.service.GuestOnboardingService;
import com.deutschflow.user.service.AuthRateLimiterService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Phiên onboarding của KHÁCH — bề mặt CÔNG KHAI (không đăng nhập).
 *
 * <p>Tách khỏi {@code OnboardingController} một cách có chủ ý: controller đó mang
 * {@code @PreAuthorize("hasRole('STUDENT')")} ở cấp class, còn hai endpoint dưới đây
 * phải chạy được khi chưa có tài khoản. Trộn chung là hoặc phải nới quyền cả class,
 * hoặc phải đè annotation ở từng method — cả hai đều dễ hỏng lặng lẽ về sau.
 *
 * <p><b>Đây là bề mặt public MỚI</b>, nên rate-limit theo IP có ngay từ PR đầu:
 * repo đã có tiền sử audit DDoS/EDoS, và một endpoint tạo hàng không giới hạn là
 * lời mời bơm phình bảng.
 */
@RestController
@RequestMapping("/api/onboarding/guest-session")
@RequiredArgsConstructor
public class GuestOnboardingController {

    private final GuestOnboardingService guestOnboardingService;
    private final AuthRateLimiterService rateLimiter;
    private final ClientIpResolver clientIpResolver;

    /** 201 — tạo phiên mới, trả về sessionId dùng làm bearer cho PATCH. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SessionResponse create(@Valid @RequestBody CreateRequest request, HttpServletRequest http) {
        guard(http);
        return guestOnboardingService.create(request);
    }

    /** 200 — cập nhật từng phần. Trường vắng mặt = không đổi. */
    @PatchMapping("/{id}")
    public SessionResponse update(@PathVariable UUID id,
                                  @Valid @RequestBody UpdateRequest request,
                                  HttpServletRequest http) {
        guard(http);
        return guestOnboardingService.update(id, request);
    }

    private void guard(HttpServletRequest http) {
        String ip = clientIpResolver.resolve(http);
        if (!rateLimiter.allowGuestSession(ip)) {
            throw new RateLimitExceededException(
                    "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
                    rateLimiter.guestSessionRetryAfterSeconds());
        }
    }
}
