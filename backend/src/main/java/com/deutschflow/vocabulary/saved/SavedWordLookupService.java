package com.deutschflow.vocabulary.saved;

import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.common.exception.RateLimitExceededException;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.RequestContext;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.exception.AiServiceException;
import com.deutschflow.vocabulary.service.TagQueryService;
import com.deutschflow.vocabulary.service.TopicKeywordRuleService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Tìm dạng gốc + nghĩa tiếng Việt + chủ đề cho chữ học viên bôi đen khi lưu từ (owner chốt 13/11/2026:
 * "kho trước, thiếu thì AI").
 *
 * <ol>
 *   <li><b>Kho</b> ({@code words}): khớp dạng gốc, dạng biến cách danh từ hoặc Partizip II — không tốn AI.</li>
 *   <li><b>Bộ nhớ dùng chung</b> ({@code vocab_lookup_cache}): chữ này đã có người tra bằng AI.</li>
 *   <li><b>AI</b> (tầng EXPLAIN): giải nghĩa theo câu đang đọc, trả cả dạng gốc + chủ đề trong bộ chủ đề
 *       sẵn của kho. Không trừ hạn mức AI của học viên, nhưng có trần {@code ai-daily-cap} lượt / ngày.</li>
 * </ol>
 *
 * <p>Chủ đề: tag chủ đề của chính từ trong kho → chủ đề AI trả (chỉ khi đã gọi AI / có trong bộ nhớ) → luật
 * từ khoá ({@link TopicKeywordRuleService}) → {@code null} = "Chưa phân loại".
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SavedWordLookupService {

    static final String FEATURE = "VOCAB_SAVE_LOOKUP";
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final Set<String> ARTICLES = Set.of("der", "die", "das");
    private static final Set<String> POS = Set.of("NOUN", "VERB", "ADJ", "ADV", "PHRASE", "OTHER");
    private static final Pattern LEMMA = Pattern.compile("^[\\p{L}][\\p{L}\\-'’ ]{0,118}[\\p{L}]?$");

    private final JdbcTemplate jdbc;
    private final OpenAiChatClient llmClient;
    private final LlmTierResolver llmTierResolver;
    private final AiUsageLedgerService ledger;
    private final TagQueryService tagQueryService;
    private final TopicKeywordRuleService topicKeywordRuleService;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    @Value("${app.vocabulary.saved-words.ai-daily-cap:40}")
    private int aiDailyCap;

    /** Kết quả tra. {@code wordId} null = từ ngoài kho. */
    public record Lookup(String lemma, String article, String pos, String meaning, Long wordId,
                         String topic, String topicSource, String meaningSource, boolean aiCalled) {}

    /**
     * @param surface  chữ đã chuẩn hoá (xem {@link SavedWordText#normalizeSurface})
     * @param sentence câu chứa chữ đó (có thể rỗng)
     */
    public Lookup lookup(long userId, String surface, String sentence) {
        Set<String> taxonomy = new HashSet<>(tagQueryService.listTopicTaxonomyTagNames());

        KhoWord kho = findInKho(surface);
        if (kho != null && hasMeaning(kho.meaning())) {
            return fromKho(kho, taxonomy);
        }

        Lookup cached = fromCache(surface, taxonomy, kho);
        if (cached != null) return cached;

        assertUnderDailyCap(userId);
        AiResult ai = askAi(userId, surface, sentence, taxonomy);
        cache(surface, ai);

        // AI trả dạng gốc có trong kho (vd. bôi "fuhr" ⇒ "fahren") ⇒ dùng mục kho cho khớp phần còn lại
        // của app (mạo từ, nghĩa chuẩn, chủ đề), chỉ lấy nghĩa AI khi kho thiếu nghĩa.
        KhoWord byLemma = kho != null ? kho : findInKho(ai.lemma());
        if (byLemma != null) {
            String meaning = hasMeaning(byLemma.meaning()) ? byLemma.meaning().trim() : ai.meaning();
            String source = hasMeaning(byLemma.meaning()) ? "KHO" : "AI";
            Topic t = topicFor(byLemma.id(), byLemma.baseForm(), meaning, taxonomy, ai.topic());
            return new Lookup(byLemma.baseForm(), byLemma.article() != null ? byLemma.article() : ai.article(),
                    byLemma.pos() != null ? byLemma.pos() : ai.pos(), meaning, byLemma.id(),
                    t.name(), t.source(), source, true);
        }
        Topic t = topicFor(null, ai.lemma(), ai.meaning(), taxonomy, ai.topic());
        return new Lookup(ai.lemma(), ai.article(), ai.pos(), ai.meaning(), null, t.name(), t.source(), "AI", true);
    }

    // ── kho ──────────────────────────────────────────────────────────────────

    record KhoWord(long id, String baseForm, String article, String pos, String meaning) {}

    KhoWord findInKho(String text) {
        if (text == null || text.isBlank()) return null;
        String key = text.toLowerCase(Locale.ROOT);
        List<KhoWord> rows = jdbc.query("""
                SELECT w.id, w.base_form, w.dtype, n.gender, vi.meaning
                FROM words w
                LEFT JOIN nouns n ON n.id = w.id
                LEFT JOIN word_translations vi ON vi.word_id = w.id AND vi.locale = 'vi'
                WHERE w.id IN (
                    SELECT id FROM words WHERE LOWER(base_form) = ?
                    UNION SELECT noun_id FROM noun_declension_forms WHERE LOWER(form) = ?
                    UNION SELECT id FROM verbs WHERE LOWER(partizip2) = ?
                )
                ORDER BY (w.base_form = ?) DESC, (LOWER(w.base_form) = ?) DESC,
                         (vi.meaning IS NULL OR TRIM(vi.meaning) = '') ASC, w.id
                LIMIT 1
                """, (rs, i) -> new KhoWord(
                        rs.getLong("id"),
                        rs.getString("base_form"),
                        articleOf(rs.getString("gender")),
                        posOf(rs.getString("dtype")),
                        rs.getString("meaning")),
                key, key, key, text, key);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private Lookup fromKho(KhoWord kho, Set<String> taxonomy) {
        Topic t = topicFor(kho.id(), kho.baseForm(), kho.meaning(), taxonomy, null);
        return new Lookup(kho.baseForm(), kho.article(), kho.pos(), kho.meaning().trim(), kho.id(),
                t.name(), t.source(), "KHO", false);
    }

    static boolean hasMeaning(String m) {
        if (m == null || m.isBlank()) return false;
        String l = m.toLowerCase(Locale.ROOT);
        return !l.startsWith("not in wordlists") && !l.startsWith("chua co trong") && !l.startsWith("chưa có trong");
    }

    static String articleOf(String gender) {
        if (gender == null) return null;
        String a = gender.trim().toLowerCase(Locale.ROOT);
        return ARTICLES.contains(a) ? a : null;
    }

    static String posOf(String dtype) {
        if (dtype == null) return null;
        String d = dtype.toUpperCase(Locale.ROOT);
        if (d.contains("NOUN")) return "NOUN";
        if (d.contains("VERB")) return "VERB";
        if (d.contains("ADJ")) return "ADJ";
        if (d.contains("ADV")) return "ADV";
        return "OTHER";
    }

    // ── chủ đề ───────────────────────────────────────────────────────────────

    record Topic(String name, String source) {}

    private Topic topicFor(Long wordId, String lemma, String meaning, Set<String> taxonomy, String aiTopic) {
        if (wordId != null) {
            List<String> tags = jdbc.queryForList("""
                    SELECT t.name FROM word_tags wt
                    JOIN tags t ON t.id = wt.tag_id AND t.is_topic_taxonomy IS TRUE
                    WHERE wt.word_id = ?
                    ORDER BY t.name
                    LIMIT 1
                    """, String.class, wordId);
            if (!tags.isEmpty()) return new Topic(tags.get(0), "KHO");
        }
        // Chủ đề AI (chọn theo câu, trong bộ sẵn) đứng trước luật từ khoá: luật so khớp CHUỖI CON nên dễ
        // trúng nhầm (từ khoá "ei" của Essen khớp cả "teilnehmen").
        if (aiTopic != null && taxonomy.contains(aiTopic)) return new Topic(aiTopic, "AI");
        List<String> fromRules = topicKeywordRuleService.inferTagsStrict(lemma, meaning, taxonomy);
        if (!fromRules.isEmpty()) return new Topic(fromRules.get(0), "RULE");
        return new Topic(null, "NONE");
    }

    // ── bộ nhớ dùng chung ────────────────────────────────────────────────────

    private Lookup fromCache(String surface, Set<String> taxonomy, KhoWord kho) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT lemma, article, pos, meaning_vi, topic FROM vocab_lookup_cache WHERE surface_key = ?",
                key(surface));
        if (rows.isEmpty()) return null;
        Map<String, Object> r = rows.get(0);
        String lemma = Objects.toString(r.get("lemma"), surface);
        String meaning = Objects.toString(r.get("meaning_vi"), "");
        String aiTopic = (String) r.get("topic");
        KhoWord byLemma = kho != null ? kho : findInKho(lemma);
        if (byLemma != null && hasMeaning(byLemma.meaning())) {
            return fromKho(byLemma, taxonomy);
        }
        Long wordId = byLemma != null ? byLemma.id() : null;
        Topic t = topicFor(wordId, lemma, meaning, taxonomy, aiTopic);
        return new Lookup(byLemma != null ? byLemma.baseForm() : lemma,
                byLemma != null && byLemma.article() != null ? byLemma.article() : (String) r.get("article"),
                byLemma != null && byLemma.pos() != null ? byLemma.pos() : (String) r.get("pos"),
                meaning, wordId, t.name(), t.source(), "CACHE", false);
    }

    private void cache(String surface, AiResult ai) {
        try {
            jdbc.update("""
                    INSERT INTO vocab_lookup_cache (surface_key, lemma, article, pos, meaning_vi, topic, model)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (surface_key) DO NOTHING
                    """, key(surface), ai.lemma(), ai.article(), ai.pos(), ai.meaning(), ai.topic(), ai.model());
        } catch (Exception e) {
            log.warn("[SavedWord] Không ghi được bộ nhớ tra nghĩa: {}", e.getMessage());
        }
    }

    static String key(String surface) {
        String k = surface.toLowerCase(Locale.ROOT);
        return k.length() > 120 ? k.substring(0, 120) : k;
    }

    // ── AI ───────────────────────────────────────────────────────────────────

    private void assertUnderDailyCap(long userId) {
        ZonedDateTime now = ZonedDateTime.now(clock).withZoneSameInstant(VN);
        ZonedDateTime dayStart = LocalDate.from(now).atStartOfDay(VN);
        Long used = jdbc.queryForObject("""
                SELECT COUNT(*) FROM user_saved_words
                WHERE user_id = ? AND ai_lookup AND created_at >= ?
                """, Long.class, userId, dayStart.toOffsetDateTime());
        if (used != null && used >= aiDailyCap) {
            long retry = Math.max(60, Duration.between(now, dayStart.plusDays(1)).getSeconds());
            throw new RateLimitExceededException(
                    "Hôm nay bạn đã lưu " + aiDailyCap + " từ cần tra nghĩa mới. Từ có sẵn trong kho vẫn lưu được; "
                            + "từ mới hãy thử lại vào ngày mai.",
                    (int) Math.min(Integer.MAX_VALUE, retry));
        }
    }

    record AiResult(String lemma, String article, String pos, String meaning, String topic, String model) {}

    private AiResult askAi(long userId, String surface, String sentence, Set<String> taxonomy) {
        String system = """
                You are a German–Vietnamese dictionary for learners preparing for telc B1.
                The learner selected a word or short phrase in a German reading text.
                Return ONLY a JSON object, no markdown:
                {"lemma": "...", "article": "der|die|das|null", "pos": "NOUN|VERB|ADJ|ADV|PHRASE|OTHER",
                 "meaning_vi": "...", "topic": "..."}
                Rules:
                - lemma: dictionary form (nouns singular nominative without article; verbs infinitive,
                  separable verbs joined, e.g. "nimmt ... teil" -> "teilnehmen"; adjectives uninflected).
                - article: only for nouns, else null.
                - meaning_vi: short natural Vietnamese meaning (1-6 words) that fits THIS sentence.
                - topic: exactly one of [%s], or null if none fits.
                """.formatted(String.join(", ", taxonomy.stream().sorted().toList()));
        String user = "Selected: " + surface + "\nSentence: " + (sentence == null || sentence.isBlank() ? "(none)" : sentence);

        AiChatCompletionResult res;
        try {
            res = llmClient.chatCompletionForTier(
                    List.of(new ChatMessage("system", system), new ChatMessage("user", user)),
                    llmTierResolver.spec(LlmTier.EXPLAIN), 0.0, 400);
        } catch (AiServiceException e) {
            throw e;
        } catch (Exception e) {
            log.warn("[SavedWord] Tra nghĩa AI lỗi: {}", e.getMessage());
            throw new AiServiceException("Chưa tra được nghĩa từ này lúc này. Bạn thử lại sau ít phút nhé.", e);
        }
        try {
            ledger.recordWithoutCharge(userId, res.provider(), res.model(), res.usage(), FEATURE,
                    RequestContext.requestIdOrNull());
        } catch (Exception e) {
            log.warn("[SavedWord] Bỏ qua ghi ledger: {}", e.getMessage());
        }
        AiResult parsed = parse(res.content(), surface, taxonomy, res.model());
        if (parsed == null) {
            throw new AiServiceException("Chưa tra được nghĩa từ này lúc này. Bạn thử lại sau ít phút nhé.");
        }
        return parsed;
    }

    AiResult parse(String raw, String surface, Set<String> taxonomy, String model) {
        if (raw == null) return null;
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) return null;
        Map<String, Object> m;
        try {
            m = objectMapper.readValue(raw.substring(start, end + 1), new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("[SavedWord] JSON AI không đọc được: {}", e.getMessage());
            return null;
        }
        String meaning = clean(m.get("meaning_vi"));
        if (meaning == null || meaning.length() > 200) return null;
        String lemma = clean(m.get("lemma"));
        if (lemma == null || lemma.length() > 120 || !LEMMA.matcher(lemma).matches()) lemma = surface;
        // Set.of(...).contains(null) ném NPE — AI trả "article": null cho động từ là chuyện thường.
        String article = clean(m.get("article"));
        article = article == null ? null : article.toLowerCase(Locale.ROOT);
        if (article != null && !ARTICLES.contains(article)) article = null;
        String pos = clean(m.get("pos"));
        pos = pos == null ? null : pos.toUpperCase(Locale.ROOT);
        if (pos == null || !POS.contains(pos)) pos = "OTHER";
        if (!"NOUN".equals(pos)) article = null;
        String topic = clean(m.get("topic"));
        if (topic != null && !taxonomy.contains(topic)) topic = null;
        return new AiResult(lemma, article, pos, meaning, topic, model);
    }

    private static String clean(Object v) {
        if (v == null) return null;
        String s = v.toString().trim();
        return s.isEmpty() || "null".equalsIgnoreCase(s) ? null : s;
    }
}
