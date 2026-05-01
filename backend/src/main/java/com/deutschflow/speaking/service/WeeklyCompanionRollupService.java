package com.deutschflow.speaking.service;

import com.deutschflow.speaking.dto.WeeklySpeakingDtos;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Date;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Merges weekly speaking rubric aggregates into companion {@code learner_progress_reports} (weekly bucket).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WeeklyCompanionRollupService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    /**
     * @return {@code false} when merge failed softly (submission still persisted elsewhere).
     */
    public boolean tryMergeWeeklySubmission(long userId,
                                            LocalDate weekStart,
                                            LocalDate weekEndExclusive,
                                            WeeklySpeakingDtos.WeeklyRubricView view,
                                            long submissionId,
                                            long promptId,
                                            String modelUsed) {
        try {
            ObjectNode submissionNode = objectMapper.createObjectNode();
            submissionNode.put("submission_id", submissionId);
            submissionNode.put("prompt_id", promptId);
            submissionNode.put("task_score", view.task_completion().score_1_to_5());
            submissionNode.put("off_topic", view.task_completion().off_topic());
            submissionNode.put("ambiguous", view.task_completion().ambiguous());
            submissionNode.put("model_used", modelUsed == null ? "" : modelUsed);
            submissionNode.put("graded_at", Instant.now().toString());

            ObjectNode envelope = objectMapper.createObjectNode();
            envelope.set("weekly_speaking_submission", submissionNode);

            Integer existing = jdbcTemplate.queryForObject(
                    """
                            SELECT COUNT(*) FROM learner_progress_reports
                            WHERE user_id = ? AND period_type = 'WEEK' AND period_start = ?
                            """,
                    Integer.class, userId, Date.valueOf(weekStart));
            if (existing != null && existing > 0) {
                String raw = jdbcTemplate.queryForObject("""
                                SELECT CAST(metrics_json AS CHAR) FROM learner_progress_reports
                                WHERE user_id = ? AND period_type = 'WEEK' AND period_start = ?
                                """,
                        String.class, userId, Date.valueOf(weekStart));
                ObjectNode merged;
                if (raw == null || raw.isBlank()) {
                    merged = envelope.deepCopy();
                } else {
                    merged = objectMapper.readValue(raw, ObjectNode.class);
                    merged.set("weekly_speaking_submission", submissionNode);
                }
                jdbcTemplate.update("""
                                UPDATE learner_progress_reports
                                SET metrics_json = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE user_id = ? AND period_type = 'WEEK' AND period_start = ?
                                """,
                        objectMapper.writeValueAsString(merged), userId, Date.valueOf(weekStart));
            } else {
                jdbcTemplate.update("""
                                INSERT INTO learner_progress_reports (
                                  user_id, period_type, period_start, period_end_exclusive, timezone, status, metrics_json
                                ) VALUES (?, 'WEEK', ?, ?, 'Asia/Ho_Chi_Minh', 'DRAFT', ?)
                                """,
                        userId, Date.valueOf(weekStart), Date.valueOf(weekEndExclusive),
                        objectMapper.writeValueAsString(envelope));
            }
            return true;
        } catch (Exception e) {
            log.warn("[WeeklyCompanion] Failed to merge weekly submission metrics: {}", e.getMessage());
            return false;
        }
    }
}
