package com.deutschflow.vocabulary.galerie.service;

import com.deutschflow.media.entity.MediaAsset;
import com.deutschflow.media.service.MediaAssetService;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.speaking.exception.AiErrorCode;
import com.deutschflow.speaking.exception.AiServiceException;
import com.deutschflow.user.entity.User;
import com.deutschflow.vocabulary.galerie.GaleriePromptFactory;
import com.deutschflow.vocabulary.galerie.GalerieFamily;
import com.deutschflow.vocabulary.galerie.GalerieSvgSanitizer;
import com.deutschflow.vocabulary.galerie.dto.GalerieSvgBatchResponse;
import com.deutschflow.vocabulary.service.VocabularyImageService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Bước 2 pipeline Galerie (P2 — plan mục 12/22): word CONCEPT_READY → SVG bằng Anthropic
 * ({@code claude-fable-5}) → sanitize → S3 + {@code media_assets} → {@code words.image_url},
 * status {@code QA_PENDING} chờ admin review.
 *
 * <p>KHÔNG mở {@code @Transactional} quanh vòng lặp (bài học audit S-8/P-16): mỗi lời gọi
 * Anthropic chậm 5–15s, giữ Hikari connection suốt vòng là cạn pool. Mỗi từ là chuỗi UPDATE
 * độc lập; claim {@code GENERATING} chống hai admin chạy đè nhau, lỗi thì trả về
 * {@code CONCEPT_READY} để lượt sau retry.
 *
 * <p>Lượt này là đường SYNC cho pilot + chunk 50–100 (plan mục 18). Batch API 50% giá cho
 * full kho (~4.000 từ) thuộc P4 — server-side fallback không hỗ trợ Batches nên đường batch
 * sẽ có xử lý refusal riêng, đừng gộp vào đây.
 */
@Slf4j
@Service
public class GalerieSvgGenerationService {

    static final String FEATURE = "galerie.svg";
    static final String STATUS_CONCEPT_READY = "CONCEPT_READY";
    static final String STATUS_GENERATING = "GENERATING";
    static final String STATUS_QA_PENDING = "QA_PENDING";
    static final String STATUS_APPROVED = "APPROVED";
    static final String STATUS_REJECTED = "REJECTED";
    private static final int MAX_FAILURE_DETAILS = 20;

    /** Nghĩa hiển thị: ưu tiên vi, fallback en — cùng biểu thức với GalerieConceptService. */
    private static final String MEANING_EXPR = "COALESCE(t_vi.meaning, t_en.meaning)";
    private static final String FROM_WORDS_JOINED = """
            FROM words w
            LEFT JOIN nouns n ON n.id = w.id
            LEFT JOIN word_translations t_vi ON t_vi.word_id = w.id AND t_vi.locale = 'vi'
            LEFT JOIN word_translations t_en ON t_en.word_id = w.id AND t_en.locale = 'en'
            """;

    private final JdbcTemplate jdbcTemplate;
    private final GaleriePromptFactory promptFactory;
    private final GalerieSvgSanitizer sanitizer;
    private final GalerieAnthropicClient anthropicClient;
    private final S3StorageService s3StorageService;
    private final MediaAssetService mediaAssetService;
    private final VocabularyImageService vocabularyImageService;
    private final AiUsageLedgerService aiUsageLedgerService;
    private final int maxBatch;

    public GalerieSvgGenerationService(JdbcTemplate jdbcTemplate,
                                       GaleriePromptFactory promptFactory,
                                       GalerieSvgSanitizer sanitizer,
                                       GalerieAnthropicClient anthropicClient,
                                       S3StorageService s3StorageService,
                                       MediaAssetService mediaAssetService,
                                       VocabularyImageService vocabularyImageService,
                                       AiUsageLedgerService aiUsageLedgerService,
                                       @Value("${app.galerie.max-batch}") int maxBatch) {
        this.jdbcTemplate = jdbcTemplate;
        this.promptFactory = promptFactory;
        this.sanitizer = sanitizer;
        this.anthropicClient = anthropicClient;
        this.s3StorageService = s3StorageService;
        this.mediaAssetService = mediaAssetService;
        this.vocabularyImageService = vocabularyImageService;
        this.aiUsageLedgerService = aiUsageLedgerService;
        this.maxBatch = maxBatch;
    }

    /** Sinh SVG cho các từ CONCEPT_READY, ưu tiên tần suất cao trước. */
    public GalerieSvgBatchResponse generateForReady(int limit, String cefr, User adminUser) {
        if (!anthropicClient.isConfigured()) {
            throw new AiServiceException(AiErrorCode.AI_NOT_CONFIGURED,
                    "Galerie SVG chưa được cấu hình (cần GALERIE_SVG_ENABLED=true + ANTHROPIC_API_KEY).",
                    null);
        }
        int effectiveLimit = Math.min(Math.max(1, limit), maxBatch);

        StringBuilder sql = new StringBuilder("""
                SELECT w.id, w.base_form, n.gender, w.image_family, w.image_concept,
                       %s AS meaning
                """.formatted(MEANING_EXPR))
                .append(FROM_WORDS_JOINED)
                .append("WHERE w.image_status = ? AND w.image_concept IS NOT NULL\n");
        List<Object> args = new ArrayList<>();
        args.add(STATUS_CONCEPT_READY);
        if (cefr != null && !cefr.isBlank()) {
            sql.append(" AND w.cefr_level = ?");
            args.add(cefr.trim().toUpperCase());
        }
        sql.append(" ORDER BY w.frequency_rank ASC NULLS LAST, w.id ASC LIMIT ?");
        args.add(effectiveLimit);

        List<Map<String, Object>> candidates = jdbcTemplate.queryForList(sql.toString(), args.toArray());

        int succeeded = 0;
        List<GalerieSvgBatchResponse.FailureDetail> failures = new ArrayList<>();
        for (Map<String, Object> row : candidates) {
            long wordId = ((Number) row.get("id")).longValue();
            String baseForm = String.valueOf(row.get("base_form"));
            if (!claim(wordId)) {
                continue; // lượt chạy khác đã cầm từ này
            }
            try {
                generateOne(wordId, row, adminUser);
                succeeded++;
            } catch (Exception e) {
                releaseClaim(wordId);
                log.warn("[Galerie] SVG thất bại wordId={} baseForm={}: {}", wordId, baseForm, e.getMessage());
                if (failures.size() < MAX_FAILURE_DETAILS) {
                    failures.add(new GalerieSvgBatchResponse.FailureDetail(wordId, baseForm, e.getMessage()));
                }
            }
        }
        int failed = candidates.size() - succeeded;
        return new GalerieSvgBatchResponse(candidates.size(), succeeded, failed, countReady(cefr), failures);
    }

    /** Số từ CONCEPT_READY còn chờ sinh — cho admin ước lượng khối lượng. */
    public int countReady(String cefr) {
        StringBuilder sql = new StringBuilder(
                "SELECT COUNT(*) FROM words w WHERE w.image_status = ? AND w.image_concept IS NOT NULL");
        List<Object> args = new ArrayList<>();
        args.add(STATUS_CONCEPT_READY);
        if (cefr != null && !cefr.isBlank()) {
            sql.append(" AND w.cefr_level = ?");
            args.add(cefr.trim().toUpperCase());
        }
        Integer count = jdbcTemplate.queryForObject(sql.toString(), Integer.class, args.toArray());
        return count == null ? 0 : count;
    }

    // ── Import artwork vẽ sẵn (đường 0đ: SVG sinh trong phiên Claude Code gói Max) ─────────────

    /**
     * Nhận SVG vẽ SẴN (pilot P1 + tranh vẽ in-session) và đưa vào ĐÚNG luồng lưu của generate:
     * sanitizer → S3 → media_assets → image_url → QA_PENDING. Không đụng Anthropic API nên
     * KHÔNG cần {@code ANTHROPIC_API_KEY}/flag — đây là đường lên prod khi owner chưa tạo key.
     * Ghi đè artwork cũ nếu có (re-import = vẽ lại thủ công).
     */
    public ImportResult importArtwork(long wordId, String rawSvg, User adminUser) {
        Map<String, Object> word;
        try {
            word = jdbcTemplate.queryForMap(
                    "SELECT base_form, image_concept FROM words WHERE id = ?", wordId);
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            throw new com.deutschflow.common.exception.NotFoundException("Không có từ id=" + wordId);
        }

        GalerieSvgSanitizer.SanitizedSvg sanitized = sanitizer.sanitize(rawSvg);
        byte[] bytes = sanitized.svg().getBytes(StandardCharsets.UTF_8);
        String altText = stringOrNull(word.get("image_concept")) != null
                ? stringOrNull(word.get("image_concept")) : stringOrNull(word.get("base_form"));

        String s3Key = "galerie/" + GaleriePromptFactory.VERSION + "/" + wordId + ".svg";
        S3StorageService.S3UploadResult uploaded =
                s3StorageService.uploadBytes(bytes, s3Key, "image/svg+xml");
        MediaAsset asset = mediaAssetService.registerGeneratedAsset(
                uploaded.getS3Key(), uploaded.getUrl(),
                wordId + ".svg", "image/svg+xml", bytes.length,
                "GALERIE", "SYSTEM", "AI_GENERATED",
                GaleriePromptFactory.VERSION, altText, adminUser);

        vocabularyImageService.applyGeneratedImage(wordId, asset, GaleriePromptFactory.VERSION, altText);
        jdbcTemplate.update("UPDATE words SET image_status = ? WHERE id = ?", STATUS_QA_PENDING, wordId);
        log.info("[Galerie] import artwork wordId={} elements={} bytes={}",
                wordId, sanitized.elementCount(), bytes.length);
        return new ImportResult(wordId, uploaded.getUrl(), sanitized.elementCount(), bytes.length);
    }

    public record ImportResult(long wordId, String imageUrl, int elementCount, int sizeBytes) {}

    // ── Decision (plan mục 16: chỉ APPROVED là artwork production) ─────────────────────────────

    public enum Decision { APPROVE, REGENERATE, REJECT }

    /**
     * @return {@code true} nếu có row đổi trạng thái; {@code false} khi từ không ở trạng thái
     *         cho phép quyết định (controller map thành 409).
     */
    public boolean decide(long wordId, Decision decision) {
        return switch (decision) {
            // APPROVE chỉ từ QA_PENDING — không "approve lại" từ REJECTED mà không qua regenerate.
            case APPROVE -> jdbcTemplate.update("""
                    UPDATE words SET image_status = ?, image_updated_at = NOW()
                    WHERE id = ? AND image_status = ?
                    """, STATUS_APPROVED, wordId, STATUS_QA_PENDING) > 0;
            // REGENERATE: gỡ artwork hiện tại, trả về CONCEPT_READY để lượt generate sau cầm lại.
            case REGENERATE -> jdbcTemplate.update("""
                    UPDATE words SET image_status = ?, image_url = NULL, image_style = NULL,
                                     image_prompt = NULL, image_updated_at = NOW()
                    WHERE id = ? AND image_status IN (?, ?, ?)
                    """, STATUS_CONCEPT_READY, wordId,
                    STATUS_QA_PENDING, STATUS_APPROVED, STATUS_REJECTED) > 0;
            case REJECT -> jdbcTemplate.update("""
                    UPDATE words SET image_status = ?, image_url = NULL, image_updated_at = NOW()
                    WHERE id = ? AND image_status IN (?, ?)
                    """, STATUS_REJECTED, wordId, STATUS_QA_PENDING, STATUS_APPROVED) > 0;
        };
    }

    // ── Nội bộ ─────────────────────────────────────────────────────────────────────────────────

    private void generateOne(long wordId, Map<String, Object> row, User adminUser) {
        GalerieFamily family = GalerieFamily.fromLlm(stringOrNull(row.get("image_family")));
        String visualConcept = stringOrNull(row.get("image_concept"));
        String userMessage = promptFactory.svgUserMessage(
                stringOrNull(row.get("base_form")),
                stringOrNull(row.get("gender")),
                stringOrNull(row.get("meaning")),
                family, visualConcept);

        GalerieAnthropicClient.SvgCompletion completion = anthropicClient.complete(
                promptFactory.svgSystemPrompt(), promptFactory.svgAnchorsBlock(), userMessage);
        recordUsage(adminUser, completion);
        if (completion.refused()) {
            throw new IllegalStateException(
                    "Anthropic từ chối request (stop_reason=refusal, kể cả chuỗi fallback)");
        }

        GalerieSvgSanitizer.SanitizedSvg sanitized = sanitizer.sanitize(completion.text());
        byte[] bytes = sanitized.svg().getBytes(StandardCharsets.UTF_8);

        String s3Key = "galerie/" + GaleriePromptFactory.VERSION + "/" + wordId + ".svg";
        S3StorageService.S3UploadResult uploaded =
                s3StorageService.uploadBytes(bytes, s3Key, "image/svg+xml");

        MediaAsset asset = mediaAssetService.registerGeneratedAsset(
                uploaded.getS3Key(), uploaded.getUrl(),
                wordId + ".svg", "image/svg+xml", bytes.length,
                "GALERIE", "SYSTEM", "AI_GENERATED",
                GaleriePromptFactory.VERSION,
                visualConcept,
                adminUser);

        // Ghi image_url + style + prompt(=visualConcept) rồi chuyển QA_PENDING chờ review.
        vocabularyImageService.applyGeneratedImage(wordId, asset, GaleriePromptFactory.VERSION, visualConcept);
        jdbcTemplate.update("UPDATE words SET image_status = ? WHERE id = ?", STATUS_QA_PENDING, wordId);
        log.info("[Galerie] SVG OK wordId={} elements={} bytes={} servedBy={}",
                wordId, sanitized.elementCount(), bytes.length, completion.servedByModel());
    }

    /** Claim nguyên tử: chỉ một lượt chạy cầm được từ đang CONCEPT_READY. */
    private boolean claim(long wordId) {
        return jdbcTemplate.update("""
                UPDATE words SET image_status = ? WHERE id = ? AND image_status = ?
                """, STATUS_GENERATING, wordId, STATUS_CONCEPT_READY) > 0;
    }

    /** Lỗi giữa chừng: trả từ về CONCEPT_READY (chỉ khi vẫn đang GENERATING) để retry lượt sau. */
    private void releaseClaim(long wordId) {
        try {
            jdbcTemplate.update("""
                    UPDATE words SET image_status = ? WHERE id = ? AND image_status = ?
                    """, STATUS_CONCEPT_READY, wordId, STATUS_GENERATING);
        } catch (Exception e) {
            log.error("[Galerie] Không trả được claim wordId={} — từ có thể kẹt ở GENERATING: {}",
                    wordId, e.getMessage());
        }
    }

    /** COGS bắt buộc thấy được (bài học H-1): provider anthropic, feature galerie.svg. */
    private void recordUsage(User adminUser, GalerieAnthropicClient.SvgCompletion completion) {
        if (adminUser == null || adminUser.getId() == null) {
            return;
        }
        try {
            aiUsageLedgerService.record(adminUser.getId(), "anthropic", completion.servedByModel(),
                    completion.inputTokens(), completion.outputTokens(),
                    completion.inputTokens() + completion.outputTokens(),
                    FEATURE, completion.responseId(), null);
        } catch (Exception e) {
            log.warn("[Galerie] Không ghi được ledger (non-fatal): {}", e.toString());
        }
    }

    private static String stringOrNull(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
