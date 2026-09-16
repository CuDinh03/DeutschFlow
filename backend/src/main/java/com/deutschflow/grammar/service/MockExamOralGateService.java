package com.deutschflow.grammar.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Cổng Nói của đề telc: đề giấy telc KHÔNG có phần Nói, điểm 75 lấy từ một phiên của module luyện
 * thi nói ({@code speaking_exam_results}).
 *
 * <p><b>Vì sao đọc bảng của module khác bằng SQL thẳng.</b> Dùng repository JPA của
 * {@code examspeaking} sẽ khiến {@code grammar} phụ thuộc vào module đó, trong khi chiều ngược lại
 * cũng cần ({@code ExamGradingJobHandler} gọi {@link #reconcileAttempts}) — thành phụ thuộc vòng.
 * Đọc bằng {@code JdbcTemplate} giữ một chiều duy nhất: examspeaking → grammar.
 *
 * <p><b>Lấy phiên nào.</b> Phiên có ĐIỂM CAO NHẤT cùng nhà tổ chức và cùng bậc. Đây là bài luyện,
 * không phải một buổi thi thật nên không có ràng buộc "cùng buổi"; lấy điểm cao nhất là có lợi cho
 * người học và trùng cách {@code CertificateController} chọn lần thi tốt nhất. Đổi lại, kết quả
 * PHẢI nói rõ điểm đó lấy từ lần thi ngày nào ({@code Gate.achievedAt}).
 */
@Service
public class MockExamOralGateService {

    private static final org.slf4j.Logger log =
            org.slf4j.LoggerFactory.getLogger(MockExamOralGateService.class);

    /** Kiểu nguồn duy nhất hiện có cho một cổng lấy điểm ngoài đề giấy. */
    public static final String SOURCE_SPEAKING_SESSION = "SPEAKING_SESSION";

    private final JdbcTemplate jdbcTemplate;
    private final ExamScoringService scoringService;
    private final ObjectMapper objectMapper;

    public MockExamOralGateService(JdbcTemplate jdbcTemplate, ExamScoringService scoringService,
                                   ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.scoringService = scoringService;
        this.objectMapper = objectMapper;
    }

    /**
     * Điểm ngoài đề giấy cho các cổng của một {@code pass_rule}. Cổng nào không khai
     * {@code source} thì không có mặt ở đây (nó cộng từ chính đề giấy).
     */
    @Transactional(readOnly = true)
    public Map<String, ExamScoringService.ExternalScore> externalScores(
            long userId, Map<String, Object> passRule, String cefrLevel) {
        if (passRule == null || passRule.isEmpty()) return Map.of();
        Map<String, ExamScoringService.ExternalScore> out = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : passRule.entrySet()) {
            if (!(entry.getValue() instanceof Map<?, ?> rawSpec)) continue;
            Map<?, ?> spec = rawSpec;
            if (!SOURCE_SPEAKING_SESSION.equals(String.valueOf(spec.get("source")))) continue;
            String provider = spec.get("provider") instanceof String p ? p : "TELC";
            String level = spec.get("level") instanceof String l ? l : cefrLevel;
            bestSpeakingResult(userId, provider, level).ifPresent(score -> out.put(entry.getKey(), score));
        }
        return out;
    }

    /** Phiên thi nói điểm cao nhất của học viên ở đúng nhà tổ chức và bậc này. */
    @Transactional(readOnly = true)
    public Optional<ExamScoringService.ExternalScore> bestSpeakingResult(long userId, String provider, String level) {
        if (level == null || level.isBlank()) return Optional.empty();
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
            SELECT session_id, total_points, created_at
            FROM speaking_exam_results
            WHERE user_id = ? AND provider = ? AND level = ? AND total_points IS NOT NULL
            ORDER BY total_points DESC, created_at DESC
            LIMIT 1
            """, userId, provider, level);
        if (rows.isEmpty()) return Optional.empty();
        Map<String, Object> row = rows.get(0);
        double raw = row.get("total_points") instanceof Number n ? n.doubleValue() : 0;
        Long sessionId = row.get("session_id") instanceof Number n ? n.longValue() : null;
        Instant at = row.get("created_at") instanceof Timestamp ts ? ts.toInstant() : null;
        return Optional.of(new ExamScoringService.ExternalScore(raw, sessionId, at));
    }

    /**
     * Tính lại kết luận đỗ/trượt cho các bài thi thử đã nộp của học viên này, sau khi một phiên thi
     * nói vừa có kết quả.
     *
     * <p>Không có bước này thì một người thi viết trước, thi nói sau sẽ thấy hai con số khác nhau ở
     * hai màn: màn kết quả tính lại tại chỗ nên nói ĐỖ, còn lịch sử và đường xin chứng nhận vẫn đọc
     * cột {@code passed} đóng băng từ lúc nộp bài.
     *
     * @return số bài đã đổi kết luận
     */
    @Transactional
    public int reconcileAttempts(long userId, String provider, String level) {
        if (provider == null || level == null) return 0;
        List<Map<String, Object>> attempts = jdbcTemplate.queryForList("""
            SELECT a.id, a.passed, a.detailed_scores_json::text AS detailed,
                   e.sections_json::text AS sections, e.total_points, e.pass_points
            FROM mock_exam_attempts a
            JOIN mock_exams e ON e.id = a.exam_id
            WHERE a.user_id = ? AND a.status = 'COMPLETED'
              AND e.exam_format = ? AND e.cefr_level = ?
            """, userId, provider, level);

        int changed = 0;
        for (Map<String, Object> attempt : attempts) {
            Boolean before = attempt.get("passed") instanceof Boolean b ? b : null;
            Boolean after = recomputePassed(userId, attempt, level);
            if (after == null || after.equals(before)) continue;
            jdbcTemplate.update("UPDATE mock_exam_attempts SET passed = ? WHERE id = ?",
                    after, ((Number) attempt.get("id")).longValue());
            changed++;
            log.info("[MockExam] Bài {} đổi kết luận {} → {} sau khi có điểm thi nói {} {}",
                    attempt.get("id"), before, after, provider, level);
        }
        return changed;
    }

    /** {@code null} khi bài này không phải đề nhiều ngưỡng (không có gì để tính lại). */
    @SuppressWarnings("unchecked")
    private Boolean recomputePassed(long userId, Map<String, Object> attempt, String level) {
        try {
            Map<String, Object> structure = objectMapper.readValue((String) attempt.get("sections"), Map.class);
            if (!(structure.get("pass_rule") instanceof Map<?, ?> rawRule)) return null;
            Map<String, Object> passRule = (Map<String, Object>) rawRule;

            Object detailedRaw = attempt.get("detailed");
            Map<String, Object> detailed = detailedRaw == null
                    ? new HashMap<>()
                    : objectMapper.readValue((String) detailedRaw, Map.class);

            Integer passPoints = attempt.get("pass_points") instanceof Number n ? n.intValue() : null;
            Integer totalPoints = attempt.get("total_points") instanceof Number n ? n.intValue() : null;
            return scoringService.summarize(detailed,
                    ExamScoringService.passPercent(passPoints, totalPoints),
                    passRule,
                    externalScores(userId, passRule, level)).passed();
        } catch (Exception e) {
            log.warn("[MockExam] Không tính lại được kết luận cho bài {}: {}", attempt.get("id"), e.getMessage());
            return null;
        }
    }
}
