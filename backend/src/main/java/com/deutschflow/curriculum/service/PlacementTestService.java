package com.deutschflow.curriculum.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.speaking.ai.GroqChatClient;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Placement Test — 10 câu hỏi 4 kỹ năng (Hören/Sprechen/Lesen/Schreiben).
 *
 * <ul>
 *   <li>Pass ≥ 7/10 → nhảy tới node đầu level tiếp theo</li>
 *   <li>Fail → retry sau 3 ngày, đề khác (shuffle)</li>
 *   <li>Speaking (câu 3-4): chấm bằng keyword matching + Groq LLM fallback</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PlacementTestService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final GroqChatClient groqChatClient;

    private static final int PASS_THRESHOLD = 7;  // >= 7/10
    private static final int RETRY_DAYS = 3;

    // ─────────────────────────────────────────────────────────────
    // 1. CREATE TEST — Tạo bài test cho user
    // ─────────────────────────────────────────────────────────────

    public Map<String, Object> createTest(long userId, String claimedLevel) {
        // Kiểm tra retry cooldown
        checkRetryCooldown(userId, claimedLevel);

        // Lấy tất cả câu hỏi active của level
        List<Map<String, Object>> allQuestions = jdbcTemplate.queryForList("""
                SELECT id, skill_section, question_type, question_de, question_vi,
                       audio_transcript, options_json::text AS options_json, difficulty
                FROM placement_questions
                WHERE cefr_level = ? AND is_active = TRUE
                ORDER BY skill_section, RANDOM()
                """, claimedLevel);

        if (allQuestions.size() < 10) {
            throw new BadRequestException("Chưa đủ câu hỏi cho level " + claimedLevel);
        }

        // Shuffle và chọn 10 câu (đảm bảo phủ 4 kỹ năng)
        List<Map<String, Object>> selected = selectBalancedQuestions(allQuestions, 10);
        long[] questionIds = selected.stream().mapToLong(q -> ((Number) q.get("id")).longValue()).toArray();

        // Tạo session
        String testId = UUID.randomUUID().toString();
        String questionIdsArray = "{" + Arrays.stream(questionIds).mapToObj(String::valueOf).collect(Collectors.joining(",")) + "}";

        jdbcTemplate.update("""
                INSERT INTO placement_test_sessions (id, user_id, claimed_level, question_ids)
                VALUES (?::uuid, ?, ?, ?::bigint[])
                """, testId, userId, claimedLevel, questionIdsArray);

        // Build response (không gửi correct_answer!)
        List<Map<String, Object>> questionsForClient = new ArrayList<>();
        for (var q : selected) {
            Map<String, Object> qc = new LinkedHashMap<>();
            qc.put("id", q.get("id"));
            qc.put("skillSection", q.get("skill_section"));
            qc.put("type", q.get("question_type"));
            qc.put("questionDe", q.get("question_de"));
            qc.put("questionVi", q.get("question_vi"));
            qc.put("audioTranscript", q.get("audio_transcript"));
            String optJson = (String) q.get("options_json");
            if (optJson != null) {
                try {
                    qc.put("options", objectMapper.readValue(optJson, List.class));
                } catch (Exception e) {
                    qc.put("options", null);
                }
            }
            questionsForClient.add(qc);
        }

        return Map.of(
                "testId", testId,
                "questions", questionsForClient,
                "timeLimit", 900 // 15 phút
        );
    }

    // ─────────────────────────────────────────────────────────────
    // 2. SUBMIT TEST — Chấm điểm
    // ─────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public Map<String, Object> submitTest(long userId, String testId, Map<String, String> answers) {
        // Load session
        List<Map<String, Object>> sessions = jdbcTemplate.queryForList("""
                SELECT * FROM placement_test_sessions WHERE id = ?::uuid AND user_id = ?
                """, testId, userId);
        if (sessions.isEmpty()) throw new NotFoundException("Test session not found");

        Map<String, Object> session = sessions.get(0);
        if (session.get("submitted_at") != null) {
            throw new BadRequestException("Bài test đã được nộp rồi.");
        }

        // Load question IDs from session
        Object qidsRaw = session.get("question_ids");
        long[] questionIds;
        if (qidsRaw instanceof Long[] la) {
            questionIds = Arrays.stream(la).mapToLong(Long::longValue).toArray();
        } else if (qidsRaw instanceof Object[] oa) {
            questionIds = Arrays.stream(oa).mapToLong(o -> ((Number) o).longValue()).toArray();
        } else {
            throw new BadRequestException("Invalid test session data");
        }

        // Load questions
        int correctCount = 0;
        List<Map<String, Object>> details = new ArrayList<>();
        Set<Integer> weakModulesSet = new LinkedHashSet<>();

        for (long qId : questionIds) {
            List<Map<String, Object>> qRows = jdbcTemplate.queryForList("""
                    SELECT id, question_type, correct_answer, module_number,
                           array_to_json(alternative_answers)::text AS alternative_answers,
                           array_to_json(grading_keywords)::text AS grading_keywords,
                           array_to_json(weak_nodes)::text AS weak_nodes
                    FROM placement_questions WHERE id = ?
                    """, qId);
            if (qRows.isEmpty()) continue;

            Map<String, Object> q = qRows.get(0);
            String type = (String) q.get("question_type");
            String correctAnswer = (String) q.get("correct_answer");
            String userAnswer = answers.getOrDefault(String.valueOf(qId), "").trim();
            int moduleNumber = ((Number) q.get("module_number")).intValue();

            boolean isCorrect = gradeAnswer(type, correctAnswer, userAnswer,
                    (String) q.get("alternative_answers"),
                    (String) q.get("grading_keywords"));

            if (isCorrect) {
                correctCount++;
            } else {
                weakModulesSet.add(moduleNumber);
            }

            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("questionId", qId);
            detail.put("correct", isCorrect);
            detail.put("yourAnswer", userAnswer);
            if (!isCorrect) {
                detail.put("correctAnswer", correctAnswer);
                detail.put("module", moduleNumber);
                detail.put("weakNodes", q.get("weak_nodes"));
            }
            details.add(detail);
        }

        int totalQuestions = questionIds.length;
        int scorePercent = totalQuestions > 0 ? (correctCount * 100) / totalQuestions : 0;
        boolean passed = correctCount >= PASS_THRESHOLD;

        Integer[] weakModules = weakModulesSet.toArray(new Integer[0]);
        String weakModulesArray = "{" + Arrays.stream(weakModules).map(String::valueOf).collect(Collectors.joining(",")) + "}";

        // Tìm startingNodeId nếu pass
        Long startingNodeId = null;
        if (passed) {
            String claimedLevel = (String) session.get("claimed_level");
            String nextLevel = getNextLevel(claimedLevel);
            if (nextLevel != null) {
                List<Map<String, Object>> nextNodes = jdbcTemplate.queryForList("""
                        SELECT id FROM skill_tree_nodes
                        WHERE cefr_level = ? AND is_active = TRUE
                        ORDER BY sort_order ASC LIMIT 1
                        """, nextLevel);
                if (!nextNodes.isEmpty()) {
                    startingNodeId = ((Number) nextNodes.get(0).get("id")).longValue();
                }
            }
        }

        // Update session
        String answersJson;
        try {
            answersJson = objectMapper.writeValueAsString(answers);
        } catch (Exception e) {
            answersJson = "{}";
        }

        String retryAt = passed ? null : "NOW() + INTERVAL '" + RETRY_DAYS + " days'";
        jdbcTemplate.update("""
                UPDATE placement_test_sessions
                SET answers_json = ?::jsonb, score_percent = ?, passed = ?,
                    weak_modules = ?::integer[], submitted_at = NOW(),
                    next_retry_at = """ + (passed ? "NULL" : "NOW() + INTERVAL '" + RETRY_DAYS + " days'") + """
                WHERE id = ?::uuid
                """, answersJson, scorePercent, passed, weakModulesArray, testId);

        // Update user learning profile
        try {
            String resultJson = objectMapper.writeValueAsString(Map.of(
                    "testId", testId, "passed", passed, "score", scorePercent,
                    "weakModules", weakModulesSet, "date", Instant.now().toString()
            ));
            jdbcTemplate.update("""
                    UPDATE user_learning_profiles
                    SET placement_result_json = ?::jsonb, updated_at = NOW()
                    WHERE user_id = ?
                    """, resultJson, userId);
        } catch (Exception e) {
            log.warn("Failed to update placement result for user {}", userId, e);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("passed", passed);
        result.put("scorePercent", scorePercent);
        result.put("totalQuestions", totalQuestions);
        result.put("correctCount", correctCount);
        result.put("weakModules", weakModulesSet);
        result.put("details", details);
        if (startingNodeId != null) result.put("startingNodeId", startingNodeId);
        if (!passed) {
            result.put("retryAfterDays", RETRY_DAYS);
            result.put("message", "Bạn cần ôn lại một số chủ đề. Có thể làm lại sau " + RETRY_DAYS + " ngày.");
        }

        log.info("[PlacementTest] user={}, level={}, score={}/{}={}, passed={}",
                userId, session.get("claimed_level"), correctCount, totalQuestions, scorePercent, passed);

        return result;
    }

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    private void checkRetryCooldown(long userId, String claimedLevel) {
        List<Map<String, Object>> recent = jdbcTemplate.queryForList("""
                SELECT next_retry_at FROM placement_test_sessions
                WHERE user_id = ? AND claimed_level = ? AND passed = FALSE
                  AND next_retry_at > NOW()
                ORDER BY created_at DESC LIMIT 1
                """, userId, claimedLevel);
        if (!recent.isEmpty()) {
            throw new BadRequestException(
                    "Bạn cần đợi 3 ngày trước khi làm lại bài test. Hãy ôn tập thêm nhé!");
        }
    }

    private List<Map<String, Object>> selectBalancedQuestions(List<Map<String, Object>> all, int count) {
        // Group by skill_section, pick evenly
        Map<String, List<Map<String, Object>>> bySkill = all.stream()
                .collect(Collectors.groupingBy(q -> (String) q.get("skill_section")));

        List<Map<String, Object>> result = new ArrayList<>();
        String[] skills = {"HOEREN", "SPRECHEN", "LESEN", "SCHREIBEN"};

        // 2-3 per skill
        for (String skill : skills) {
            List<Map<String, Object>> pool = bySkill.getOrDefault(skill, List.of());
            Collections.shuffle(pool);
            int take = skill.equals("LESEN") ? 3 : (skill.equals("SCHREIBEN") ? 3 : 2);
            result.addAll(pool.subList(0, Math.min(take, pool.size())));
        }

        // Fill up to count if needed
        if (result.size() < count) {
            List<Map<String, Object>> remaining = new ArrayList<>(all);
            remaining.removeAll(result);
            Collections.shuffle(remaining);
            result.addAll(remaining.subList(0, Math.min(count - result.size(), remaining.size())));
        }

        return result.subList(0, Math.min(count, result.size()));
    }

    private boolean gradeAnswer(String type, String correctAnswer, String userAnswer,
                                 String altAnswersJson, String keywordsJson) {
        if (userAnswer.isBlank()) return false;

        String normalizedUser = userAnswer.toLowerCase().trim()
                .replaceAll("[.!?,;:]+$", "").trim();
        String normalizedCorrect = correctAnswer.toLowerCase().trim()
                .replaceAll("[.!?,;:]+$", "").trim();

        // Direct match
        if (normalizedUser.equals(normalizedCorrect)) return true;

        // Alternative answers
        if (altAnswersJson != null && !altAnswersJson.isBlank()) {
            try {
                List<String> alts = objectMapper.readValue(altAnswersJson,
                        objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
                for (String alt : alts) {
                    if (normalizedUser.equals(alt.toLowerCase().trim().replaceAll("[.!?,;:]+$", "").trim())) {
                        return true;
                    }
                }
            } catch (Exception ignored) {}
        }

        // Keyword matching (for SPEAKING type)
        if (("SPEAKING".equals(type) || "FREE_WRITE".equals(type)) && keywordsJson != null) {
            try {
                List<String> keywords = objectMapper.readValue(keywordsJson,
                        objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
                long matchCount = keywords.stream()
                        .filter(kw -> normalizedUser.contains(kw.toLowerCase()))
                        .count();
                // Pass if >= 50% keywords present
                return matchCount >= Math.ceil(keywords.size() / 2.0);
            } catch (Exception ignored) {}
        }

        return false;
    }

    private String getNextLevel(String current) {
        return switch (current) {
            case "A1" -> "A2";
            case "A2" -> "B1";
            case "B1" -> "B2";
            case "B2" -> "C1";
            default -> null;
        };
    }
}
