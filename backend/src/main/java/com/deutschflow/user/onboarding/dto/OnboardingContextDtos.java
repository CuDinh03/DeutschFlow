package com.deutschflow.user.onboarding.dto;

import java.time.Instant;

/**
 * DTO của {@code GET /api/onboarding/context} — Đợt 5 kế hoạch onboarding 17/09/2026 (§4.1 "Ba cửa vào").
 *
 * <p>Một nguồn duy nhất để hai client rẽ lối onboarding theo cách tài khoản được tạo, thay vì suy
 * đoán từ dữ liệu khác ({@code orgId}, gói ORG, …). Thay dần {@code GET /onboarding/status} — giữ
 * {@code /status} cho client cũ.
 */
public final class OnboardingContextDtos {

    private OnboardingContextDtos() {
    }

    /** Cửa vào của tài khoản — xem {@link com.deutschflow.user.onboarding.service.OnboardingContextService}. */
    public enum AccountSource {
        /** C1: tự đăng ký (kể cả C3: tự đăng ký rồi vào lớp bằng mã — không làm lại onboarding). */
        SELF,
        /** C2: trung tâm nhập CSV ({@code users.created_via = CSV}) và còn là STUDENT ACTIVE của trung tâm. */
        ORG_ROSTER,
        /** C2: nhân sự trung tâm/admin tạo tay hoặc mời, và còn là STUDENT ACTIVE của trung tâm. */
        ORG_INVITE
    }

    /**
     * @param accountSource      cửa vào (SELF | ORG_ROSTER | ORG_INVITE)
     * @param hasPlan            đã có lộ trình — cùng nghĩa với {@code /status.hasPlan}
     * @param org                trung tâm + lớp đang ghi danh; {@code null} khi {@code SELF}
     * @param presetCurrentLevel trình độ trung tâm/hồ sơ đã đặt (A0..C2); {@code null} = client phải hỏi
     * @param trial              quyền lợi dùng thử hiện tại (để client đọc "PRO miễn phí tới {ngày}")
     */
    public record OnboardingContextResponse(
            AccountSource accountSource,
            boolean hasPlan,
            OrgInfo org,
            String presetCurrentLevel,
            TrialInfo trial
    ) {}

    /** @param className lớp ACTIVE/RESERVED mới nhất trong trung tâm; {@code null} khi chưa xếp lớp. */
    public record OrgInfo(Long orgId, String name, Long classId, String className) {}

    /** Bản rút gọn của {@link com.deutschflow.common.quota.PlanBadge} — chỉ hai trường onboarding cần. */
    public record TrialInfo(boolean isTrial, Instant trialEndsAt) {}
}
