package com.deutschflow.user.onboarding.dto;

import com.deutschflow.user.onboarding.FirstLessonKind;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** DTO của hai endpoint activation (Đợt 1 kế hoạch onboarding 17/09). */
public final class ActivationDtos {

    private ActivationDtos() {}

    /**
     * POST /api/onboarding/first-lesson/complete.
     *
     * @param kind nguồn hoàn thành (bắt buộc)
     * @param meta ngữ cảnh tuỳ ý client gửi kèm (vd. {@code mode: echo}); chỉ ghi log, không lưu —
     *             để hợp đồng chịu được client thêm trường mà không đổi server
     */
    public record FirstLessonCompleteRequest(@NotNull FirstLessonKind kind, Map<String, Object> meta) {}

    /**
     * Kết quả ghi activation.
     *
     * @param activatedAt mốc kích hoạt (lần đầu hoàn thành bất kỳ bài nào)
     * @param firstTime true = chính lời gọi này vừa ghi {@code activated_at}; các lần sau false
     * @param completedActivities danh sách {@code FIRST_LESSON:<KIND>} đã tích luỹ
     */
    public record ActivationResponse(Instant activatedAt, boolean firstTime, List<String> completedActivities) {}

    /** POST /api/onboarding/progress/core-done. */
    public record CoreDoneResponse(Instant coreCompletedAt, boolean firstTime) {}
}
