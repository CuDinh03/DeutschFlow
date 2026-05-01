package com.deutschflow.vocabulary.service;

import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.RequestContext;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Auto-classifies words into topic taxonomy tags: keyword overlap first (cheap),
 * then LLM batch for lemmas not matched by rules.
 *
 * <p>Taxonomy scope = tags where {@code is_topic_taxonomy = 1}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class VocabularyAutoTaggingService {

    private static final int DEFAULT_BATCH_SIZE = 40;

    private final JdbcTemplate jdbc;
    private final OpenAiChatClient llmClient;
    private final ObjectMapper objectMapper;
    private final TagQueryService tagQueryService;
    private final TopicKeywordRuleService topicKeywordRuleService;
    private final AiUsageLedgerService aiUsageLedgerService;

    // ──────────────────────────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Runs a batch auto-tagging pass.
     *
     * @param limit     max words to process (null = no limit, careful!)
     * @param dryRun    if true, returns preview without writing to DB
     * @param resetTags if true, clears existing taxonomy tags from all words first
     * @return summary map with counts and (when dryRun) preview data
     */
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> runBatch(long actorUserId, Integer limit, boolean dryRun, boolean resetTags) {
        List<String> taxonomy = tagQueryService.listTopicTaxonomyTagNames();
        if (taxonomy.isEmpty()) {
            return Map.of(
                    "status", "error",
                    "message", "No topic taxonomy tags (is_topic_taxonomy=1). Run V31+V46 migrations.");
        }

        if (resetTags && !dryRun) {
            clearTopicTaxonomyLinks();
            log.info("[AutoTag] Cleared topic taxonomy links from word_tags");
        }

        List<Map<String, Object>> words = fetchUntaggedWords(limit == null ? 10_000 : limit);
        log.info("[AutoTag] Processing {} words without topic tags (dryRun={})", words.size(), dryRun);

        int totalTagged = 0;
        int totalTagLinks = 0;
        int keywordTaggedWords = 0;
        List<Map<String, Object>> preview = new ArrayList<>();
        Set<String> taxSet = new HashSet<>(taxonomy);

        int batchSize = DEFAULT_BATCH_SIZE;
        for (int i = 0; i < words.size(); i += batchSize) {
            List<Map<String, Object>> batch = words.subList(i, Math.min(i + batchSize, words.size()));

            Map<Long, List<String>> assignments = new LinkedHashMap<>();
            Set<Long> solvedByKeyword = new HashSet<>();
            List<Map<String, Object>> llmTodo = new ArrayList<>();

            for (Map<String, Object> row : batch) {
                long wordId = ((Number) row.get("id")).longValue();
                String baseForm = Objects.toString(row.get("base_form"), "");
                String meaning = row.get("meaning") != null ? Objects.toString(row.get("meaning"), "") : "";
                List<String> fromRules = topicKeywordRuleService.inferTags(baseForm, meaning, taxSet);
                if (!fromRules.isEmpty()) {
                    assignments.put(wordId, fromRules);
                    solvedByKeyword.add(wordId);
                } else {
                    llmTodo.add(row);
                }
            }

            if (!llmTodo.isEmpty()) {
                Map<Long, List<String>> fromLlm = classifyBatch(actorUserId, llmTodo, taxonomy);
                for (var e : fromLlm.entrySet()) {
                    assignments.putIfAbsent(e.getKey(), e.getValue());
                }
            }

            keywordTaggedWords += solvedByKeyword.size();

            for (var entry : assignments.entrySet()) {
                long wordId = entry.getKey();
                List<String> tags = entry.getValue();
                if (tags.isEmpty()) continue;

                totalTagged++;
                totalTagLinks += tags.size();

                if (dryRun) {
                    Optional<Map<String, Object>> w = batch.stream()
                            .filter(r -> ((Number) r.get("id")).longValue() == wordId)
                            .findFirst();
                    preview.add(Map.of(
                            "wordId", wordId,
                            "baseForm", w.map(r -> r.get("base_form")).orElse("?"),
                            "tags", tags,
                            "source", solvedByKeyword.contains(wordId) ? "keyword" : "llm"
                    ));
                } else {
                    applyTags(wordId, tags, taxonomy);
                }
            }
            log.info("[AutoTag] Batch {}/{} processed", Math.min(i + batchSize, words.size()), words.size());
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "ok");
        result.put("dryRun", dryRun);
        result.put("wordsProcessed", words.size());
        result.put("wordsTagged", totalTagged);
        result.put("tagLinksCreated", totalTagLinks);
        result.put("keywordClassifiedWords", keywordTaggedWords);
        if (dryRun) result.put("preview", preview);
        return result;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────────────────────────────────

    /** Words with no topic-taxonomy tags (may still carry import/source tags). */
    private List<Map<String, Object>> fetchUntaggedWords(int limit) {
        String sql = """
                SELECT w.id, w.base_form, w.cefr_level,
                       COALESCE(wt_vi.meaning, wt_en.meaning, wt_de.meaning) AS meaning
                FROM words w
                LEFT JOIN word_translations wt_vi ON wt_vi.word_id = w.id AND wt_vi.locale = 'vi'
                LEFT JOIN word_translations wt_en ON wt_en.word_id = w.id AND wt_en.locale = 'en'
                LEFT JOIN word_translations wt_de ON wt_de.word_id = w.id AND wt_de.locale = 'de'
                WHERE NOT EXISTS (
                    SELECT 1 FROM word_tags wt2
                    JOIN tags t2 ON t2.id = wt2.tag_id AND t2.is_topic_taxonomy = 1
                    WHERE wt2.word_id = w.id
                )
                ORDER BY w.id
                LIMIT ?
                """;
        return jdbc.queryForList(sql, limit);
    }

    /** Deletes only topic-facet rows; leaves import/other tags intact. */
    private void clearTopicTaxonomyLinks() {
        jdbc.update("""
                DELETE wt FROM word_tags wt
                INNER JOIN tags t ON t.id = wt.tag_id
                WHERE t.is_topic_taxonomy = 1
                """);
    }

    /**
     * Calls the LLM with a batch of words and parses the tag assignments.
     * Returns a map of word_id → list of valid taxonomy tag names.
     */
    /**
     * LLM tagging for admin-maintained vocab is platform spend (same OpenAI/Groq key as learners),
     * not debited against the invoking admin user's learner quota. Admins commonly sit on plan
     * {@code DEFAULT} with {@code daily_token_grant = 0}; pre-checking their quota silently
     * dropped every classification (keywords could still succeed).
     */
    private Map<Long, List<String>> classifyBatch(long actorUserId, List<Map<String, Object>> batch, List<String> taxonomy) {
        if (batch.isEmpty()) {
            return Map.of();
        }
        String systemPrompt = buildSystemPrompt(taxonomy);
        String userPrompt   = buildUserPrompt(batch);

        try {
            int maxTokens = 600;
            var ai = llmClient.chatCompletion(
                    List.of(new ChatMessage("system", systemPrompt),
                            new ChatMessage("user", userPrompt)),
                    null, 0.0, maxTokens);
            String raw = ai.content();

            try {
                if (ai.usage() != null) {
                    aiUsageLedgerService.record(
                            actorUserId,
                            ai.provider(),
                            ai.model(),
                            ai.usage().promptTokens(),
                            ai.usage().completionTokens(),
                            ai.usage().totalTokens(),
                            "VOCAB_AUTO_TAG",
                            RequestContext.requestIdOrNull(),
                            null
                    );
                }
            } catch (Exception ledgerEx) {
                log.warn("[AutoTag] Skip token usage ledger due to error: {}", ledgerEx.getMessage());
            }

            return parseResponse(raw, taxonomy);
        } catch (Exception e) {
            log.error("[AutoTag] LLM batch failed: {}", e.getMessage());
            return Map.of();
        }
    }

    private String buildSystemPrompt(List<String> taxonomy) {
        return """
                You are a German vocabulary classifier. For each word given, choose 1-3 topic tags
                from the following taxonomy (German names, strictly no others):
                %s

                Return ONLY a valid JSON object mapping each word_id (as string key) to an array of matching tag names.
                Example: {"123": ["Reise", "Alltag"], "456": ["Beruf"]}
                No markdown, no explanation, just the JSON object.
                """.formatted(String.join(", ", taxonomy));
    }

    private String buildUserPrompt(List<Map<String, Object>> batch) {
        StringBuilder sb = new StringBuilder("Classify these German words:\n");
        for (Map<String, Object> row : batch) {
            long id      = ((Number) row.get("id")).longValue();
            String form = Objects.toString(row.get("base_form"), "");
            String meaning = row.get("meaning") != null ? Objects.toString(row.get("meaning"), "") : "";
            sb.append(id).append(": ").append(form);
            if (!meaning.isBlank()) sb.append(" — ").append(meaning);
            sb.append('\n');
        }
        return sb.toString();
    }

    private Map<Long, List<String>> parseResponse(String raw, List<String> taxonomy) {
        // Extract first JSON object from response (LLM may add prose)
        int start = raw.indexOf('{');
        int end   = raw.lastIndexOf('}');
        if (start < 0 || end < 0) {
            log.warn("[AutoTag] No JSON object found in LLM response: {}", raw.substring(0, Math.min(200, raw.length())));
            return Map.of();
        }
        String json = raw.substring(start, end + 1);

        try {
            Map<String, Object> parsed = objectMapper.readValue(json, new TypeReference<>() {});
            Map<Long, List<String>> result = new LinkedHashMap<>();
            Set<String> validTags = new HashSet<>(taxonomy);

        for (var entry : parsed.entrySet()) {
            long wordId;
            try { wordId = Long.parseLong(entry.getKey()); } catch (NumberFormatException ignored) { continue; }

                List<String> tags;
                if (entry.getValue() instanceof List<?> rawList) {
                    tags = rawList.stream()
                            .filter(t -> t instanceof String)
                            .map(t -> (String) t)
                            .filter(validTags::contains)
                            .collect(Collectors.toList());
                } else {
                    continue;
                }
                if (!tags.isEmpty()) result.put(wordId, tags);
            }
            return result;
        } catch (Exception e) {
            log.warn("[AutoTag] Failed to parse LLM JSON response: {}", e.getMessage());
            return Map.of();
        }
    }

    /** Ensures tags exist in DB and inserts word_tags rows. */
    @Transactional
    protected void applyTags(long wordId, List<String> tagNames, List<String> taxonomy) {
        Set<String> allowed = new HashSet<>(taxonomy);
        for (String tagName : tagNames) {
            if (!allowed.contains(tagName)) {
                continue;
            }
            // Get or create tag (taxonomy tags are seeded in V31 — this is a safety net)
            Long tagId = jdbc.query(
                    "SELECT id FROM tags WHERE name = ?",
                    rs -> rs.next() ? rs.getLong(1) : null,
                    tagName);
            if (tagId == null) {
                jdbc.update("INSERT IGNORE INTO tags (name) VALUES (?)", tagName);
                tagId = jdbc.queryForObject("SELECT id FROM tags WHERE name = ?", Long.class, tagName);
            }
            if (tagId == null) continue;
            jdbc.update("INSERT IGNORE INTO word_tags (word_id, tag_id) VALUES (?, ?)", wordId, tagId);
        }
    }
}
