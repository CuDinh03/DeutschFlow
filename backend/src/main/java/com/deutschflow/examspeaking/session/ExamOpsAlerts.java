package com.deutschflow.examspeaking.session;

import com.deutschflow.examspeaking.api.model.Ergebnisbogen;
import com.deutschflow.examspeaking.config.ExamSpeakingProperties;
import com.deutschflow.notification.service.UserNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Cảnh báo vận hành cho chấm mock (audit 31/08 F-07): trước đây provider lỗi 50% vẫn "COMPLETED" với
 * mẫu số thu nhỏ — học viên thấy ghi chú, vận hành mù. Nay đẩy thông báo in-app cho mọi ADMIN
 * (kênh {@code ADMIN_SYSTEM_ALERT} sẵn có) khi: (a) job chấm thất bại/kẹt, (b) tỉ lệ tiêu chí không
 * chấm được vượt ngưỡng cấu hình. Throttle theo loại để một sự cố nhà cung cấp không xả hàng trăm
 * thông báo; mọi lỗi ở đây được nuốt — cảnh báo không bao giờ được làm hỏng luồng chấm.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ExamOpsAlerts {

    static final String SOURCE = "EXAM_SPEAKING";
    static final Duration THROTTLE = Duration.ofMinutes(10);

    private final UserNotificationService notifications;
    private final ExamSpeakingProperties props;
    private final Map<String, Instant> lastByKind = new ConcurrentHashMap<>();

    /** Job chấm chết/kẹt/hết quota → phiên GRADING_FAILED. */
    public void gradingFailed(long sessionId, Long jobId, String reason, String detail) {
        if (!allow("failed:" + reason, Instant.now())) {
            return;
        }
        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("sessionId", sessionId);
        extra.put("jobId", jobId);
        extra.put("reason", reason);
        send("Chấm mock thất bại (" + reason + ")",
                "Phiên " + sessionId + " chuyển GRADING_FAILED — lý do " + reason
                        + (detail == null || detail.isBlank() ? "" : ": " + abbreviate(detail)) + ".",
                extra);
    }

    /** Phiếu đã phát hành nhưng thiếu tín hiệu (provider/JSON lỗi một phần). */
    public void lowSignal(long sessionId, Ergebnisbogen sheet) {
        long total = sheet.parts().stream().mapToLong(p -> p.criteria().size()).sum() + sheet.global().size();
        long unscored = sheet.parts().stream().flatMap(p -> p.criteria().stream())
                .filter(c -> !c.scored()).count()
                + sheet.global().stream().filter(c -> !c.scored()).count();
        boolean llmInvalid = sheet.noteMsgs().stream().anyMatch(m -> "llmInvalidTeil".equals(m.code()));
        if (total == 0) {
            return;
        }
        double ratio = (double) unscored / total;
        if (!llmInvalid && ratio < props.alertUnscoredRatioOrDefault()) {
            return;
        }
        if (!allow("low-signal", Instant.now())) {
            return;
        }
        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("sessionId", sessionId);
        extra.put("unscored", unscored);
        extra.put("total", total);
        extra.put("llmInvalidTeil", llmInvalid);
        send("Chấm mock thiếu tín hiệu",
                "Phiên " + sessionId + ": " + unscored + "/" + total + " tiêu chí không chấm được"
                        + (llmInvalid ? " (có Teil LLM trả JSON hỏng)" : "") + " — kiểm tra nhà cung cấp LLM.",
                extra);
    }

    boolean allow(String kind, Instant now) {
        Instant last = lastByKind.get(kind);
        if (last != null && last.plus(THROTTLE).isAfter(now)) {
            return false;
        }
        lastByKind.put(kind, now);
        return true;
    }

    private void send(String title, String message, Map<String, Object> extra) {
        try {
            notifications.onSystemAlert(SOURCE, title, message, extra);
        } catch (RuntimeException e) {
            log.warn("[ExamOpsAlerts] không gửi được cảnh báo admin: {}", e.getMessage());
        }
    }

    private static String abbreviate(String s) {
        return s.length() <= 160 ? s : s.substring(0, 157) + "…";
    }
}
