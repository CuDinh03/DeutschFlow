package com.deutschflow.training.service;

import com.deutschflow.speaking.ai.ErrorItem;
import com.deutschflow.speaking.ai.AiResponseDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Tự động lưu từng lượt hội thoại và các lỗi sai của người dùng
 * vào bảng training_conversations và training_error_samples
 * để làm dataset fine-tune AI local (deutschflow_model).
 *
 * Tất cả các method đều @Async để không chặn luồng chính.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TrainingDatasetService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    /**
     * Lưu một lượt hội thoại (user message → AI response) kèm các lỗi sai.
     * Được gọi sau mỗi lần chat thành công (blocking hoặc streaming).
     */
    @Async
    public void recordConversationTurn(
            Long userId,
            Long sessionId,
            String cefrLevel,
            String topic,
            String userMessage,
            AiResponseDto aiResponse,
            String systemPrompt,
            Long aiMessageId,
            String aiProvider
    ) {
        try {
            List<ErrorItem> errors = aiResponse.errors() != null ? aiResponse.errors() : List.of();
            int errorCount = errors.size();
            boolean hasErrors = errorCount > 0;

            // Tính quality_score: bắt đầu từ 100, trừ điểm theo lỗi
            double qualityScore = calculateQualityScore(userMessage, aiResponse, errorCount);

            // Lưu training_conversations
            String sql = """
                    INSERT INTO training_conversations
                        (session_id, user_id, cefr_level, topic,
                         user_message, ai_response_de, correction, explanation_vi, grammar_point,
                         instruction, input, output,
                         has_errors, error_count, quality_score,
                         ai_message_id, ai_provider, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """;

            jdbcTemplate.update(sql,
                    sessionId, userId, cefrLevel, topic,
                    userMessage,
                    aiResponse.aiSpeechDe(),
                    aiResponse.correction(),
                    aiResponse.explanationVi(),
                    aiResponse.grammarPoint(),
                    // Alpaca fields
                    trimInstruction(systemPrompt),
                    userMessage,
                    aiResponse.aiSpeechDe(),
                    // metadata
                    hasErrors, errorCount, qualityScore,
                    aiMessageId, aiProvider,
                    Timestamp.from(Instant.now())
            );

            // Lấy id của bản ghi vừa insert
            Long convId = jdbcTemplate.queryForObject(
                    "SELECT id FROM training_conversations WHERE session_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1",
                    Long.class, sessionId, userId);

            // Lưu từng lỗi sai chi tiết (error_samples)
            if (hasErrors && convId != null) {
                for (ErrorItem err : errors) {
                    recordErrorSample(convId, sessionId, userId, cefrLevel,
                            userMessage, aiResponse.correction(), err);
                }
            }

            log.debug("[TrainingDataset] Recorded turn for user={} session={} errors={}", userId, sessionId, errorCount);

        } catch (Exception e) {
            log.warn("[TrainingDataset] Failed to record turn for user={} session={}: {}", userId, sessionId, e.getMessage());
        }
    }

    /**
     * Export toàn bộ dataset dưới dạng JSONL (Alpaca format) cho fine-tuning.
     * Format: {"instruction": ..., "input": ..., "output": ...}
     */
    public String exportAlpacaJsonl(String cefrLevel, boolean errorsOnly, int limit) {
        try {
            String whereClause = "WHERE include_in_dataset = TRUE";
            Object[] args;

            if (cefrLevel != null && !cefrLevel.isBlank() && errorsOnly) {
                whereClause += " AND cefr_level = ? AND has_errors = TRUE";
                args = new Object[]{cefrLevel, limit};
            } else if (cefrLevel != null && !cefrLevel.isBlank()) {
                whereClause += " AND cefr_level = ?";
                args = new Object[]{cefrLevel, limit};
            } else if (errorsOnly) {
                whereClause += " AND has_errors = TRUE";
                args = new Object[]{limit};
            } else {
                args = new Object[]{limit};
            }

            String sql = "SELECT instruction, input, output FROM training_conversations "
                    + whereClause + " ORDER BY quality_score DESC NULLS LAST, created_at DESC LIMIT ?";

            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, args);

            StringBuilder sb = new StringBuilder();
            for (Map<String, Object> row : rows) {
                Map<String, Object> alpaca = Map.of(
                        "instruction", nullToEmpty(row.get("instruction")),
                        "input",       nullToEmpty(row.get("input")),
                        "output",      nullToEmpty(row.get("output"))
                );
                sb.append(objectMapper.writeValueAsString(alpaca)).append("\n");
            }
            return sb.toString();

        } catch (Exception e) {
            log.error("[TrainingDataset] Export failed: {}", e.getMessage());
            throw new RuntimeException("Export failed: " + e.getMessage(), e);
        }
    }

    /**
     * Export riêng error samples dưới dạng Alpaca JSONL cho fine-tune khả năng correction.
     */
    public String exportErrorSamplesJsonl(String cefrLevel, int limit) {
        try {
            String sql;
            Object[] args;
            if (cefrLevel != null && !cefrLevel.isBlank()) {
                sql = "SELECT alpaca_instruction, alpaca_input, alpaca_output FROM training_error_samples "
                        + "WHERE include_in_dataset = TRUE AND cefr_level = ? "
                        + "ORDER BY created_at DESC LIMIT ?";
                args = new Object[]{cefrLevel, limit};
            } else {
                sql = "SELECT alpaca_instruction, alpaca_input, alpaca_output FROM training_error_samples "
                        + "WHERE include_in_dataset = TRUE "
                        + "ORDER BY created_at DESC LIMIT ?";
                args = new Object[]{limit};
            }

            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, args);
            StringBuilder sb = new StringBuilder();
            for (Map<String, Object> row : rows) {
                Map<String, Object> alpaca = Map.of(
                        "instruction", nullToEmpty(row.get("alpaca_instruction")),
                        "input",       nullToEmpty(row.get("alpaca_input")),
                        "output",      nullToEmpty(row.get("alpaca_output"))
                );
                sb.append(objectMapper.writeValueAsString(alpaca)).append("\n");
            }
            return sb.toString();

        } catch (Exception e) {
            log.error("[TrainingDataset] Error sample export failed: {}", e.getMessage());
            throw new RuntimeException("Export failed: " + e.getMessage(), e);
        }
    }

    /**
     * Thống kê tổng quan dataset.
     */
    public Map<String, Object> getStats() {
        try {
            return jdbcTemplate.queryForMap("""
                SELECT
                    (SELECT COUNT(*) FROM training_conversations)                              AS total_conversations,
                    (SELECT COUNT(*) FROM training_conversations WHERE include_in_dataset)     AS included_conversations,
                    (SELECT COUNT(*) FROM training_conversations WHERE has_errors)             AS conversations_with_errors,
                    (SELECT COUNT(*) FROM training_error_samples)                             AS total_error_samples,
                    (SELECT COUNT(*) FROM training_error_samples WHERE include_in_dataset)    AS included_error_samples,
                    (SELECT COUNT(DISTINCT user_id) FROM training_conversations)              AS unique_users,
                    (SELECT AVG(quality_score) FROM training_conversations WHERE include_in_dataset) AS avg_quality_score
                """);
        } catch (Exception e) {
            log.error("[TrainingDataset] Stats query failed: {}", e.getMessage());
            return Map.of("error", e.getMessage());
        }
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private void recordErrorSample(
            Long convId, Long sessionId, Long userId, String cefrLevel,
            String userMessage, String correction, ErrorItem err
    ) {
        try {
            String alpacaInstruction = "Du bist ein Deutschlehrer. Korrigiere den folgenden fehlerhaften deutschen Satz und erkläre den Fehler auf Vietnamesisch.";
            String alpacaInput = "Fehlerhafter Satz: " + (err.wrongSpan() != null ? err.wrongSpan() : userMessage);
            String alpacaOutput = buildCorrectionOutput(err, correction);

            jdbcTemplate.update("""
                    INSERT INTO training_error_samples
                        (training_conv_id, session_id, user_id, cefr_level,
                         error_type, error_original, error_corrected, error_explanation, error_severity,
                         context_user_msg, context_correction,
                         alpaca_instruction, alpaca_input, alpaca_output,
                         created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    convId, sessionId, userId, cefrLevel,
                    err.errorCode(),
                    err.wrongSpan() != null ? err.wrongSpan() : userMessage,
                    err.correctedSpan() != null ? err.correctedSpan() : "",
                    err.ruleViShort(),
                    err.severity() != null ? err.severity() : "MEDIUM",
                    userMessage, correction,
                    alpacaInstruction, alpacaInput, alpacaOutput,
                    Timestamp.from(Instant.now())
            );
        } catch (Exception e) {
            log.warn("[TrainingDataset] Failed to record error sample: {}", e.getMessage());
        }
    }

    private double calculateQualityScore(String userMessage, AiResponseDto ai, int errorCount) {
        double score = 100.0;

        // Phạt theo số lỗi
        score -= errorCount * 15.0;

        // Phạt nếu AI response quá ngắn (có thể là hallucination)
        if (ai.aiSpeechDe() == null || ai.aiSpeechDe().length() < 10) {
            score -= 30;
        }

        // Phạt nếu user message quá ngắn (câu quá đơn giản, ít giá trị)
        if (userMessage == null || userMessage.split("\\s+").length < 3) {
            score -= 10;
        }

        // Thưởng nếu có correction chi tiết (dữ liệu phong phú hơn)
        if (ai.correction() != null && !ai.correction().isBlank()) {
            score += 5;
        }
        if (ai.explanationVi() != null && !ai.explanationVi().isBlank()) {
            score += 5;
        }

        return Math.max(0, Math.min(100, score));
    }

    private String buildCorrectionOutput(ErrorItem err, String generalCorrection) {
        StringBuilder sb = new StringBuilder();
        if (err.correctedSpan() != null && !err.correctedSpan().isBlank()) {
            sb.append("Korrektur: ").append(err.correctedSpan());
        } else if (generalCorrection != null && !generalCorrection.isBlank()) {
            sb.append("Korrektur: ").append(generalCorrection);
        }
        if (err.ruleViShort() != null && !err.ruleViShort().isBlank()) {
            sb.append("\nErklärung: ").append(err.ruleViShort());
        }
        if (err.errorCode() != null && !err.errorCode().isBlank()) {
            sb.append("\nFehlertyp: ").append(err.errorCode());
        }
        return sb.toString().trim();
    }

    private String trimInstruction(String systemPrompt) {
        if (systemPrompt == null) return "";
        // Cắt bớt system prompt nếu quá dài (tránh bloat dataset)
        return systemPrompt.length() > 1000 ? systemPrompt.substring(0, 1000) + "..." : systemPrompt;
    }

    private String nullToEmpty(Object val) {
        return val == null ? "" : String.valueOf(val);
    }
}
