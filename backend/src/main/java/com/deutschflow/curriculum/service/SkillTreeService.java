package com.deutschflow.curriculum.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.speaking.ai.GroqChatClient;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Core service for the Skill Tree system.
 * Handles: unlock flow, LLM content generation, caching, pre-fetching, SSE streaming.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SkillTreeService {

    private final JdbcTemplate jdbcTemplate;
    private final GroqChatClient groqChatClient;
    private final AiUsageLedgerService aiUsageLedgerService;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactionTemplate;

    // In-memory lock to prevent duplicate LLM calls for the same cache key
    private final ConcurrentHashMap<String, Boolean> generationLocks = new ConcurrentHashMap<>();

    // ─────────────────────────────────────────────────────────────
    // 1. GET SKILL TREE — Trả về toàn bộ cây cho user
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public List<Map<String, Object>> getSkillTreeForUser(long userId) {
        // Auto-unlock node đầu tiên cho user mới (chưa có bất kỳ progress nào)
        autoUnlockFirstNodeIfNeeded(userId);

        // Lấy tất cả nodes + progress của user (LEFT JOIN để bao gồm cả LOCKED nodes)
        // Cast TEXT[] → TEXT và JSONB → TEXT để tránh lỗi serialization Jackson
        return jdbcTemplate.queryForList("""
                SELECT
                    n.id, n.node_type, n.title_de, n.title_vi, n.description_vi, n.emoji,
                    n.phase, n.day_number, n.week_number, n.sort_order,
                    n.cefr_level, n.difficulty, n.xp_reward, n.energy_cost,
                    n.industry, n.industry_vocab_percent, n.vocab_strategy,
                    array_to_json(n.core_topics)::text   AS core_topics,
                    array_to_json(n.grammar_points)::text AS grammar_points,
                    COALESCE(p.status, 'LOCKED') AS user_status,
                    COALESCE(p.score_percent, 0) AS user_score,
                    COALESCE(p.xp_earned, 0) AS user_xp,
                    COALESCE(p.attempts, 0) AS user_attempts,
                    p.completed_at,
                    p.prefetch_status,
                    CASE
                        WHEN NOT EXISTS (
                            SELECT 1 FROM skill_tree_node_dependencies d
                            LEFT JOIN skill_tree_user_progress dp
                                ON dp.node_id = d.depends_on_node_id AND dp.user_id = ?
                            WHERE d.node_id = n.id
                              AND (dp.status IS NULL OR dp.status <> 'COMPLETED'
                                   OR dp.score_percent < d.min_score_percent)
                        ) THEN TRUE
                        ELSE FALSE
                    END AS dependencies_met
                FROM skill_tree_nodes n
                LEFT JOIN skill_tree_user_progress p
                    ON p.node_id = n.id AND p.user_id = ?
                WHERE n.is_active = TRUE
                ORDER BY n.sort_order ASC, n.day_number ASC
                """, userId, userId);
    }

    /**
     * Nếu user chưa có bất kỳ progress nào → unlock node đầu tiên (sort_order = 1)
     * để user mới thấy điểm bắt đầu là UNLOCKED thay vì toàn bộ LOCKED.
     */
    private void autoUnlockFirstNodeIfNeeded(long userId) {
        Integer existingProgress = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM skill_tree_user_progress WHERE user_id = ?",
                Integer.class, userId);

        if (existingProgress != null && existingProgress > 0) return; // Đã có progress → không cần

        // Lấy node đầu tiên (sort_order nhỏ nhất, CORE_TRUNK)
        List<Map<String, Object>> firstNodes = jdbcTemplate.queryForList("""
                SELECT id FROM skill_tree_nodes
                WHERE is_active = TRUE AND node_type = 'CORE_TRUNK'
                ORDER BY sort_order ASC, day_number ASC
                LIMIT 1
                """);

        if (firstNodes.isEmpty()) return;

        long firstNodeId = ((Number) firstNodes.get(0).get("id")).longValue();
        log.info("[SkillTree] Auto-unlocking first node {} for new user {}", firstNodeId, userId);
        upsertProgress(userId, firstNodeId, "UNLOCKED");
    }

    // ─────────────────────────────────────────────────────────────
    // 2. UNLOCK NODE — Mở khóa Nhánh phụ (SATELLITE_LEAF)
    // ─────────────────────────────────────────────────────────────

    /**
     * Luồng chính:
     * 1. Validate: user có đủ Vé chuyên ngành? Dependencies met?
     * 2. Check Cache: node.content_json hoặc cached content với cùng industry+cefr
     * 3. Nếu cache HIT → trả content ngay (< 0.1s)
     * 4. Nếu cache MISS → gọi LLM async + bắn SSE realtime
     * 5. Lưu kết quả vào DB (cache cho user sau)
     *
     * @return SseEmitter cho streaming hoặc null nếu đã có cache
     */
    /**
     * Unlock SATELLITE_LEAF node. Sử dụng TransactionTemplate 2 pha:
     * - Pha 1: Transaction ngắn — validate, upsert progress, check cache (~100ms)
     * - Pha 2: Nếu cache MISS → chạy LLM trên thread riêng (CompletableFuture) — KHÔNG giữ DB connection
     */
    public Object unlockSatelliteNode(long userId, long nodeId) {
        // ── PHA 1: Validate + check cache (transaction ngắn ~100ms) ──
        record UnlockPrep(boolean cacheHit, Object cachedResponse, Map<String, Object> node) {}

        UnlockPrep prep = Objects.requireNonNull(transactionTemplate.execute(status -> {
            Map<String, Object> node = loadNodeOrThrow(nodeId);
            String nodeType = (String) node.get("node_type");
            if (!"SATELLITE_LEAF".equals(nodeType)) {
                throw new BadRequestException("Chỉ có thể mở khóa Nhánh phụ (SATELLITE_LEAF)");
            }

            boolean depsMet = checkDependenciesMet(userId, nodeId);
            if (!depsMet) {
                throw new BadRequestException("Bạn cần hoàn thành các bài học trước đó trước");
            }

            upsertProgress(userId, nodeId, "UNLOCKED");

            String industry = (String) node.get("industry");
            String cefrLevel = (String) node.get("cefr_level");
            String vocabStrategy = (String) node.get("vocab_strategy");
            String cacheKey = SatelliteLeafPromptBuilder.cacheKey(industry, cefrLevel, nodeId, vocabStrategy);

            // 4a. Check content_json trên chính node này
            Object existingContent = node.get("content_json");
            if (existingContent != null) {
                log.info("[SkillTree] Cache HIT (node content) for node={}, key={}", nodeId, cacheKey);
                upsertProgress(userId, nodeId, "IN_PROGRESS");
                return new UnlockPrep(true, Map.of(
                        "source", "CACHE",
                        "nodeId", nodeId,
                        "content", existingContent
                ), node);
            }

            // 4b. Check cache from other nodes with same industry+cefr+vocabStrategy
            Map<String, Object> cachedNode = findCachedContent(industry, cefrLevel, vocabStrategy, nodeId);
            if (cachedNode != null) {
                log.info("[SkillTree] Cache HIT (sibling) for node={}, key={}", nodeId, cacheKey);
                jdbcTemplate.update("""
                        UPDATE skill_tree_nodes
                        SET content_json = ?::jsonb, content_hash = ?, content_generated_at = NOW()
                        WHERE id = ?
                        """,
                        String.valueOf(cachedNode.get("content_json")),
                        cachedNode.get("content_hash"),
                        nodeId);
                upsertProgress(userId, nodeId, "IN_PROGRESS");
                return new UnlockPrep(true, Map.of(
                        "source", "CACHE_SIBLING",
                        "nodeId", nodeId,
                        "content", cachedNode.get("content_json")
                ), node);
            }

            // Cache MISS
            log.info("[SkillTree] Cache MISS — triggering LLM generation for node={}, key={}", nodeId, cacheKey);
            upsertProgress(userId, nodeId, "IN_PROGRESS");
            return new UnlockPrep(false, null, node);
        }));
        // → Connection TRẢ VỀ pool ✅

        // Cache HIT → trả ngay
        if (prep.cacheHit()) {
            return prep.cachedResponse();
        }

        // ── PHA 2: Cache MISS → LLM generation trên thread riêng (KHÔNG giữ DB connection) ──
        SseEmitter emitter = new SseEmitter(60_000L);
        CompletableFuture.runAsync(() ->
                generateContentAsync(userId, nodeId, prep.node(), emitter)
        );
        return emitter;
    }

    // ─────────────────────────────────────────────────────────────
    // 3. ASYNC LLM GENERATION — Sinh bài học + bắn SSE
    // ─────────────────────────────────────────────────────────────

    @Async("speakingStreamExecutor") // Reuse existing thread pool
    public void generateContentAsync(long userId, long nodeId, Map<String, Object> node, SseEmitter emitter) {
        String industry = (String) node.get("industry");
        String cefrLevel = (String) node.get("cefr_level");
        String vocabStrategy = (String) node.get("vocab_strategy");
        int industryPercent = safeInt(node.get("industry_vocab_percent"), 15);
        int dayNumber = safeInt(node.get("day_number"), 8);
        String parentTitle = (String) node.get("title_de");
        String grammarContext = "Allgemein";
        Object gpRaw = node.get("grammar_points");
        if (gpRaw instanceof String gpStr && gpStr != null && !gpStr.isBlank()) {
            // grammar_points comes as JSON array text: ["a","b","c"]
            grammarContext = gpStr.replaceAll("[\\[\\]\"]", "");
        }

        String cacheKey = SatelliteLeafPromptBuilder.cacheKey(industry, cefrLevel, nodeId, vocabStrategy);

        // Prevent duplicate concurrent generations
        if (generationLocks.putIfAbsent(cacheKey, true) != null) {
            log.debug("[SkillTree] Generation already in progress for key={}", cacheKey);
            try {
                emitter.send(SseEmitter.event().name("info").data("{\"status\":\"GENERATING_IN_PROGRESS\"}"));
                emitter.complete();
            } catch (IOException ignored) {}
            return;
        }

        try {
            // Build system prompt
            String systemPrompt = SatelliteLeafPromptBuilder.buildSystemPrompt(
                    industry, cefrLevel, parentTitle, grammarContext,
                    vocabStrategy, industryPercent, dayNumber
            );

            // Send "generating" event
            emitter.send(SseEmitter.event().name("status").data("{\"status\":\"GENERATING\"}"));

            // Call Groq LLM (blocking in async thread)
            List<ChatMessage> messages = List.of(
                    new ChatMessage("system", systemPrompt),
                    new ChatMessage("user", "Erstelle die Lektion jetzt als JSON.")
            );

            AiChatCompletionResult result = groqChatClient.chatCompletion(messages, null, 0.3, 4096);
            String rawJson = result.content();

            // Validate JSON
            JsonNode parsed = objectMapper.readTree(rawJson);
            String cleanJson = objectMapper.writeValueAsString(parsed);
            String contentHash = sha256(cleanJson);

            // ── Save to DB (cache) ──
            jdbcTemplate.update("""
                    UPDATE skill_tree_nodes
                    SET content_json = ?::jsonb,
                        content_hash = ?,
                        content_generated_at = NOW(),
                        content_model = ?
                    WHERE id = ?
                    """,
                    cleanJson, contentHash, result.model(), nodeId);

            // ── Record token usage ──
            if (result.usage() != null) {
                aiUsageLedgerService.record(
                        userId, result.provider(), result.model(),
                        result.usage().promptTokens(),
                        result.usage().completionTokens(),
                        result.usage().totalTokens(),
                        "SKILL_TREE_GENERATE",
                        null, null
                );
            }

            // ── Send "done" event with content ──
            emitter.send(SseEmitter.event().name("done").data(cleanJson));
            emitter.complete();

            log.info("[SkillTree] Generated + cached content for node={}, hash={}, tokens={}",
                    nodeId, contentHash,
                    result.usage() != null ? result.usage().totalTokens() : "N/A");

        } catch (Exception ex) {
            log.error("[SkillTree] LLM generation failed for node={}: {}", nodeId, ex.getMessage(), ex);
            try {
                emitter.send(SseEmitter.event().name("error")
                        .data("{\"error\":\"Không thể tạo bài học. Vui lòng thử lại.\"}"));
                emitter.completeWithError(ex);
            } catch (IOException ignored) {}
        } finally {
            generationLocks.remove(cacheKey);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 4. PRE-FETCHING — Sinh trước content khi user đạt 80%
    // ─────────────────────────────────────────────────────────────

    /**
     * Called after each node completion to trigger pre-fetching for the next SATELLITE_LEAF.
     * Only triggers when user reaches 80% on their current node.
     */
    /**
     * Pre-fetch content khi user đạt 80%. Sử dụng TransactionTemplate 2 pha:
     * - Pha 1: Transaction ngắn — query next leaves + upsert QUEUED (~50ms)
     * - Pha 2: Fire-and-forget LLM generation trên thread riêng — KHÔNG giữ DB connection
     */
    public void checkAndTriggerPrefetch(long userId, long currentNodeId, int currentScore) {
        if (currentScore < 80) return;

        // ── PHA 1: DB prep (transaction ngắn ~50ms) ──
        List<Map<String, Object>> leavesToGenerate = transactionTemplate.execute(status -> {
            List<Map<String, Object>> nextLeaves = jdbcTemplate.queryForList("""
                    SELECT n.*
                    FROM skill_tree_nodes n
                    JOIN skill_tree_node_dependencies d ON d.node_id = n.id
                    WHERE d.depends_on_node_id = ?
                      AND n.node_type = 'SATELLITE_LEAF'
                      AND n.content_json IS NULL
                      AND n.is_active = TRUE
                    """, currentNodeId);

            for (Map<String, Object> leaf : nextLeaves) {
                long leafId = ((Number) leaf.get("id")).longValue();
                jdbcTemplate.update("""
                        INSERT INTO skill_tree_user_progress (user_id, node_id, status, prefetch_status, prefetch_triggered_at)
                        VALUES (?, ?, 'LOCKED', 'QUEUED', NOW())
                        ON CONFLICT (user_id, node_id)
                        DO UPDATE SET prefetch_status = 'QUEUED', prefetch_triggered_at = NOW(), updated_at = NOW()
                        """, userId, leafId);
            }
            return nextLeaves;
        });
        // → Connection TRẢ VỀ pool ✅

        // ── PHA 2: Fire-and-forget LLM generation (KHÔNG giữ DB connection) ──
        if (leavesToGenerate != null) {
            for (Map<String, Object> leaf : leavesToGenerate) {
                long leafId = ((Number) leaf.get("id")).longValue();
                SseEmitter dummyEmitter = new SseEmitter(120_000L);
                dummyEmitter.onCompletion(() -> {});
                dummyEmitter.onError(e -> {});
                CompletableFuture.runAsync(() ->
                        generateContentAsync(userId, leafId, leaf, dummyEmitter)
                );
                log.info("[SkillTree] Pre-fetch triggered for user={}, nextLeaf={}", userId, leafId);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 5. SUBMIT EXERCISES — Nộp bài cho một node
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> submitNodeExercises(long userId, long nodeId, Map<String, Object> answers) {
        Map<String, Object> progress = null;
        try {
            progress = loadProgressOrThrow(userId, nodeId);
        } catch (NotFoundException e) {
            // First time accessing this node
            progress = Map.of("status", "LOCKED", "attempts", 0, "best_score", 0);
        }
        
        String status = (String) progress.get("status");

        if ("COMPLETED".equals(status)) {
            throw new BadRequestException("Bạn đã hoàn thành bài này rồi");
        }
        
        // If not started or unlocked, check dependencies
        if (!"IN_PROGRESS".equals(status)) {
            if (!checkDependenciesMet(userId, nodeId)) {
                throw new BadRequestException("Bạn cần hoàn thành các bài học trước đó trước");
            }
        }

        // Load content & grade
        Map<String, Object> node = loadNodeOrThrow(nodeId);
        // ... grading logic (use existing SessionExerciseService patterns)

        int scorePercent = 85; // placeholder — actual grading from answers vs correct
        int attempts = safeInt(progress.get("attempts"), 0) + 1;
        int bestScore = Math.max(safeInt(progress.get("best_score"), 0), scorePercent);
        boolean completed = scorePercent >= 60;
        int xpEarned = completed ? safeInt(node.get("xp_reward"), 100) : 0;

        String newStatus = completed ? "COMPLETED" : "IN_PROGRESS";

        jdbcTemplate.update("""
                INSERT INTO skill_tree_user_progress (
                    user_id, node_id, status, score_percent, best_score,
                    attempts, xp_earned, completed_at, last_attempt_at,
                    created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?,
                    ?, ?, CASE WHEN ? = 'COMPLETED' THEN NOW() ELSE NULL END, NOW(),
                    NOW(), NOW()
                )
                ON CONFLICT (user_id, node_id)
                DO UPDATE SET
                    status = EXCLUDED.status,
                    score_percent = EXCLUDED.score_percent,
                    best_score = GREATEST(skill_tree_user_progress.best_score, EXCLUDED.best_score),
                    attempts = skill_tree_user_progress.attempts + 1,
                    xp_earned = EXCLUDED.xp_earned,
                    completed_at = COALESCE(skill_tree_user_progress.completed_at, EXCLUDED.completed_at),
                    last_attempt_at = NOW(),
                    updated_at = NOW()
                """,
                userId, nodeId, newStatus, scorePercent, bestScore,
                attempts, xpEarned, newStatus);

        // Trigger pre-fetch if score >= 80
        if (scorePercent >= 80) {
            checkAndTriggerPrefetch(userId, nodeId, scorePercent);
        }

        return Map.of(
                "nodeId", nodeId,
                "scorePercent", scorePercent,
                "bestScore", bestScore,
                "attempts", attempts,
                "completed", completed,
                "xpEarned", xpEarned,
                "status", newStatus
        );
    }

    // ─────────────────────────────────────────────────────────────
    // ── Helpers ──
    // ─────────────────────────────────────────────────────────────

    private Map<String, Object> loadNodeOrThrow(long nodeId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT id, node_type, title_de, title_vi, description_vi, emoji,
                       phase, day_number, week_number, cefr_level, difficulty,
                       xp_reward, energy_cost, industry, industry_vocab_percent,
                       vocab_strategy, content_json::text AS content_json, content_hash,
                       array_to_json(core_topics)::text AS core_topics,
                       array_to_json(grammar_points)::text AS grammar_points
                FROM skill_tree_nodes WHERE id = ? AND is_active = TRUE
                """, nodeId);
        if (rows.isEmpty()) throw new NotFoundException("Node not found: " + nodeId);
        return rows.get(0);
    }

    private Map<String, Object> loadProgressOrThrow(long userId, long nodeId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT * FROM skill_tree_user_progress WHERE user_id = ? AND node_id = ?", userId, nodeId);
        if (rows.isEmpty()) throw new NotFoundException("Progress not found");
        return rows.get(0);
    }

    private boolean checkDependenciesMet(long userId, long nodeId) {
        Integer unmetCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM skill_tree_node_dependencies d
                LEFT JOIN skill_tree_user_progress p
                    ON p.node_id = d.depends_on_node_id AND p.user_id = ?
                WHERE d.node_id = ?
                  AND (p.status IS NULL OR p.status <> 'COMPLETED'
                       OR p.score_percent < d.min_score_percent)
                """, Integer.class, userId, nodeId);
        return unmetCount != null && unmetCount == 0;
    }

    private Map<String, Object> findCachedContent(String industry, String cefrLevel, String vocabStrategy, long excludeNodeId) {
        List<Map<String, Object>> cached = jdbcTemplate.queryForList("""
                SELECT content_json, content_hash
                FROM skill_tree_nodes
                WHERE industry = ? AND cefr_level = ? AND vocab_strategy = ?
                  AND content_json IS NOT NULL AND id <> ?
                LIMIT 1
                """, industry, cefrLevel, vocabStrategy, excludeNodeId);
        return cached.isEmpty() ? null : cached.get(0);
    }

    private void upsertProgress(long userId, long nodeId, String status) {
        String timestampCol = switch (status) {
            case "UNLOCKED" -> "unlocked_at";
            case "IN_PROGRESS" -> "started_at";
            case "COMPLETED" -> "completed_at";
            default -> null;
        };
        String setTimestamp = timestampCol != null
                ? ", " + timestampCol + " = COALESCE(" + timestampCol + ", NOW())"
                : "";

        jdbcTemplate.update("""
                INSERT INTO skill_tree_user_progress (user_id, node_id, status, created_at, updated_at)
                VALUES (?, ?, ?, NOW(), NOW())
                ON CONFLICT (user_id, node_id)
                DO UPDATE SET status = ?, updated_at = NOW()
                """ + setTimestamp,
                userId, nodeId, status, status);
    }

    private int safeInt(Object v, int fallback) {
        if (v instanceof Number n) return n.intValue();
        return fallback;
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
