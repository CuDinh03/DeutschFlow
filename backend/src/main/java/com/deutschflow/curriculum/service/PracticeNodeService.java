package com.deutschflow.curriculum.service;

import com.deutschflow.common.async.AsyncJob;
import com.deutschflow.common.async.AsyncJobService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.gamification.service.XpService;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;

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
    // Khung tier B3.3: sinh bài luyện tập = tier CONTENT (như SkillTreeService).
    private final OpenAiChatClient chatClient;
    private final LlmTierResolver llmTierResolver;
    private final AiUsageLedgerService aiUsageLedgerService;
    private final ObjectMapper objectMapper;
    private final AsyncJobService asyncJobService;
    private final XpService xpService;
    private final com.deutschflow.srs.service.SrsVocabScheduler srsVocabScheduler;
    private final QuotaService quotaService;
    private final OrgPoolGuard orgPoolGuard;
    /**
     * Bounded pool for blocking LLM practice-node generation. Field name matches the
     * {@code aiExecutor} bean (AsyncConfig) so Spring resolves it by name. Replaces
     * {@code CompletableFuture.runAsync(...)} on {@code ForkJoinPool.commonPool()},
     * which let 4 concurrent 3–10s Groq calls starve all other parallel work.
     */
    private final Executor aiExecutor;

    private static final int XP_PER_SESSION = 30;
    private static final long PRACTICE_ESTIMATED_TOKENS = 4_096L;
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
            }, aiExecutor);
        }
        log.info("[PracticeNode] Triggered 4 practice nodes for user={}, node={}", userId, sourceNodeId);
    }

    // ─────────────────────────────────────────────────────────────
    // 1b. ASYNC WRAPPERS — trả 202+jobId cho controller (S-5: off Tomcat thread)
    // ─────────────────────────────────────────────────────────────

    /**
     * Sinh Gen-1 session cho 1 kỹ năng trên aiExecutor, trả jobId ngay.
     * Controller trả 202; client poll {@code GET /api/async-jobs/{jobId}}.
     */
    public Map<String, Object> startPracticeSessionAsync(long userId, long nodeId, String skillType) {
        AsyncJob job = asyncJobService.createJob("GENERATE_PRACTICE", userId);
        CompletableFuture.runAsync(() -> {
            try {
                Map<String, Object> result = generatePracticeSession(userId, nodeId, skillType, 1);
                asyncJobService.completeJob(job.getId(), objectMapper.writeValueAsString(result));
            } catch (Exception e) {
                asyncJobService.failJob(job.getId(),
                        e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
                log.error("[PracticeNode] Async start failed userId={} nodeId={} skill={}: {}",
                        userId, nodeId, skillType, e.getMessage());
            }
        }, aiExecutor);
        return Map.of("jobId", job.getId().toString(), "status", AsyncJob.Status.PENDING.name());
    }

    /**
     * Sinh thế hệ tiếp theo (Gen N+1) trên aiExecutor, trả jobId ngay.
     */
    public Map<String, Object> generateNextAsync(long userId, long nodeId, String skillType) {
        AsyncJob job = asyncJobService.createJob("GENERATE_PRACTICE_NEXT", userId);
        CompletableFuture.runAsync(() -> {
            try {
                Map<String, Object> result = generateNextGeneration(userId, nodeId, skillType);
                asyncJobService.completeJob(job.getId(), objectMapper.writeValueAsString(result));
            } catch (Exception e) {
                asyncJobService.failJob(job.getId(),
                        e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
                log.error("[PracticeNode] Async next-gen failed userId={} nodeId={} skill={}: {}",
                        userId, nodeId, skillType, e.getMessage());
            }
        }, aiExecutor);
        return Map.of("jobId", job.getId().toString(), "status", AsyncJob.Status.PENDING.name());
    }

    // ─────────────────────────────────────────────────────────────
    // 2. GENERATE — Sinh 1 practice session cho 1 kỹ năng
    // ─────────────────────────────────────────────────────────────

    public Map<String, Object> generatePracticeSession(long userId, long sourceNodeId, String skillType, int generation) {
        validateSkillType(skillType);
        quotaService.assertAllowed(userId, Instant.now(), PRACTICE_ESTIMATED_TOKENS);
        orgPoolGuard.assertOrgPoolAvailable(userId, PRACTICE_ESTIMATED_TOKENS);

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

            AiChatCompletionResult result = chatClient.chatCompletionForTier(messages, llmTierResolver.spec(LlmTier.CONTENT), 0.4, 4096);
            String rawJson = cleanJsonResponse(result.content());

            // Validate JSON + bóc vỏ wrapper trước khi lưu
            JsonNode parsed = normalizeExercisePayload(objectMapper.readTree(rawJson));
            String cleanJson = objectMapper.writeValueAsString(parsed);

            // Compute hashes for each exercise
            List<String> hashes = computeExerciseHashes(parsed, skillType);

            // Check for duplicates against seen hashes
            List<String> existingHashes = getSeenHashes(userId, sourceNodeId, skillType);
            long duplicateCount = hashes.stream().filter(existingHashes::contains).count();
            boolean noExercises = countExercises(parsed) == 0;
            if (noExercises || duplicateCount > hashes.size() / 2) {
                String retryHint;
                if (noExercises) {
                    log.warn("[PracticeNode] Model trả 0 bài tập cho {} Gen-{} (user={}, node={}) — sinh lại",
                            skillType, generation, userId, sourceNodeId);
                    retryHint = "⚠️ WARNUNG: Die vorherige Antwort enthielt KEINE Übungen. "
                            + "Antworte mit einem JSON-Objekt, das die Übungen im Feld \"exercises\" enthält!";
                } else {
                    log.warn("[PracticeNode] Too many duplicates ({}/{}), retrying...", duplicateCount, hashes.size());
                    retryHint = "⚠️ WARNUNG: Die vorherige Generation hatte zu viele Duplikate. Sei KOMPLETT anders!";
                }
                // Retry once with stronger hint
                seenSummaries.add(retryHint);
                String retryPrompt = PracticeNodePromptBuilder.buildPromptForSkill(
                        skillType, lessonTitle, cefrLevel,
                        vocabularyWords, grammarFocus,
                        seenSummaries, generation
                );
                messages = List.of(
                        new ChatMessage("system", retryPrompt),
                        new ChatMessage("user", "Erstelle die Übungen jetzt als JSON. KOMPLETT ANDERE als vorher!")
                );
                result = chatClient.chatCompletionForTier(messages, llmTierResolver.spec(LlmTier.CONTENT), 0.6, 4096);
                rawJson = cleanJsonResponse(result.content());
                parsed = normalizeExercisePayload(objectMapper.readTree(rawJson));
                cleanJson = objectMapper.writeValueAsString(parsed);
                hashes = computeExerciseHashes(parsed, skillType);
            }

            // KHÔNG BAO GIỜ lưu session rỗng: học viên sẽ mở ra màn hình "0 câu" không có nút
            // nộp bài lẫn nút sinh lại, và `start` sau đó cache-hit theo node nên kẹt vĩnh viễn.
            // Thà báo lỗi để client hiện thông báo + cho thử lại.
            if (countExercises(parsed) == 0) {
                log.error("[PracticeNode] Bỏ session rỗng sau 2 lần sinh: {} Gen-{} user={} node={}",
                        skillType, generation, userId, sourceNodeId);
                return Map.of("status", "FAILED", "error", "AI không sinh được bài tập, vui lòng thử lại.");
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
                        result.usage(), "PRACTICE_NODE_GENERATE", null, null);
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

        // Get latest session per skill type.
        // exercises_json stores the LLM output verbatim: a bare array, or an object carrying
        // `exercises` (e.g. LESEN, which also holds reading_passage). A bare jsonb_array_length on
        // the object shape aborts the whole query ("cannot get array length of a non-array"), which
        // poisons the overview AND every skill's /start for the node — guard like RoadmapService /
        // SkillTreeService do for skill_exercises (KEEP IN SYNC).
        // best_score_percent spans ALL generations of the skill (the window runs before DISTINCT ON
        // keeps only the latest row), because regenerating a fresh Gen-N must not erase the mastery
        // the learner already proved on an earlier generation.
        List<Map<String, Object>> sessions = jdbcTemplate.queryForList("""
                SELECT DISTINCT ON (skill_type)
                    id, skill_type, generation, status, score_percent,
                    MAX(score_percent) OVER (PARTITION BY skill_type) AS best_score_percent,
                    xp_earned, created_at, completed_at,
                    -- exercises_json là OBJECT {"exercises": [...]} (+ reading_passage cho LESEN);
                    -- mảng top-level chỉ còn ở session sinh trước bản vá. jsonb_array_length ném lỗi
                    -- "cannot get array length of a non-array" nếu gọi thẳng vào object → 500 cả trang.
                    CASE
                        WHEN jsonb_typeof(exercises_json) = 'array'
                            THEN jsonb_array_length(exercises_json)
                        WHEN jsonb_typeof(exercises_json -> 'exercises') = 'array'
                            THEN jsonb_array_length(exercises_json -> 'exercises')
                        WHEN jsonb_typeof(exercises_json -> 'content') = 'array'
                            THEN jsonb_array_length(exercises_json -> 'content')
                        ELSE 0
                    END AS exercise_count
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
                JsonNode exercises = findExerciseArray(objectMapper.readTree(json));
                if (exercises != null) {
                    for (JsonNode ex : exercises) {
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
        // Try various field names used across exercise types — German-first contract (18/08),
        // legacy *_vi fields kept for sessions generated before the switch.
        for (String field : List.of("question_de", "sentence_de", "sentence_with_blank",
                "audio_transcript", "statement_de", "situation_de", "scenario_de", "prompt_de",
                "question_vi", "sentence_vi", "prompt_vi")) {
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

    /**
     * Tên khoá đang chứa mảng bài tập trong một object, hoặc {@code null} nếu không có.
     *
     * <p>Ưu tiên {@code "exercises"} (dạng chuẩn). Nếu không có, nhận mảng-đối-tượng đầu tiên
     * tìm được: sinh practice đi qua {@code chatCompletionForTier(messages, tier, temp, maxTokens)},
     * overload này mặc định {@code forceJson=true} ⇒ {@code response_format=json_object} ⇒ model
     * không thể trả mảng top-level và đôi khi tự đặt tên khoá khác ({@code "uebungen"},
     * {@code "aufgaben"}…). Bắt lấy để cứu bài thay vì trả session rỗng cho học viên.
     */
    private static String findExerciseFieldName(JsonNode root) {
        if (root == null || !root.isObject()) return null;
        JsonNode named = root.get("exercises");
        if (named != null && named.isArray()) return "exercises";
        Iterator<String> names = root.fieldNames();
        while (names.hasNext()) {
            String name = names.next();
            JsonNode candidate = root.get(name);
            if (candidate.isArray() && candidate.size() > 0 && candidate.get(0).isObject()) return name;
        }
        return null;
    }

    /** Mảng bài tập trong payload, chấp nhận cả mảng top-level (session sinh trước bản vá). */
    private static JsonNode findExerciseArray(JsonNode root) {
        if (root == null || root.isMissingNode() || root.isNull()) return null;
        if (root.isArray()) return root;
        String field = findExerciseFieldName(root);
        return field == null ? null : root.get(field);
    }

    static int countExercises(JsonNode root) {
        JsonNode array = findExerciseArray(root);
        return array == null ? 0 : array.size();
    }

    /**
     * Đưa payload model trả về đúng hình dạng client và {@link PracticeExerciseGrader} đọc được.
     *
     * <p>Hai bước, vì có hai kiểu vỏ khác nhau đã gặp trên prod:
     * <ol>
     *   <li><b>Vỏ JSON-schema</b> {@code {"type":"object","content":[...]}} — bóc lặp (phòng vỏ
     *       lồng vỏ). Object có {@code content} mà thiếu cả {@code exercises} lẫn
     *       {@code reading_passage} thì chắc chắn là vỏ (prod 17–18/08: session 33 HOEREN,
     *       35 SPRECHEN).</li>
     *   <li><b>Khoá tự đặt</b> ({@code "uebungen"}, {@code "aufgaben"}…) — đổi tên về
     *       {@code exercises}, giữ nguyên mọi khoá phụ như {@code reading_passage} của LESEN
     *       (prod 25/08: node 114 HOEREN).</li>
     * </ol>
     * Cả hai đều là hệ quả của việc {@code response_format=json_object} cấm mảng top-level —
     * xem hợp đồng hình dạng ở {@link PracticeNodePromptBuilder}. Bóc vỏ chỉ là lưới an toàn:
     * sửa gốc nằm ở prompt.
     */
    static JsonNode normalizeExercisePayload(JsonNode parsed) {
        while (parsed != null && parsed.isObject() && parsed.has("content")
                && !parsed.has("exercises") && !parsed.has("reading_passage")
                && (parsed.get("content").isArray() || parsed.get("content").isObject())) {
            parsed = parsed.get("content");
        }
        String field = findExerciseFieldName(parsed);
        if (field == null || "exercises".equals(field)) return parsed;
        ObjectNode rebuilt = ((ObjectNode) parsed).deepCopy();
        rebuilt.set("exercises", rebuilt.remove(field));
        return rebuilt;
    }

    private List<String> computeExerciseHashes(JsonNode exercises, String skillType) {
        List<String> hashes = new ArrayList<>();
        JsonNode items = findExerciseArray(exercises);
        if (items == null) {
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
