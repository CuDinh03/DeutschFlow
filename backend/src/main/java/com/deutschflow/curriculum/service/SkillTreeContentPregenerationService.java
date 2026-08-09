package com.deutschflow.curriculum.service;

import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Sinh nội dung bài học TRƯỚC theo lô cho các node còn rỗng (admin, F3.4b của khung AI tier).
 *
 * <p><b>Vì sao tồn tại.</b> Node {@code SATELLITE_LEAF} seed sẵn với {@code content_json = NULL}
 * và chỉ được sinh khi có học viên unlock — nghĩa là chất lượng nội dung bị trói vào ràng buộc
 * "học viên đang chờ". Quyết định #15 (09/08) tách hai đường: đường unlock giữ model nhanh
 * ({@link LlmTier#CONTENT}), còn đường này chạy trước, không ai chờ, nên mua được model mạnh
 * ({@link LlmTier#CONTENT_BATCH} — đo thật: Kimi K2.6 cần ≥4096 token và 32–41s/node).
 *
 * <p><b>Chỉ LẤP CHỖ TRỐNG, không bao giờ ghi đè.</b> Câu {@code UPDATE} có điều kiện
 * {@code content_json IS NULL} nên: (a) chạy lại an toàn — node đã sinh thì bỏ qua, tự resume;
 * (b) không đụng nội dung học viên đang học; (c) một node bị người khác sinh xen giữa thì đếm là
 * {@code skipped} chứ không ghi chồng. Việc thay nội dung ĐÃ CÓ là của P5/khu vực H (regen), có
 * thẩm định chéo trước khi swap — cố tình KHÔNG gộp vào đây.
 *
 * <p>Chạy tuần tự: mỗi node tốn hàng chục giây và mọi lượt gọi đều đi qua cùng semaphore chat với
 * traffic thật, nên bắn song song chỉ đổi được chút thời gian mà rủi ro làm nghẽn người dùng.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SkillTreeContentPregenerationService {

    /** Ngân sách token: bằng đúng đường unlock ({@code SkillTreeService}) để nội dung cùng cỡ. */
    private static final int MAX_TOKENS = 4096;
    private static final double TEMPERATURE = 0.3;
    /** Trần mỗi lần gọi — 32–41s/node ⇒ 25 node đã là ~15 phút một request. */
    private static final int MAX_LIMIT = 25;
    private static final int DEFAULT_LIMIT = 5;
    private static final String LEDGER_FEATURE = "SKILL_TREE_PREGENERATE";

    private final JdbcTemplate jdbcTemplate;
    private final OpenAiChatClient chatClient;
    private final LlmTierResolver llmTierResolver;
    private final AiUsageLedgerService aiUsageLedgerService;
    private final ObjectMapper objectMapper;

    /**
     * @param industry  lọc theo ngành (null = mọi ngành)
     * @param cefrLevel lọc theo trình độ (null = mọi trình độ)
     * @param limit     số node tối đa (null ⇒ {@value #DEFAULT_LIMIT}, trần {@value #MAX_LIMIT})
     * @param dryRun    true = chỉ liệt kê ứng viên, KHÔNG gọi AI và không ghi gì
     */
    public record PregenerateRequest(String industry, String cefrLevel, Integer limit, boolean dryRun) {}

    /**
     * @param status GENERATED | SKIPPED (đã có nội dung trước khi kịp ghi) | FAILED | CANDIDATE (dry-run)
     */
    public record NodeOutcome(long nodeId, String titleDe, String status, String detail,
                              Integer completionTokens, Long elapsedMs) {}

    public record PregenerateResult(String model, boolean dryRun, int candidates, int generated,
                                    int skipped, int failed, long elapsedMs, List<NodeOutcome> nodes) {}

    public PregenerateResult run(long adminUserId, PregenerateRequest req) {
        int limit = clampLimit(req == null ? null : req.limit());
        String industry = blankToNull(req == null ? null : req.industry());
        String cefrLevel = blankToNull(req == null ? null : req.cefrLevel());
        boolean dryRun = req != null && req.dryRun();

        var spec = llmTierResolver.spec(LlmTier.CONTENT_BATCH);
        List<Map<String, Object>> candidates = findEmptyNodes(industry, cefrLevel, limit);
        long t0 = System.nanoTime();

        List<NodeOutcome> outcomes = new ArrayList<>(candidates.size());
        int generated = 0, skipped = 0, failed = 0;

        for (Map<String, Object> node : candidates) {
            long nodeId = ((Number) node.get("id")).longValue();
            String titleDe = (String) node.get("title_de");
            if (dryRun) {
                outcomes.add(new NodeOutcome(nodeId, titleDe, "CANDIDATE", null, null, null));
                continue;
            }
            NodeOutcome outcome = generateOne(adminUserId, node, spec);
            outcomes.add(outcome);
            switch (outcome.status()) {
                case "GENERATED" -> generated++;
                case "SKIPPED" -> skipped++;
                default -> failed++;
            }
        }

        long elapsedMs = (System.nanoTime() - t0) / 1_000_000L;
        log.info("[Pregenerate] model={} dryRun={} ứng viên={} sinh={} bỏ qua={} lỗi={} trong {}ms",
                spec.model(), dryRun, candidates.size(), generated, skipped, failed, elapsedMs);
        return new PregenerateResult(spec.model(), dryRun, candidates.size(),
                generated, skipped, failed, elapsedMs, outcomes);
    }

    private NodeOutcome generateOne(long adminUserId, Map<String, Object> node,
                                    com.deutschflow.ai.tier.TierSpec spec) {
        long nodeId = ((Number) node.get("id")).longValue();
        String titleDe = (String) node.get("title_de");
        long t0 = System.nanoTime();
        try {
            String systemPrompt = SatelliteLeafPromptBuilder.buildSystemPrompt(
                    str(node.get("industry"), "Allgemein"),
                    str(node.get("cefr_level"), "A1"),
                    str(titleDe, "Lektion"),
                    grammarContext(node.get("grammar_points")),
                    str(node.get("vocab_strategy"), null),
                    intOr(node.get("industry_vocab_percent"), 15),
                    intOr(node.get("day_number"), 8));

            AiChatCompletionResult result = chatClient.chatCompletionForTier(
                    List.of(new ChatMessage("system", systemPrompt),
                            new ChatMessage("user", "Erstelle die Lektion jetzt als JSON.")),
                    spec, TEMPERATURE, MAX_TOKENS);
            long elapsedMs = (System.nanoTime() - t0) / 1_000_000L;

            if (result == null || result.content() == null || result.content().isBlank()) {
                // Model "nghĩ" hết ngân sách rồi trả rỗng — đúng dạng Kimi K2.6 ở 1024 token.
                // Im lặng ghi rỗng vào cache thì học viên mở bài học trắng, nên coi là FAILED.
                return failure(nodeId, titleDe, "AI trả nội dung rỗng", elapsedMs);
            }
            JsonNode parsed = objectMapper.readTree(result.content());
            String cleanJson = objectMapper.writeValueAsString(parsed);

            // WHERE ... IS NULL: chạy lại/đụng độ đều không ghi đè nội dung đã có.
            int updated = jdbcTemplate.update("""
                    UPDATE skill_tree_nodes
                    SET content_json = ?::jsonb,
                        content_hash = ?,
                        content_generated_at = NOW(),
                        content_model = ?
                    WHERE id = ? AND content_json IS NULL
                    """, cleanJson, sha256(cleanJson), result.model(), nodeId);
            if (updated == 0) {
                return new NodeOutcome(nodeId, titleDe, "SKIPPED",
                        "node đã có nội dung trước khi kịp ghi", null, elapsedMs);
            }

            if (result.usage() != null) {
                aiUsageLedgerService.record(adminUserId, result.provider(), result.model(),
                        result.usage(), LEDGER_FEATURE, null, null);
            }
            Integer outTokens = result.usage() == null ? null : result.usage().completionTokens();
            return new NodeOutcome(nodeId, titleDe, "GENERATED", null, outTokens, elapsedMs);

        } catch (Exception e) {
            long elapsedMs = (System.nanoTime() - t0) / 1_000_000L;
            // Một node hỏng không được làm sập cả lô — lô chạy hàng chục phút, mất hết là mất thật.
            log.warn("[Pregenerate] node={} lỗi sau {}ms: {}", nodeId, elapsedMs, e.toString());
            return failure(nodeId, titleDe, e.getClass().getSimpleName() + ": " + e.getMessage(), elapsedMs);
        }
    }

    private NodeOutcome failure(long nodeId, String titleDe, String detail, long elapsedMs) {
        return new NodeOutcome(nodeId, titleDe, "FAILED", detail, null, elapsedMs);
    }

    private List<Map<String, Object>> findEmptyNodes(String industry, String cefrLevel, int limit) {
        StringBuilder sql = new StringBuilder("""
                SELECT id, title_de, industry, cefr_level, vocab_strategy,
                       industry_vocab_percent, day_number, grammar_points
                FROM skill_tree_nodes
                WHERE content_json IS NULL
                  AND is_active = TRUE
                  AND node_type = 'SATELLITE_LEAF'
                """);
        List<Object> args = new ArrayList<>(3);
        if (industry != null) {
            sql.append(" AND industry = ?");
            args.add(industry);
        }
        if (cefrLevel != null) {
            sql.append(" AND cefr_level = ?");
            args.add(cefrLevel);
        }
        // ORDER BY id: thứ tự tất định ⇒ chạy lô nối tiếp nhau đi tuần tự, không nhảy cóc bỏ sót.
        sql.append(" ORDER BY id LIMIT ?");
        args.add(limit);
        return jdbcTemplate.queryForList(sql.toString(), args.toArray());
    }

    private int clampLimit(Integer requested) {
        if (requested == null) {
            return DEFAULT_LIMIT;
        }
        if (requested <= 0) {
            throw new BadRequestException("limit phải > 0");
        }
        return Math.min(MAX_LIMIT, requested);
    }

    /** {@code grammar_points} lưu dạng text của mảng JSON — lấy phần chữ cho prompt. */
    private static String grammarContext(Object raw) {
        if (raw instanceof String s && !s.isBlank()) {
            String cleaned = s.replaceAll("[\\[\\]\"]", "").trim();
            if (!cleaned.isEmpty()) {
                return cleaned;
            }
        }
        return "Allgemein";
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private static String str(Object v, String fallback) {
        return (v instanceof String s && !s.isBlank()) ? s : fallback;
    }

    private static int intOr(Object v, int fallback) {
        return (v instanceof Number n) ? n.intValue() : fallback;
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 không khả dụng", e);
        }
    }
}
