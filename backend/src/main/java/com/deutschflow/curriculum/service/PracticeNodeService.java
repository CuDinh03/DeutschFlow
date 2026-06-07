package com.deutschflow.curriculum.service;

import com.deutschflow.common.async.AsyncJob;
import com.deutschflow.common.async.AsyncJobService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.gamification.service.XpService;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.GroqChatClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service for Practice Node system — 4 kỹ năng (Hören/Sprechen/Lesen/Schreiben).
 * <p>
 * Khi user hoàn thành Theory Node, hệ thống sinh đồng thời 4 Practice Node.
 * Mỗi node chứa 6 bài tập AI-generated, không lặp lại, tăng dần level.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PracticeNodeService {

    private final JdbcTemplate jdbcTemplate;
    private final GroqChatClient groqChatClient;
    private final AiUsageLedgerService aiUsageLedgerService;
    private final ObjectMapper objectMapper;
    private final AsyncJobService asyncJobService;
    private final XpService xpService;
    private final com.deutschflow.srs.service.SrsVocabScheduler srsVocabScheduler;

    private static final int XP_PER_SESSION = 30;
    private static final List<String> ALL_SKILLS = List.of("HOEREN", "SPRECHEN", "LESEN", "SCHREIBEN");

    // Prevent duplicate concurrent generations
    private final ConcurrentHashMap<String, Boolean> generationLocks = new ConcurrentHashMap<>();

    // ─────────────────────────────────────────────────────────────
    // 1. TRIGGER — Sinh đồng thời 4 Practice Node sau khi hoàn thành Theory
    // ─────────────────────────────────────────────────────────────

    public void triggerAllPracticeNodes(long userId, long sourceNodeId) {
        for (String skill : ALL_SKILLS) {
            CompletableFuture.runAsync(() -> {
                try {
                    generatePracticeSession(userId, sourceNodeId, skill, 1);
                } catch (Exception e) {
                    log.error("[PracticeNode] Failed to generate {} for node={}, user={}: {}",
                            skill, sourceNodeId, userId, e.getMessage());
                }
            });
        }
        log.info("[PracticeNode] Triggered 4 practice nodes for user={}, node={}", userId, sourceNodeId);
    }

    // ─────────────────────────────────────────────────────────────
    // 2. GENERATE — Sinh 1 practice session cho 1 kỹ năng
    // ─────────────────────────────────────────────────────────────

    public Map<String, Object> generatePracticeSession(long userId, long sourceNodeId, String skillType, int generation) {
        validateSkillType(skillType);

        String lockKey = userId + ":" + sourceNodeId + ":" + skillType + ":" + generation;
        if (generationLocks.putIfAbsent(lockKey, true) != null) {
            log.debug("[PracticeNode] Generation already in progress: {}", lockKey);
            return Map.of("status", "ALREADY_GENERATING");
        }

        try {
            // Load source node content
            Map<String, Object> node = loadSourceNode(sourceNodeId);
            String lessonTitle = (String) node.get("title_de");
            String cefrLevel = (String) node.get("cefr_level");

            // Extract vocabulary & grammar from content_json
            List<String> vocabularyWords = extractVocabulary(node);
            String grammarFocus = extractGrammarFocus(node);

            // Get seen question summaries for anti-repetition
            List<String> seenSummaries = getSeenQuestionSummaries(userId, sourceNodeId, skillType);

            // Build prompt
            String prompt = PracticeNodePromptBuilder.buildPromptForSkill(
                    skillType, lessonTitle, cefrLevel,
                    vocabularyWords, grammarFocus,
                    seenSummaries, generation
            );

            // Call LLM
            List<ChatMessage> messages = List.of(
                    new ChatMessage("system", prompt),
                    new ChatMessage("user", "Erstelle die Übungen jetzt als JSON.")
            );

            AiChatCompletionResult result = groqChatClient.chatCompletion(messages, null, 0.4, 4096);
            String rawJson = cleanJsonResponse(result.content());

            // Validate JSON
            JsonNode parsed = objectMapper.readTree(rawJson);
            String cleanJson = objectMapper.writeValueAsString(parsed);

            // Compute hashes for each exercise
            List<String> hashes = computeExerciseHashes(parsed, skillType);

            // Check for duplicates against seen hashes
            List<String> existingHashes = getSeenHashes(userId, sourceNodeId, skillType);
            long duplicateCount = hashes.stream().filter(existingHashes::contains).count();
            if (duplicateCount > hashes.size() / 2) {
                log.warn("[PracticeNode] Too many duplicates ({}/{}), retrying...", duplicateCount, hashes.size());
                // Retry once with stronger anti-repetition hint
                seenSummaries.add("⚠️ WARNUNG: Die vorherige Generation hatte zu viele Duplikate. Sei KOMPLETT anders!");
                String retryPrompt = PracticeNodePromptBuilder.buildPromptForSkill(
                        skillType, lessonTitle, cefrLevel,
                        vocabularyWords, grammarFocus,
                        seenSummaries, generation
                );
                messages = List.of(
                        new ChatMessage("system", retryPrompt),
                        new ChatMessage("user", "Erstelle die Übungen jetzt als JSON. KOMPLETT ANDERE als vorher!")
                );
                result = groqChatClient.chatCompletion(messages, null, 0.6, 4096);
                rawJson = cleanJsonResponse(result.content());
                parsed = objectMapper.readTree(rawJson);
                cleanJson = objectMapper.writeValueAsString(parsed);
                hashes = computeExerciseHashes(parsed, skillType);
            }

            // Save to DB
            String hashesArray = "{" + String.join(",", hashes.stream().map(h -> "\"" + h + "\"").toList()) + "}";

            Long sessionId = jdbcTemplate.queryForObject("""
                    INSERT INTO practice_node_sessions 
                        (user_id, source_node_id, skill_type, generation, exercises_json, question_hashes, status)
                    VALUES (?, ?, ?, ?, ?::jsonb, ?::text[], 'ACTIVE')
                    RETURNING id
                    """, Long.class,
                    userId, sourceNodeId, skillType, generation, cleanJson, hashesArray);

            // Save hashes to seen log
            for (String hash : hashes) {
                jdbcTemplate.update("""
                        INSERT INTO user_seen_exercise_hashes (user_id, source_node_id, skill_type, question_hash)
                        VALUES (?, ?, ?, ?)
                        ON CONFLICT DO NOTHING
                        """, userId, sourceNodeId, skillType, hash);
            }

            // Record token usage
            if (result.usage() != null) {
                aiUsageLedgerService.record(
                        userId, result.provider(), result.model(),
                        result.usage().promptTokens(), result.usage().completionTokens(),
                        result.usage().totalTokens(), "PRACTICE_NODE_GENERATE", null, null);
            }

            log.info("[PracticeNode] Generated {} Gen-{} for user={}, node={}, sessionId={}",
                    skillType, generation, userId, sourceNodeId, sessionId);

            return Map.of(
                    "sessionId", sessionId,
                    "skillType", skillType,
                    "generation", generation,
                    "exerciseCount", hashes.size(),
                    "status", "ACTIVE"
            );

        } catch (Exception e) {
            log.error("[PracticeNode] Generation failed for {}: {}", lockKey, e.getMessage(), e);
            return Map.of("status", "FAILED", "error", e.getMessage());
        } finally {
            generationLocks.remove(lockKey);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. GET SESSIONS — Lấy danh sách 4 practice sessions cho 1 node
    // ─────────────────────────────────────────────────────────────

    public Map<String, Object> getPracticeSessionsForNode(long userId, long sourceNodeId) {
        // Load source node info
        List<Map<String, Object>> nodeRows = jdbcTemplate.queryForList(
                "SELECT title_de, title_vi, emoji, cefr_level FROM skill_tree_nodes WHERE id = ?", sourceNodeId);
        if (nodeRows.isEmpty()) throw new NotFoundException("Node not found: " + sourceNodeId);
        Map<String, Object> nodeInfo = nodeRows.get(0);

        // Get latest session per skill type
        List<Map<String, Object>> sessions = jdbcTemplate.queryForList("""
                SELECT DISTINCT ON (skill_type)
                    id, skill_type, generation, status, score_percent, 
                    xp_earned, created_at, completed_at,
                    jsonb_array_length(exercises_json) AS exercise_count
                FROM practice_node_sessions
                WHERE user_id = ? AND source_node_id = ?
                ORDER BY skill_type, generation DESC
                """, userId, sourceNodeId);

        // Get total seen count per skill
        List<Map<String, Object>> seenCounts = jdbcTemplate.queryForList("""
                SELECT skill_type, COUNT(*) as seen_count
                FROM user_seen_exercise_hashes
                WHERE user_id = ? AND source_node_id = ?
                GROUP BY skill_type
                """, userId, sourceNodeId);
        Map<String, Long> seenMap = new HashMap<>();
        for (var row : seenCounts) {
            seenMap.put((String) row.get("skill_type"), ((Number) row.get("seen_count")).longValue());
        }

        // Enrich sessions with seen count
        for (var session : sessions) {
            String skill = (String) session.get("skill_type");
            session.put("totalSeenCount", seenMap.getOrDefault(skill, 0L));
        }

        return Map.of(
                "nodeTitle", nodeInfo.get("title_de"),
                "nodeTitleVi", nodeInfo.get("title_vi"),
                "emoji", nodeInfo.get("emoji"),
                "cefrLevel", nodeInfo.get("cefr_level"),
                "sessions", sessions
        );
    }

    // ─────────────────────────────────────────────────────────────
    // 4. GET SESSION DETAIL — Lấy bài tập của 1 session cụ thể
    // ─────────────────────────────────────────────────────────────

    public Map<String, Object> getSessionDetail(long userId, long sessionId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT pns.*, stn.title_de AS source_title, stn.title_vi AS source_title_vi
                FROM practice_node_sessions pns
                JOIN skill_tree_nodes stn ON stn.id = pns.source_node_id
                WHERE pns.id = ? AND pns.user_id = ?
                """, sessionId, userId);
        if (rows.isEmpty()) throw new NotFoundException("Practice session not found: " + sessionId);

        Map<String, Object> session = rows.get(0);

        // Parse exercises_json
        String exercisesStr = session.get("exercises_json").toString();
        Object exercises;
        try {
            exercises = objectMapper.readValue(exercisesStr, Object.class);
        } catch (Exception e) {
            exercises = exercisesStr;
        }

        return Map.of(
                "sessionId", session.get("id"),
                "skillType", session.get("skill_type"),
                "generation", session.get("generation"),
                "status", session.get("status"),
                "scorePercent", session.get("score_percent") != null ? session.get("score_percent") : 0,
                "exercises", exercises,
                "sourceNodeTitle", session.get("source_title"),
                "sourceNodeTitleVi", session.get("source_title_vi")
        );
    }

    // ─────────────────────────────────────────────────────────────
    // 5. GENERATE NEXT — User bấm "Làm thêm" → Gen N+1
    // ─────────────────────────────────────────────────────────────

    public Map<String, Object> generateNextGeneration(long userId, long sourceNodeId, String skillType) {
        validateSkillType(skillType);

        // Find current max generation
        Integer maxGen = jdbcTemplate.queryForObject("""
                SELECT COALESCE(MAX(generation), 0)
                FROM practice_node_sessions
                WHERE user_id = ? AND source_node_id = ? AND skill_type = ?
                """, Integer.class, userId, sourceNodeId, skillType);

        int nextGen = (maxGen != null ? maxGen : 0) + 1;

        // Abandon any active sessions for this skill (can only have 1 active)
        jdbcTemplate.update("""
                UPDATE practice_node_sessions SET status = 'ABANDONED', completed_at = NOW()
                WHERE user_id = ? AND source_node_id = ? AND skill_type = ? AND status = 'ACTIVE'
                """, userId, sourceNodeId, skillType);

        return generatePracticeSession(userId, sourceNodeId, skillType, nextGen);
    }

    // ─────────────────────────────────────────────────────────────
    // 6. SUBMIT — Nộp bài, tính điểm, ghi XP
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> submitPracticeSession(long userId, long sessionId, Map<String, Object> answers) {
        // Load session
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT * FROM practice_node_sessions WHERE id = ? AND user_id = ?
                """, sessionId, userId);
        if (rows.isEmpty()) throw new NotFoundException("Practice session not found");
        Map<String, Object> session = rows.get(0);

        if ("COMPLETED".equals(session.get("status"))) {
            throw new BadRequestException("Session đã hoàn thành rồi.");
        }

        // Server-authoritative grading: re-grade the submitted raw answers against the answer key
        // in exercises_json instead of trusting the client-reported score_percent (the client also
        // sends a per-item `correct` flag, which is ignored). Falls back to the client score only
        // for legacy clients that don't send the answers map.
        @SuppressWarnings("unchecked")
        Map<String, Object> itemAnswers = answers.get("answers") instanceof Map<?, ?> raw
                ? (Map<String, Object>) raw : null;
        String exercisesJson = session.get("exercises_json") != null
                ? session.get("exercises_json").toString() : null;
        PracticeExerciseGrader.Result graded =
                PracticeExerciseGrader.grade(objectMapper, exercisesJson, itemAnswers);

        int scorePercent;
        if (graded.gradeable()) {
            scorePercent = graded.percent();
        } else {
            scorePercent = answers.containsKey("score_percent")
                    ? ((Number) answers.get("score_percent")).intValue()
                    : 0;
            if (itemAnswers == null) {
                log.warn("[PracticeNode] session {} (user {}) submitted without raw answers — trusting "
                        + "client score {}. Client should send the answers map for server grading.",
                        sessionId, userId, scorePercent);
            }
        }

        // XP: 30 per session, only if score >= 60%
        int xpEarned = scorePercent >= 60 ? XP_PER_SESSION : 0;

        // Update session
        jdbcTemplate.update("""
                UPDATE practice_node_sessions
                SET status = 'COMPLETED', score_percent = ?, xp_earned = ?, completed_at = NOW()
                WHERE id = ?
                """, scorePercent, xpEarned, sessionId);

        if (xpEarned > 0) {
            xpService.awardCustomPractice(userId, xpEarned, "Practice: " + session.get("skill_type"));
        }

        String skillType = (String) session.get("skill_type");
        long sourceNodeId = ((Number) session.get("source_node_id")).longValue();

        // Feed the source node's vocabulary into the FSRS queue (best-effort, idempotent).
        if (scorePercent >= 60) {
            try {
                String contentJson = jdbcTemplate.queryForObject(
                        "SELECT content_json::text FROM skill_tree_nodes WHERE id = ?", String.class, sourceNodeId);
                srsVocabScheduler.scheduleFromContentJson(userId, sourceNodeId, contentJson);
            } catch (Exception ignored) { /* best-effort */ }
        }

        // Count total seen for this skill
        Integer totalSeen = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM user_seen_exercise_hashes
                WHERE user_id = ? AND source_node_id = ? AND skill_type = ?
                """, Integer.class, userId, sourceNodeId, skillType);

        return Map.of(
                "sessionId", sessionId,
                "scorePercent", scorePercent,
                "xpEarned", xpEarned,
                "status", "COMPLETED",
                "skillType", skillType,
                "totalSeenCount", totalSeen != null ? totalSeen : 0,
                "canGenerateMore", true
        );
    }

    // ─────────────────────────────────────────────────────────────
    // 7. CHECK AVAILABILITY — Kiểm tra node có Practice Nodes chưa
    // ─────────────────────────────────────────────────────────────

    public boolean hasPracticeSessions(long userId, long sourceNodeId) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM practice_node_sessions
                WHERE user_id = ? AND source_node_id = ?
                """, Integer.class, userId, sourceNodeId);
        return count != null && count > 0;
    }

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    private void validateSkillType(String skillType) {
        if (!ALL_SKILLS.contains(skillType)) {
            throw new BadRequestException("Invalid skill type: " + skillType
                    + ". Must be one of: " + String.join(", ", ALL_SKILLS));
        }
    }

    private Map<String, Object> loadSourceNode(long nodeId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT id, title_de, title_vi, cefr_level, content_json::text AS content_json,
                       to_jsonb(grammar_points)::text AS grammar_points,
                       to_jsonb(tags)::text AS tags
                FROM skill_tree_nodes WHERE id = ? AND is_active = TRUE
                """, nodeId);
        if (rows.isEmpty()) throw new NotFoundException("Source node not found: " + nodeId);
        return rows.get(0);
    }

    @SuppressWarnings("unchecked")
    private List<String> extractVocabulary(Map<String, Object> node) {
        List<String> words = new ArrayList<>();
        String contentStr = (String) node.get("content_json");
        if (contentStr == null || contentStr.isBlank()) return words;

        try {
            var content = objectMapper.readValue(contentStr, Map.class);
            var vocab = (List<Map<String, Object>>) content.get("vocabulary");
            if (vocab != null) {
                for (var v : vocab) {
                    String german = (String) v.get("german");
                    if (german != null) words.add(german);
                }
            }
        } catch (Exception e) {
            log.warn("[PracticeNode] Failed to extract vocabulary: {}", e.getMessage());
        }
        return words;
    }

    @SuppressWarnings("unchecked")
    private String extractGrammarFocus(Map<String, Object> node) {
        String gpStr = (String) node.get("grammar_points");
        if (gpStr != null && !gpStr.isBlank() && !gpStr.equals("null")) {
            return gpStr.replaceAll("[\\[\\]\"\\\\]", "");
        }

        // Fallback: try tags
        String tagsStr = (String) node.get("tags");
        if (tagsStr != null && !tagsStr.isBlank() && !tagsStr.equals("null")) {
            return tagsStr.replaceAll("[\\[\\]\"\\\\#]", "");
        }

        return "Allgemein";
    }

    private List<String> getSeenQuestionSummaries(long userId, long sourceNodeId, String skillType) {
        List<Map<String, Object>> sessions = jdbcTemplate.queryForList("""
                SELECT exercises_json::text AS exercises_json
                FROM practice_node_sessions
                WHERE user_id = ? AND source_node_id = ? AND skill_type = ? AND status = 'COMPLETED'
                ORDER BY generation ASC
                """, userId, sourceNodeId, skillType);

        List<String> summaries = new ArrayList<>();
        for (var session : sessions) {
            String json = (String) session.get("exercises_json");
            try {
                JsonNode exercises = objectMapper.readTree(json);
                if (exercises.isArray()) {
                    for (JsonNode ex : exercises) {
                        String type = ex.has("type") ? ex.get("type").asText() : "UNKNOWN";
                        String question = extractQuestionText(ex);
                        summaries.add(PracticeNodePromptBuilder.summarizeExercise(type, question));
                    }
                } else if (exercises.has("exercises") && exercises.get("exercises").isArray()) {
                    for (JsonNode ex : exercises.get("exercises")) {
                        String type = ex.has("type") ? ex.get("type").asText() : "UNKNOWN";
                        String question = extractQuestionText(ex);
                        summaries.add(PracticeNodePromptBuilder.summarizeExercise(type, question));
                    }
                }
            } catch (Exception e) {
                log.warn("[PracticeNode] Failed to parse exercises for summary: {}", e.getMessage());
            }
        }
        return summaries;
    }

    private String extractQuestionText(JsonNode exercise) {
        // Try various field names used across exercise types
        for (String field : List.of("question_vi", "sentence_de", "sentence_with_blank",
                "audio_transcript", "sentence_vi", "question_de", "statement_de", "prompt_vi")) {
            if (exercise.has(field)) return exercise.get(field).asText();
        }
        return exercise.toString().substring(0, Math.min(80, exercise.toString().length()));
    }

    private List<String> getSeenHashes(long userId, long sourceNodeId, String skillType) {
        return jdbcTemplate.queryForList("""
                SELECT question_hash FROM user_seen_exercise_hashes
                WHERE user_id = ? AND source_node_id = ? AND skill_type = ?
                """, String.class, userId, sourceNodeId, skillType);
    }

    private List<String> computeExerciseHashes(JsonNode exercises, String skillType) {
        List<String> hashes = new ArrayList<>();
        Iterable<JsonNode> items;
        if (exercises.isArray()) {
            items = exercises;
        } else if (exercises.has("exercises") && exercises.get("exercises").isArray()) {
            items = exercises.get("exercises");
        } else {
            hashes.add(sha256(skillType + ":" + exercises.toString()));
            return hashes;
        }

        for (JsonNode ex : items) {
            String type = ex.has("type") ? ex.get("type").asText() : "";
            String question = extractQuestionText(ex);
            String correct = "";
            for (String f : List.of("correct_answer", "correct_index", "correct_order")) {
                if (ex.has(f)) { correct = ex.get(f).toString(); break; }
            }
            hashes.add(sha256(skillType + ":" + type + ":" + question + ":" + correct));
        }
        return hashes;
    }

    private String cleanJsonResponse(String raw) {
        String cleaned = raw.trim();
        if (cleaned.startsWith("```json")) cleaned = cleaned.substring(7);
        else if (cleaned.startsWith("```")) cleaned = cleaned.substring(3);
        if (cleaned.endsWith("```")) cleaned = cleaned.substring(0, cleaned.length() - 3);
        return cleaned.trim();
    }

    private String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return UUID.randomUUID().toString();
        }
    }
}
