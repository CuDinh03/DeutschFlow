package com.deutschflow.vocabulary.galerie.service;

import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.vocabulary.galerie.GalerieFamily;
import com.deutschflow.vocabulary.galerie.GaleriePromptFactory;
import com.deutschflow.vocabulary.galerie.dto.GalerieConceptBatchResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Bước 1 pipeline Galerie (spec mục 22): word → semantic family + visualConcept, persist vào
 * {@code words.image_family/image_concept}, status = {@code CONCEPT_READY}.
 *
 * <p>KHÔNG mở transaction quanh vòng lặp LLM (bài học audit S-8/P-16 của aiimage): mỗi lời gọi
 * chat chậm hàng giây, giữ Hikari connection suốt vòng là cạn pool. Mỗi từ UPDATE độc lập; lỗi
 * một từ không ghi gì — concept vẫn NULL nên lượt sau tự retry.
 *
 * <p>Bộ lọc data bẩn (đính chính 16/08 — phần hỏng đáng kể nằm ở Ô NGHĨA, không phải lemma):
 * loại từ có nghĩa rỗng, nghĩa chứa ký tự điều khiển/xuống dòng, nghĩa dài bất thường (nhồi
 * trích dẫn Wiktionary), và lemma dính ký tự điều khiển (TAB). Dùng lớp POSIX {@code [:cntrl:]}
 * qua JdbcTemplate — tránh hẳn bẫy Hibernate nuốt {@code ::} của native query.
 *
 * <p>Schema thật (hotfix 16/08 — ERR-1 prod): {@code words} KHÔNG có cột {@code meaning} hay
 * {@code gender}. Nghĩa nằm ở {@code word_translations} (UNIQUE word_id+locale; ưu tiên vi,
 * fallback en); gender nằm ở {@code nouns.gender} (JOINED inheritance, {@code nouns.id = words.id}).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GalerieConceptService {

    static final String FEATURE = "galerie.concept";
    static final String STATUS_CONCEPT_READY = "CONCEPT_READY";
    /** Nghĩa dài hơn ngưỡng này gần như chắc chắn là nghĩa nhồi trích dẫn — không đưa vào batch. */
    static final int MAX_MEANING_LENGTH = 120;
    private static final int MAX_BATCH = 200;
    private static final int MAX_FAILURE_DETAILS = 20;
    private static final int MAX_CONCEPT_LENGTH = 600;
    private static final double TEMPERATURE = 0.4;
    private static final int MAX_TOKENS = 300;

    /** Nghĩa hiển thị cho concept: ưu tiên tiếng Việt, fallback tiếng Anh. */
    private static final String MEANING_EXPR = "COALESCE(t_vi.meaning, t_en.meaning)";

    private static final String FROM_WORDS_JOINED = """
            FROM words w
            LEFT JOIN nouns n ON n.id = w.id
            LEFT JOIN word_translations t_vi ON t_vi.word_id = w.id AND t_vi.locale = 'vi'
            LEFT JOIN word_translations t_en ON t_en.word_id = w.id AND t_en.locale = 'en'
            """;

    private static final String CLEAN_WORD_FILTER = """
             AND %1$s IS NOT NULL AND btrim(%1$s) <> ''
             AND length(%1$s) <= %2$d
             AND %1$s !~ '[[:cntrl:]]'
             AND w.base_form !~ '[[:cntrl:]]'
            """.formatted(MEANING_EXPR, MAX_MEANING_LENGTH);

    private final JdbcTemplate jdbcTemplate;
    private final OpenAiChatClient chatClient;
    private final LlmTierResolver llmTierResolver;
    private final GaleriePromptFactory promptFactory;
    private final AiUsageLedgerService aiUsageLedgerService;
    private final ObjectMapper objectMapper;

    /** Sinh concept cho các từ sạch còn thiếu, ưu tiên tần suất cao trước. */
    public GalerieConceptBatchResponse generateForMissing(int limit, String cefr, Long adminUserId) {
        int effectiveLimit = Math.min(Math.max(1, limit), MAX_BATCH);
        StringBuilder sql = new StringBuilder("""
                SELECT w.id, w.base_form, n.gender, w.dtype, w.cefr_level, %s AS meaning
                """.formatted(MEANING_EXPR))
                .append(FROM_WORDS_JOINED)
                .append("WHERE w.image_concept IS NULL\n")
                .append(CLEAN_WORD_FILTER);
        List<Object> args = new ArrayList<>();
        if (cefr != null && !cefr.isBlank()) {
            sql.append(" AND w.cefr_level = ?");
            args.add(cefr.trim().toUpperCase());
        }
        sql.append(" ORDER BY w.frequency_rank ASC NULLS LAST, w.id ASC LIMIT ?");
        args.add(effectiveLimit);

        List<Map<String, Object>> candidates = jdbcTemplate.queryForList(sql.toString(), args.toArray());
        return process(candidates, cefr, adminUserId);
    }

    /** Sinh concept cho danh sách id cụ thể (pilot 30 từ spec mục 30) — bỏ qua ưu tiên tần suất, giữ bộ lọc sạch. */
    public GalerieConceptBatchResponse generateForWordIds(List<Long> wordIds, Long adminUserId) {
        if (wordIds == null || wordIds.isEmpty()) {
            return new GalerieConceptBatchResponse(0, 0, 0, countMissing(null), List.of());
        }
        List<Long> capped = wordIds.stream().distinct().limit(MAX_BATCH).toList();
        String placeholders = String.join(",", java.util.Collections.nCopies(capped.size(), "?"));
        String sql = """
                SELECT w.id, w.base_form, n.gender, w.dtype, w.cefr_level, %s AS meaning
                """.formatted(MEANING_EXPR)
                + FROM_WORDS_JOINED
                + "WHERE w.id IN (%s)\n".formatted(placeholders)
                + CLEAN_WORD_FILTER + " ORDER BY w.id ASC";
        List<Map<String, Object>> candidates = jdbcTemplate.queryForList(sql, capped.toArray());
        return process(candidates, null, adminUserId);
    }

    public int countMissing(String cefr) {
        StringBuilder sql = new StringBuilder("SELECT COUNT(*)\n")
                .append(FROM_WORDS_JOINED)
                .append("WHERE w.image_concept IS NULL\n")
                .append(CLEAN_WORD_FILTER);
        List<Object> args = new ArrayList<>();
        if (cefr != null && !cefr.isBlank()) {
            sql.append(" AND w.cefr_level = ?");
            args.add(cefr.trim().toUpperCase());
        }
        Integer count = jdbcTemplate.queryForObject(sql.toString(), Integer.class, args.toArray());
        return count == null ? 0 : count;
    }

    private GalerieConceptBatchResponse process(List<Map<String, Object>> candidates,
                                                String cefr, Long adminUserId) {
        int succeeded = 0;
        List<GalerieConceptBatchResponse.FailureDetail> failures = new ArrayList<>();

        for (Map<String, Object> row : candidates) {
            long wordId = ((Number) row.get("id")).longValue();
            String baseForm = String.valueOf(row.get("base_form"));
            try {
                ParsedConcept parsed = requestConcept(row, adminUserId);
                jdbcTemplate.update("""
                        UPDATE words
                        SET image_family = ?, image_concept = ?, image_status = ?, image_updated_at = NOW()
                        WHERE id = ?
                        """, parsed.family().name(), parsed.concept(), STATUS_CONCEPT_READY, wordId);
                succeeded++;
            } catch (Exception e) {
                log.warn("[Galerie] concept thất bại wordId={} baseForm={}: {}", wordId, baseForm, e.getMessage());
                if (failures.size() < MAX_FAILURE_DETAILS) {
                    failures.add(new GalerieConceptBatchResponse.FailureDetail(wordId, baseForm, e.getMessage()));
                }
            }
        }

        int failed = candidates.size() - succeeded;
        return new GalerieConceptBatchResponse(candidates.size(), succeeded, failed, countMissing(cefr), failures);
    }

    private ParsedConcept requestConcept(Map<String, Object> row, Long adminUserId) {
        AiChatCompletionResult result = chatClient.chatCompletionForTier(
                promptFactory.conceptMessages(
                        stringOrNull(row.get("base_form")),
                        stringOrNull(row.get("gender")),
                        stringOrNull(row.get("dtype")),
                        stringOrNull(row.get("meaning")),
                        stringOrNull(row.get("cefr_level"))),
                llmTierResolver.spec(LlmTier.BATCH),
                TEMPERATURE, MAX_TOKENS, true);

        if (adminUserId != null && result.usage() != null) {
            aiUsageLedgerService.record(adminUserId, result.provider(), result.model(),
                    result.usage(), FEATURE, null, null);
        }
        return parse(result.content());
    }

    /** Package-private để unit-test trực tiếp logic parse/validate không cần mock LLM. */
    ParsedConcept parse(String content) {
        if (content == null || content.isBlank()) {
            throw new IllegalStateException("LLM trả nội dung rỗng");
        }
        JsonNode node;
        try {
            node = objectMapper.readTree(content.trim());
        } catch (Exception e) {
            throw new IllegalStateException("LLM trả JSON không hợp lệ: " + snippet(content));
        }
        GalerieFamily family = GalerieFamily.fromLlm(node.path("family").asText(null));
        if (family == null) {
            throw new IllegalStateException("family không hợp lệ: " + snippet(node.path("family").asText("")));
        }
        String concept = node.path("concept").asText(null);
        if (concept == null || concept.isBlank()) {
            throw new IllegalStateException("concept rỗng");
        }
        concept = concept.trim().replaceAll("\\s+", " ");
        if (concept.length() > MAX_CONCEPT_LENGTH) {
            throw new IllegalStateException("concept dài bất thường (" + concept.length() + " ký tự)");
        }
        return new ParsedConcept(family, concept);
    }

    record ParsedConcept(GalerieFamily family, String concept) {}

    private static String stringOrNull(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static String snippet(String value) {
        String v = value == null ? "" : value.trim();
        return v.length() <= 80 ? v : v.substring(0, 80) + "…";
    }
}
