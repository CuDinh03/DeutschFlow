package com.deutschflow.grammar.service;

import com.deutschflow.grammar.dto.ExamCoverageDto;
import org.springframework.jdbc.core.JdbcOperations;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.Locale;

/**
 * Selects exam variants for users using a least-recently-attempted strategy.
 * Ensures users cycle through all available exams before repeating one.
 *
 * <p>Tách kỳ thi (09/11/2026): mọi truy vấn chọn đề đều lọc theo {@code mock_exams.exam_format}
 * (GOETHE / TELC). Trước đó chỉ lọc theo cấp nên ở B1 học viên luyện telc được gợi ý đề Goethe và
 * ngược lại. Kỳ thi được chốt bằng {@link #resolveExamFormat}: không bao giờ trả "mọi kỳ thi".
 */
@Service
public class ExamGenerationService {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(ExamGenerationService.class);

    private final JdbcOperations jdbc;

    public ExamGenerationService(JdbcOperations jdbc) {
        this.jdbc = jdbc;
    }

    /** Kỳ thi có đề viết trong {@code mock_exams}. */
    public static final String GOETHE = "GOETHE";
    public static final String TELC = "TELC";

    /**
     * Chuẩn hoá tên kỳ thi từ tham số client hay hồ sơ học viên ("telc", "Goethe-Zertifikat"…).
     * Kỳ thi không có đề viết (ÖSD…) hoặc trống ⇒ rỗng.
     */
    public static Optional<String> normalizeFormat(String raw) {
        if (raw == null || raw.isBlank()) return Optional.empty();
        String u = raw.trim().toUpperCase(Locale.ROOT);
        if (u.contains(TELC)) return Optional.of(TELC);
        if (u.contains(GOETHE)) return Optional.of(GOETHE);
        return Optional.empty();
    }

    /**
     * Chốt MỘT kỳ thi để chọn đề, theo thứ tự: tham số client → kỳ thi trong hồ sơ học viên →
     * kỳ thi của lượt làm gần nhất ở cấp này → TELC nếu cấp này có đề telc, không thì GOETHE.
     * Luôn trả một giá trị để đề hai kỳ thi không bao giờ trộn trong cùng một danh sách.
     */
    public String resolveExamFormat(long userId, String cefrLevel, String requested) {
        Optional<String> fromRequest = normalizeFormat(requested);
        if (fromRequest.isPresent()) return fromRequest.get();

        List<String> profile = jdbc.queryForList(
                "SELECT exam_type FROM user_learning_profiles WHERE user_id = ?", String.class, userId);
        Optional<String> fromProfile = profile.isEmpty() ? Optional.empty() : normalizeFormat(profile.get(0));
        if (fromProfile.isPresent()) return fromProfile.get();

        List<String> recent = jdbc.queryForList("""
            SELECT e.exam_format
            FROM mock_exam_attempts a
            JOIN mock_exams e ON e.id = a.exam_id
            WHERE a.user_id = ? AND e.cefr_level = ? AND a.status <> 'CANCELLED'
            ORDER BY a.started_at DESC
            LIMIT 1
            """, String.class, userId, cefrLevel);
        Optional<String> fromHistory = recent.isEmpty() ? Optional.empty() : normalizeFormat(recent.get(0));
        if (fromHistory.isPresent()) return fromHistory.get();

        Integer telcCount = jdbc.queryForObject("""
            SELECT COUNT(*) FROM mock_exams
            WHERE cefr_level = ? AND UPPER(exam_format) = 'TELC' AND is_active = TRUE
            """, Integer.class, cefrLevel);
        return telcCount != null && telcCount > 0 ? TELC : GOETHE;
    }

    /**
     * Returns the most suitable exam for a user — the one they have attempted
     * least recently (or never) among active exams for the given CEFR level AND exam format.
     */
    public Optional<Long> recommendExamId(long userId, String cefrLevel, String examFormat) {
        // Get all active exams for this level+format, ordered by when the user last attempted them
        // (nulls first = never attempted = highest priority)
        var rows = jdbc.queryForList("""
            SELECT e.id,
                   MAX(a.started_at) AS last_attempt
            FROM mock_exams e
            LEFT JOIN mock_exam_attempts a
                   ON a.exam_id = e.id AND a.user_id = ? AND a.status <> 'CANCELLED'
            WHERE e.cefr_level = ? AND UPPER(e.exam_format) = ? AND e.is_active = TRUE
            GROUP BY e.id
            ORDER BY last_attempt ASC NULLS FIRST, e.id ASC
            """, userId, cefrLevel, examFormat);

        if (rows.isEmpty()) return Optional.empty();

        long examId = ((Number) rows.get(0).get("id")).longValue();
        log.debug("Recommended exam {} for user {} (level={}, format={})", examId, userId, cefrLevel, examFormat);
        return Optional.of(examId);
    }

    /**
     * Returns summary stats for a user: how many exams they've completed per variant.
     */
    public List<Map<String, Object>> getUserExamStats(long userId, String cefrLevel, String examFormat) {
        return jdbc.queryForList("""
            SELECT e.id AS exam_id,
                   e.title,
                   COUNT(a.id)                                     AS total_attempts,
                   COUNT(a.id) FILTER (WHERE a.status = 'COMPLETED') AS completed_attempts,
                   MAX(a.total_score)                              AS best_score,
                   MAX(a.started_at)                               AS last_attempted_at
            FROM mock_exams e
            LEFT JOIN mock_exam_attempts a ON a.exam_id = e.id AND a.user_id = ? AND a.status <> 'CANCELLED'
            WHERE e.cefr_level = ? AND UPPER(e.exam_format) = ? AND e.is_active = TRUE
            GROUP BY e.id, e.title
            ORDER BY e.id
            """, userId, cefrLevel, examFormat);
    }

    /**
     * Returns a difficulty-balanced question selection for analytics.
     * topic_tag column is used when question_metadata is populated.
     * {@code examFormat} rỗng ⇒ mọi kỳ thi (màn thống kê), có ⇒ chỉ kỳ thi đó.
     */
    public ExamCoverageDto getExamCoverage(String cefrLevel, String examFormat) {
        Optional<String> format = normalizeFormat(examFormat);
        String sql = """
            SELECT id, title, is_active, exam_format,
                   (SELECT COUNT(*) FROM mock_exam_attempts WHERE exam_id = e.id AND status <> 'CANCELLED') AS attempt_count
            FROM mock_exams e
            WHERE cefr_level = ?
            """ + (format.isPresent() ? "  AND UPPER(exam_format) = ?\n" : "") + "ORDER BY id";
        var exams = format.isPresent()
                ? jdbc.queryForList(sql, cefrLevel, format.get())
                : jdbc.queryForList(sql, cefrLevel);

        List<ExamCoverageDto.Exam> rows = exams.stream()
            .map(m -> new ExamCoverageDto.Exam(
                ((Number) m.get("id")).longValue(),
                (String) m.get("title"),
                (String) m.get("exam_format"),
                (Boolean) m.get("is_active"),
                m.get("attempt_count") != null ? ((Number) m.get("attempt_count")).longValue() : null))
            .toList();

        return new ExamCoverageDto(cefrLevel, format.orElse(null), rows.size(), rows);
    }
}
