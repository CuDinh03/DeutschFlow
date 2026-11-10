package com.deutschflow.grammar.service;

import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.exception.RateLimitExceededException;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.common.quota.RequestContext;
import com.deutschflow.grammar.dto.PracticeDtos;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.speaking.AiRateLimiterService;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.exception.AiServiceException;
import com.deutschflow.user.entity.User;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * "Hỏi AI về câu này" ở màn xem lại sau khi nộp (B3, 09/11/2026) — cho Teil khách quan (Lesen,
 * Sprachbausteine, Hören) của chế độ luyện Teil và của lượt thi thử.
 *
 * <p>Luồng một lần hỏi:
 * <ol>
 *   <li>Quyền: Teil/lượt phải là của chính người hỏi ({@code 404} nếu không) và đã nộp ({@code 409} nếu chưa) —
 *       xem {@link MockExamPracticeService#practiceReview} / {@link MockExamPracticeService#attemptReview}.</li>
 *   <li>Ngữ cảnh: {@link PracticeAnalysis} (đáp án đã chọn, đáp án đúng, giải thích sẵn) + đoạn văn/lời nghe
 *       ({@link ExamItemAiPrompt}).</li>
 *   <li>Bộ nhớ đệm {@code exam_item_ai_explanations} theo (đề, Teil, câu, đáp án đã chọn, ngôn ngữ, hash
 *       ngữ cảnh). Có sẵn ⇒ trả ngay: KHÔNG gọi AI, KHÔNG giới hạn lượt, KHÔNG trừ quota.</li>
 *   <li>Chưa có ⇒ giới hạn lượt (bucket TEXT) → quota ví ({@link QuotaService#assertAllowed}, 429) → pool trung
 *       tâm ({@link OrgPoolGuard}, 429) → gọi AI tầng {@code EXPLAIN} → ghi sổ token ({@code EXAM_ITEM_EXPLAIN},
 *       trừ ví/pool theo token thật) → lưu bộ nhớ đệm.</li>
 * </ol>
 */
@Service
public class ExamItemAiService {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(ExamItemAiService.class);

    public static final String FEATURE = "EXAM_ITEM_EXPLAIN";
    /** Ước lượng cho bước kiểm quota trước khi gọi: ngữ cảnh ~1k token + trả lời ngắn. */
    static final long ESTIMATED_TOKENS = 1_500L;
    /** Model suy luận cần chừa budget "nghĩ" — câu trả lời thật chỉ ~200 token. */
    static final int MAX_COMPLETION_TOKENS = 900;
    static final int MAX_ANSWER_CHARS = 2_000;
    private static final double TEMPERATURE = 0.2;

    private final MockExamPracticeService practice;
    private final JdbcTemplate jdbc;
    private final OpenAiChatClient chatClient;
    private final LlmTierResolver tiers;
    private final QuotaService quotaService;
    private final OrgPoolGuard orgPoolGuard;
    private final AiUsageLedgerService ledger;
    private final AiRateLimiterService rateLimiter;

    public ExamItemAiService(MockExamPracticeService practice, JdbcTemplate jdbc, OpenAiChatClient chatClient,
                             LlmTierResolver tiers, QuotaService quotaService, OrgPoolGuard orgPoolGuard,
                             AiUsageLedgerService ledger, AiRateLimiterService rateLimiter) {
        this.practice = practice;
        this.jdbc = jdbc;
        this.chatClient = chatClient;
        this.tiers = tiers;
        this.quotaService = quotaService;
        this.orgPoolGuard = orgPoolGuard;
        this.ledger = ledger;
        this.rateLimiter = rateLimiter;
    }

    /** Câu của một Teil luyện đã kiểm tra. */
    public PracticeDtos.ItemAiAnswer askPractice(User user, long examId, String teilKey, String itemId, String locale) {
        return answer(user.getId(), practice.practiceReview(user, examId, teilKey), itemId, locale);
    }

    /** Câu của một lượt thi thử đã nộp / dừng giữa chừng. */
    public PracticeDtos.ItemAiAnswer askAttempt(User user, long attemptId, String teilKey, String itemId, String locale) {
        return answer(user.getId(), practice.attemptReview(user, attemptId, teilKey), itemId, locale);
    }

    PracticeDtos.ItemAiAnswer answer(long uid, MockExamPracticeService.ReviewContext ctx, String itemId, String rawLocale) {
        String lang = ExamItemAiPrompt.locale(rawLocale);
        PracticeAnalysis.TeilResult analysed =
                PracticeAnalysis.analyse(ctx.teilKey(), ctx.teil(), ctx.notes(), ctx.answers());
        PracticeAnalysis.ItemResult item = analysed.items().stream()
                .filter(i -> i.id().equals(itemId)).findFirst()
                .orElseThrow(() -> new NotFoundException("Teil không có câu " + itemId + "."));

        String context = ExamItemAiPrompt.context(ctx.teilKey(), ctx.teil(), rawItem(ctx.teil(), itemId), item);
        String hash = sha256(context);
        String chosen = item.given() == null ? "" : truncate(item.given().toLowerCase(Locale.ROOT), 40);

        List<String> cached = jdbc.queryForList("""
                SELECT answer FROM exam_item_ai_explanations
                WHERE exam_id = ? AND teil_key = ? AND item_id = ? AND chosen = ? AND locale = ? AND content_hash = ?
                """, String.class, ctx.examId(), ctx.teilKey(), itemId, chosen, lang, hash);
        if (!cached.isEmpty()) return new PracticeDtos.ItemAiAnswer(itemId, lang, cached.get(0), true);

        if (!rateLimiter.allow(AiRateLimiterService.Bucket.TEXT, uid)) {
            throw new RateLimitExceededException("Bạn hỏi AI hơi dồn dập, đợi một chút rồi thử lại nhé.",
                    rateLimiter.retryAfterSeconds(AiRateLimiterService.Bucket.TEXT, uid));
        }
        quotaService.assertAllowed(uid, Instant.now(), ESTIMATED_TOKENS);
        orgPoolGuard.assertOrgPoolAvailable(uid, ESTIMATED_TOKENS);

        AiChatCompletionResult result;
        try {
            result = chatClient.chatCompletionForTier(
                    List.of(new ChatMessage("system", ExamItemAiPrompt.system(lang)), new ChatMessage("user", context)),
                    tiers.spec(LlmTier.EXPLAIN), TEMPERATURE, MAX_COMPLETION_TOKENS, false);
        } catch (AiServiceException e) {
            throw e;
        } catch (Exception e) {
            log.error("[ExamItemAi] Gọi AI lỗi exam={} teil={} item={}: {}", ctx.examId(), ctx.teilKey(), itemId, e.getMessage());
            throw new AiServiceException("AI chưa trả lời được câu này, bạn thử lại sau nhé.", e);
        }
        recordUsage(uid, result);

        String text = clean(result == null ? null : result.content());
        if (text == null) throw new AiServiceException("AI chưa trả lời được câu này, bạn thử lại sau nhé.");

        jdbc.update("""
                INSERT INTO exam_item_ai_explanations (exam_id, teil_key, item_id, chosen, locale, content_hash, answer, model)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (exam_id, teil_key, item_id, chosen, locale, content_hash) DO NOTHING
                """, ctx.examId(), ctx.teilKey(), itemId, chosen, lang, hash, text,
                result.model() == null ? null : truncate(result.model(), 120));
        return new PracticeDtos.ItemAiAnswer(itemId, lang, text, false);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> rawItem(Map<String, Object> teil, String itemId) {
        if (teil.get("items") instanceof List<?> items) {
            for (Object o : items) {
                if (o instanceof Map<?, ?> m && itemId.equals(String.valueOf(m.get("id")))) return (Map<String, Object>) m;
            }
        }
        return Map.of();
    }

    private void recordUsage(long uid, AiChatCompletionResult result) {
        try {
            if (result != null && result.usage() != null) {
                ledger.record(uid, result.provider(), result.model(), result.usage(), FEATURE,
                        RequestContext.requestIdOrNull(), null);
            }
        } catch (Exception e) {
            log.warn("[ExamItemAi] Bỏ qua ghi sổ token: {}", e.getMessage());
        }
    }

    /** Bỏ khối suy luận lọt ra ({@code <think>}), dấu markdown đậm, khoảng trắng thừa; cắt độ dài. */
    static String clean(String content) {
        if (content == null) return null;
        String t = content.replaceAll("(?s)<think>.*?</think>", "").replace("**", "").strip();
        t = t.replaceAll("[ \\t]+", " ").replaceAll("\\n{3,}", "\n\n");
        if (t.isEmpty()) return null;
        return t.length() > MAX_ANSWER_CHARS ? t.substring(0, MAX_ANSWER_CHARS).strip() + "…" : t;
    }

    static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String truncate(String s, int max) {
        return s.length() > max ? s.substring(0, max) : s;
    }
}
