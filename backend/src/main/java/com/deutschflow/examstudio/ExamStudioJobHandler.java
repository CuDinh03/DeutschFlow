package com.deutschflow.examstudio;

import com.deutschflow.ai.queue.AiJob;
import com.deutschflow.ai.queue.AiJobHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * Chạy các thao tác AI của Xưởng đề trên hàng job chung ({@code ai_jobs}).
 *
 * <p>Văn bản bài báo dán tay đi qua payload của job (bảng {@code ai_jobs}) — việc ĐẦU TIÊN của handler là gỡ nó
 * khỏi payload cả trong bộ nhớ (worker lưu lại chính entity này khi xong/hỏng) lẫn trong DB, để bài gốc không
 * nằm lại trong cơ sở dữ liệu (luật nguồn 07/11).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ExamStudioJobHandler implements AiJobHandler {

    public static final String JOB_TYPE = "EXAM_STUDIO";
    static final String PASTED_TEXT = "pastedText";
    /** Kênh tạo đề admin chọn cho thao tác này (FIREWORKS / ROUTER). */
    static final String CHANNEL = "channel";

    private final ExamDraftService drafts;
    private final JdbcTemplate jdbc;

    @Override
    public String jobType() {
        return JOB_TYPE;
    }

    @Override
    public Map<String, Object> handle(AiJob job) {
        Map<String, Object> payload = new HashMap<>(job.getPayload() == null ? Map.of() : job.getPayload());
        String pasted = (String) payload.remove(PASTED_TEXT);
        if (pasted != null) {
            job.setPayload(new HashMap<>(payload));
            jdbc.update("UPDATE ai_jobs SET payload = payload - ? WHERE id = ?", PASTED_TEXT, job.getId());
        }
        long draftId = ((Number) payload.get("draftId")).longValue();
        String op = String.valueOf(payload.get("op"));
        long userId = job.getUserId();
        ExamStudioAi.useChannel(ExamStudioAi.Channel.of(payload.get(CHANNEL)));
        try {
            switch (op) {
                case "FACTS" -> drafts.runFacts(draftId, userId, payload, pasted);
                case "TEXT" -> drafts.runText(draftId, userId, payload);
                case "ITEMS", "ITEM" -> drafts.runItems(draftId, userId, payload);
                case "VERIFY" -> drafts.runVerify(draftId, userId);
                default -> throw new IllegalStateException("Thao tác lạ: " + op);
            }
            drafts.finishBusy(draftId, null);
        } catch (RuntimeException e) {
            String msg = e.getMessage() == null || e.getMessage().isBlank()
                    ? "Thao tác AI thất bại, hãy thử lại." : e.getMessage();
            log.warn("[ExamStudio] {} của bản nháp {} hỏng: {}", op, draftId, msg);
            drafts.finishBusy(draftId, msg);
            throw e;
        } finally {
            ExamStudioAi.clearChannel();
        }
        return Map.of("draftId", draftId, "op", op);
    }

    @Override
    public void onFailure(AiJob job, Exception cause) {
        try {
            Object id = job.getPayload() == null ? null : job.getPayload().get("draftId");
            if (id instanceof Number n) {
                jdbc.update("UPDATE exam_drafts SET busy_op = NULL, busy_job_id = NULL, "
                        + "last_error = COALESCE(last_error, ?) WHERE id = ? AND busy_job_id = ?",
                        "Thao tác AI thất bại, hãy thử lại.", n.longValue(), job.getId());
            }
        } catch (Exception e) {
            log.warn("[ExamStudio] onFailure lỗi: {}", e.getMessage());
        }
    }
}
