package com.deutschflow.feedback.service;

import com.deutschflow.feedback.FeedbackEnums.Type;
import com.deutschflow.feedback.entity.FeedbackItem;
import com.deutschflow.notification.NotificationType;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Ghi thông báo của góp ý vào {@code notification_outbox} TRONG giao dịch nghiệp vụ (G2): rollback thì
 * không có tin, worker gửi sau commit kèm push Expo (FBK-45).
 *
 * <p>Khoá {@code dedup_key} quyết định "tối đa một tin" (BR-08): {@code ON CONFLICT DO NOTHING} nên gọi
 * lại không gửi lần hai và không làm hỏng giao dịch đang mở.
 */
@Component
@RequiredArgsConstructor
public class FeedbackNotifier {

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    /** Một tin cho mỗi lời trả lời. */
    public void replied(FeedbackItem item, long replyId) {
        enqueue("feedback-reply:" + replyId, NotificationType.FEEDBACK_REPLIED, item);
    }

    /**
     * Tin "đã thực hiện" khi chuyển tay sang SHIPPED: mỗi góp ý tối đa một tin trong đời (BR-08). Mở lại
     * rồi SHIPPED lần nữa thì khoá đã có, không gửi.
     */
    public void shipped(FeedbackItem item) {
        enqueue("feedback-shipped:" + item.getId(), NotificationType.FEEDBACK_SHIPPED, item);
    }

    private void enqueue(String dedupKey, NotificationType type, FeedbackItem item) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("feedbackId", item.getId());
        payload.put("feedbackTitle", item.getTitle());
        payload.put("bug", item.getType() == Type.BUG);
        jdbc.update("""
                INSERT INTO notification_outbox (dedup_key, notification_type, recipient_id, payload)
                VALUES (?, ?, ?, CAST(? AS jsonb))
                ON CONFLICT (dedup_key) DO NOTHING
                """, dedupKey, type.name(), item.getUserId(), toJson(payload));
    }

    private String toJson(Map<String, Object> payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Không ghi được payload thông báo góp ý", e);
        }
    }
}
