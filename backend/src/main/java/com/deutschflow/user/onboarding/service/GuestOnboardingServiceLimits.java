package com.deutschflow.user.onboarding.service;

import com.deutschflow.common.exception.BadRequestException;

import java.util.Map;

/**
 * Trần cỡ cho {@code answers}/{@code activityResult} của phiên onboarding khách (chống bot 07/11/2026).
 * Bề mặt công khai: ai cầm sessionId cũng ghi được JSONB vào DB, nên chặn cỡ để nó không thành kho chứa
 * miễn phí. Câu trả lời thật của phễu chỉ vài trăm "ký tự"; trần đặt rộng gấp hàng chục lần.
 */
public final class GuestOnboardingServiceLimits {

    static final int MAX_TOP_LEVEL_KEYS = 64;
    static final int MAX_DEPTH = 4;
    static final int MAX_WEIGHT = 16_000;

    private GuestOnboardingServiceLimits() {}

    /** @throws BadRequestException khi vượt số khoá cấp đầu, độ sâu lồng hoặc trọng lượng ≈ số ký tự */
    public static void check(Map<String, Object> map, String field) {
        if (map == null) return;
        if (map.size() > MAX_TOP_LEVEL_KEYS || weigh(map, 0) > MAX_WEIGHT) {
            throw new BadRequestException(field + " quá lớn.");
        }
    }

    /** Ước lượng cỡ của giá trị JSON đã parse; vượt độ sâu thì trả trọng lượng "vô hạn". */
    private static int weigh(Object v, int depth) {
        if (depth > MAX_DEPTH) return MAX_WEIGHT + 1;
        if (v == null) return 4;
        if (v instanceof String str) return str.length() + 2;
        if (v instanceof Map<?, ?> m) {
            int w = 2;
            for (Map.Entry<?, ?> e : m.entrySet()) {
                w += String.valueOf(e.getKey()).length() + 3 + weigh(e.getValue(), depth + 1);
                if (w > MAX_WEIGHT) return w;
            }
            return w;
        }
        if (v instanceof Iterable<?> it) {
            int w = 2;
            for (Object o : it) {
                w += 1 + weigh(o, depth + 1);
                if (w > MAX_WEIGHT) return w;
            }
            return w;
        }
        return String.valueOf(v).length();
    }
}
