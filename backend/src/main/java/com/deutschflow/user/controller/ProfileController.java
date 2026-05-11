package com.deutschflow.user.controller;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.user.dto.*;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.service.AuthService;
import com.deutschflow.user.service.UserLearningProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Profile settings endpoints for authenticated students.
 * Separate from AuthController to keep concerns clean.
 */
@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ProfileController {

    private final AuthService authService;
    private final UserLearningProfileService learningProfileService;
    private final UserLearningProfileRepository learningProfileRepository;

    /**
     * PATCH /api/profile/me
     * Cập nhật thông tin cá nhân: displayName, phoneNumber, locale.
     * Không cần OTP cho phiên bản hiện tại.
     */
    @PatchMapping("/me")
    public AuthResponse updateProfile(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody UpdateProfileRequest request) {
        return authService.updateProfile(user, request);
    }

    /**
     * GET /api/profile/me/learning
     * Lấy learning profile đầy đủ để pre-fill form settings.
     */
    @GetMapping("/me/learning")
    public LearningProfileResponse getLearningProfile(@AuthenticationPrincipal User user) {
        UserLearningProfile profile = learningProfileRepository.findByUserId(user.getId())
                .orElseThrow(() -> new NotFoundException("Learning profile not found. Please complete onboarding first."));
        return learningProfileService.toResponse(profile);
    }

    /**
     * PATCH /api/profile/me/learning
     * Cập nhật learning profile (partial update — chỉ fields được gửi lên).
     */
    @PatchMapping("/me/learning")
    public LearningProfileResponse updateLearningProfile(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody UpdateLearningProfileRequest request) {
        UserLearningProfile updated = learningProfileService.partialUpdate(user, request);
        return learningProfileService.toResponse(updated);
    }

    /**
     * PATCH /api/auth/me/password
     * Đổi mật khẩu — yêu cầu xác nhận mật khẩu hiện tại.
     * Sau khi đổi, tất cả refresh tokens bị revoke (buộc đăng nhập lại).
     */
    @PatchMapping("/me/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(user, request);
    }
}
