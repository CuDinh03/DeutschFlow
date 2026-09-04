package com.deutschflow.vocabulary.service;

import com.deutschflow.common.exception.BadRequestException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Xóa sạch toàn bộ vocabulary data và re-import từ Goethe + Wiktionary.
 * Chỉ xóa vocabulary tables, KHÔNG xóa users — nhưng {@code DELETE FROM words} kéo theo
 * cascade xóa {@code spaced_repetition_schedule} (V152) và {@code user_word_progress} (V3)
 * của MỌI học viên, tức toàn bộ tiến độ ôn tập trên nền tảng. Vì vậy (audit R-H1, 03/09/2026):
 * caller phải gửi đúng {@link #CONFIRM_PHRASE}, và toàn bộ chạy all-or-nothing — bất kỳ bước
 * reimport nào lỗi thì rollback trọn transaction, không bao giờ commit trạng thái nửa vời
 * "đã xóa nhưng chưa nạp lại".
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class VocabularyResetService {

    /** Chuỗi xác nhận bắt buộc — gửi qua {@code confirm=RESET}. */
    public static final String CONFIRM_PHRASE = "RESET";

    private final JdbcTemplate jdbcTemplate;
    private final GoetheVocabularyAutoImportService goetheVocabularyAutoImportService;
    private final GoetheOfficialWordlistImportService goetheOfficialWordlistImportService;
    private final WiktionaryEnrichmentBatchService wiktionaryEnrichmentBatchService;

    /**
     * Xóa sạch vocabulary và re-import.
     * Thứ tự:
     * 1. Xóa word_translations, nouns, verbs, adjectives, word_tags, words
     * 2. Reset vocabulary_import_state cursor
     * 3. Import Goethe official wordlist (TSV)
     * 4. Import Goethe A1-C1 auto
     * 5. Enrich batch với Wiktionary (limit đầu tiên)
     * Lỗi ở bất kỳ bước nào sau khi xóa → đánh dấu rollback-only và trả về
     * {@code status=ROLLED_BACK}: dữ liệu (kể cả tiến độ ôn tập cascade) giữ nguyên.
     */
    @Transactional
    public Map<String, Object> resetAndReimport(String confirm, int wiktionaryBatchLimit) {
        if (!CONFIRM_PHRASE.equals(confirm)) {
            throw new BadRequestException(
                    "Thao tác này xóa TOÀN BỘ từ vựng và (do cascade) toàn bộ tiến độ ôn tập"
                            + " của mọi học viên. Gửi kèm confirm=" + CONFIRM_PHRASE + " để xác nhận.");
        }
        Map<String, Object> result = new LinkedHashMap<>();

        // ── Step 1: Xóa vocabulary data ──────────────────────────────────
        log.info("Resetting vocabulary tables...");
        jdbcTemplate.update("DELETE FROM word_tags");
        jdbcTemplate.update("DELETE FROM noun_declension_forms");
        jdbcTemplate.update("DELETE FROM verb_conjugations");
        jdbcTemplate.update("DELETE FROM word_translations");
        jdbcTemplate.update("DELETE FROM nouns");
        jdbcTemplate.update("DELETE FROM verbs");
        jdbcTemplate.update("DELETE FROM adjectives");
        jdbcTemplate.update("DELETE FROM word_components");
        jdbcTemplate.update("DELETE FROM words");

        jdbcTemplate.queryForObject(
                "SELECT setval(pg_get_serial_sequence('words', 'id'), 1, false)",
                Long.class);

        // Reset Wiktionary cursor
        jdbcTemplate.update("""
                DELETE FROM vocabulary_import_state
                WHERE source_name IN ('WIKTIONARY_ENRICH', 'WIKTIONARY_IPA')
                """);

        // Reset Goethe import state nếu có
        jdbcTemplate.update("""
                DELETE FROM vocabulary_import_state
                WHERE source_name LIKE 'GOETHE%'
                """);

        long deletedWords = 0;
        try {
            deletedWords = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM words", Long.class);
        } catch (Exception ignored) {}
        result.put("deletedWords", deletedWords == 0 ? "all" : deletedWords);
        log.info("Vocabulary tables cleared.");

        // ── Step 2: Import Goethe Official Wordlist (TSV) ────────────────
        log.info("Importing Goethe official wordlist...");
        Map<String, Object> officialResult;
        try {
            officialResult = goetheOfficialWordlistImportService.importFromClasspathTsv();
            result.put("goetheOfficial", Map.of(
                    "inserted", officialResult.getOrDefault("inserted", 0),
                    "updated", officialResult.getOrDefault("updated", 0),
                    "status", "OK"
            ));
        } catch (Exception e) {
            return rollBack(result, "goetheOfficial", e);
        }

        // ── Step 3: Import Goethe A1-C1 Auto ────────────────────────────
        log.info("Importing Goethe A1-C1 vocabulary...");
        Map<String, Object> goetheResult;
        try {
            goetheResult = goetheVocabularyAutoImportService.importGoetheVocabularyA1ToC1();
            result.put("goetheAuto", Map.of(
                    "inserted", goetheResult.getOrDefault("inserted", 0),
                    "updated", goetheResult.getOrDefault("updated", 0),
                    "managedUniqueImported", goetheResult.getOrDefault("managedUniqueImported", 0),
                    "status", "OK"
            ));
        } catch (Exception e) {
            return rollBack(result, "goetheAuto", e);
        }

        // ── Step 4: Clean dirty base_form values ────────────────────────
        log.info("Cleaning dirty base_form values...");
        try {
            // Strip plural info after comma: "das Auge, -n" → "das Auge"
            jdbcTemplate.update("""
                    UPDATE words SET base_form = TRIM(SPLIT_PART(base_form, ',', 1))
                    WHERE base_form LIKE '%,%'
                    """);
            // Extract gender from article prefix and store in nouns table
            jdbcTemplate.update("""
                    INSERT INTO nouns (id, gender, noun_type)
                    SELECT w.id,
                      CASE
                        WHEN LOWER(w.base_form) ~ '^der ' THEN 'DER'
                        WHEN LOWER(w.base_form) ~ '^die ' THEN 'DIE'
                        WHEN LOWER(w.base_form) ~ '^das ' THEN 'DAS'
                      END,
                      'STARK'
                    FROM words w
                    WHERE LOWER(w.base_form) ~ '^(der|die|das) '
                      AND NOT EXISTS (SELECT 1 FROM nouns n WHERE n.id = w.id)
                    ON CONFLICT (id) DO NOTHING
                    """);
            // Strip article prefix from base_form
            jdbcTemplate.update("""
                    UPDATE words SET base_form = TRIM(regexp_replace(base_form, '^(der|die|das) ', '', 'i'))
                    WHERE LOWER(base_form) ~ '^(der|die|das) '
                    """);
            // Remove duplicates (keep lowest id per base_form case-insensitive)
            jdbcTemplate.update("""
                    DELETE FROM words w
                    USING words w2
                    WHERE LOWER(w.base_form) = LOWER(w2.base_form)
                      AND w.id > w2.id
                    """);
            log.info("Base_form cleanup complete.");
        } catch (Exception e) {
            return rollBack(result, "baseFormCleanup", e);
        }

        // ── Step 5: Wiktionary Enrich Batch ─────────────────────────────
        int limit = wiktionaryBatchLimit > 0 ? Math.min(wiktionaryBatchLimit, 500) : 200;
        log.info("Running Wiktionary enrich batch (limit={})...", limit);
        Map<String, Object> wiktionaryResult;
        try {
            wiktionaryResult = wiktionaryEnrichmentBatchService.runBatch(limit, true);
            result.put("wiktionaryEnrich", Map.of(
                    "processedRows", wiktionaryResult.getOrDefault("processedRows", 0),
                    "ipaFilled", wiktionaryResult.getOrDefault("ipaFilled", 0),
                    "enUpserts", wiktionaryResult.getOrDefault("enUpserts", 0),
                    "deUpserts", wiktionaryResult.getOrDefault("deUpserts", 0),
                    "failed", wiktionaryResult.getOrDefault("failed", 0),
                    "status", wiktionaryResult.getOrDefault("status", "UNKNOWN")
            ));
        } catch (Exception e) {
            return rollBack(result, "wiktionaryEnrich", e);
        }

        // ── Final stats ──────────────────────────────────────────────────
        Integer totalWords = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM words", Integer.class);
        Integer wordsWithMeaning = jdbcTemplate.queryForObject("""
                SELECT COUNT(DISTINCT w.id)
                FROM words w
                JOIN word_translations wt ON wt.word_id = w.id
                WHERE wt.locale = 'en'
                  AND wt.meaning IS NOT NULL
                  AND TRIM(wt.meaning) <> ''
                  AND LOWER(wt.meaning) NOT LIKE 'not in wordlists%'
                  AND LOWER(wt.meaning) NOT LIKE 'chưa có trong%'
                """, Integer.class);
        Integer wordsWithIpa = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM words
                WHERE phonetic IS NOT NULL AND TRIM(phonetic) <> ''
                """, Integer.class);

        result.put("finalStats", Map.of(
                "totalWords", totalWords == null ? 0 : totalWords,
                "wordsWithMeaning", wordsWithMeaning == null ? 0 : wordsWithMeaning,
                "wordsWithIpa", wordsWithIpa == null ? 0 : wordsWithIpa
        ));
        result.put("status", "OK");
        log.info("Vocabulary reset complete. Total words: {}", totalWords);
        return result;
    }

    /**
     * Một bước reimport lỗi → hủy trọn transaction: mọi DELETE ở Step 1 (và cascade tiến độ
     * ôn tập) được hoàn lại, không tồn tại trạng thái "đã xóa nhưng nạp lại dở". Trả kết quả
     * thay vì ném exception để caller (và vết audit ghi ngoài transaction này) thấy đúng
     * chuyện gì đã xảy ra.
     */
    private Map<String, Object> rollBack(Map<String, Object> result, String failedStep, Exception e) {
        log.error("Vocabulary reset: bước {} lỗi — rollback toàn bộ, dữ liệu giữ nguyên.", failedStep, e);
        markRollbackOnly();
        result.put("status", "ROLLED_BACK");
        result.put("failedStep", failedStep);
        result.put("error", String.valueOf(e.getMessage()));
        return result;
    }

    // Seam tách riêng vì TransactionAspectSupport là static và ném NoTransactionException
    // ngoài transaction — unit test spy hàm này thay vì dựng transaction thật.
    void markRollbackOnly() {
        TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
    }
}
