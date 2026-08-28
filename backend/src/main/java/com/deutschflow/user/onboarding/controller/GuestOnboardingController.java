package com.deutschflow.user.onboarding.controller;

import com.deutschflow.user.onboarding.dto.GuestSessionDtos.CreateRequest;
import com.deutschflow.user.onboarding.dto.GuestSessionDtos.SessionResponse;
import com.deutschflow.user.onboarding.dto.GuestSessionDtos.UpdateRequest;
import com.deutschflow.user.onboarding.service.GuestOnboardingService;
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
 * <p><b>Rate-limit</b> do {@code PublicApiRateLimitFilter} lo, không phải controller:
 * repo đã có sẵn cơ chế chặn theo IP cho đường công khai, và đường dẫn này được thêm
 * vào danh sách mặc định {@code app.security.unauth-rate-limit.paths}. Dựng thêm một
 * bộ đếm thứ hai trong controller là hai luật chồng nhau, mỗi cái chặn một kiểu.
 */
@RestController
@RequestMapping("/api/onboarding/guest-session")
@RequiredArgsConstructor
public class GuestOnboardingController {

    private final GuestOnboardingService guestOnboardingService;

    /** 201 — tạo phiên mới, trả về sessionId dùng làm bearer cho PATCH. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SessionResponse create(@Valid @RequestBody CreateRequest request) {
        return guestOnboardingService.create(request);
    }

    /** 200 — cập nhật từng phần. Trường vắng mặt = không đổi. */
    @PatchMapping("/{id}")
    public SessionResponse update(@PathVariable UUID id, @Valid @RequestBody UpdateRequest request) {
        return guestOnboardingService.update(id, request);
    }
}
