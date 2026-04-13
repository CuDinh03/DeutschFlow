package com.deutschflow.vocabulary.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Optional;

/**
 * Service tổng hợp để import từ vựng từ nhiều nguồn:
 * 1. Wiktionary (scraping)
 * 2. DeepL (translation)
 * 3. Manual input
 * 
 * Workflow:
 * 1. Scrape Wiktionary để lấy gender, plural, example
 * 2. Dùng DeepL để dịch meaning sang VI/EN
 * 3. Lưu vào database
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class VocabularyImportService {

    private final WiktionaryScraperService wiktionaryService;
    private final DeepLTranslationService deeplService;
    // TODO: Inject WordRepository, NounRepository, WordTranslationRepository khi implement

    /**
     * Import một từ tiếng Đức từ Wiktionary + DeepL
     * 
     * @param word Từ tiếng Đức cần import
     * @param cefrLevel Cấp độ CEFR (A1, A2, B1, B2, C1, C2)
     * @return true nếu import thành công
     */
    @Transactional
    public boolean importWord(String word, String cefrLevel) {
        log.info("Starting import for word: {} (CEFR: {})", word, cefrLevel);

        // Step 1: Scrape Wiktionary
        Optional<WiktionaryScraperService.WordData> wiktData = wiktionaryService.scrapeWord(word);
        if (wiktData.isEmpty()) {
            log.warn("Failed to scrape Wiktionary for word: {}", word);
            return false;
        }

        WiktionaryScraperService.WordData data = wiktData.get();

        // Step 2: Translate meaning using DeepL
        Map<String, String> translations = Map.of();
        if (data.getMeaning() != null) {
            translations = deeplService.translateToMultiple(data.getMeaning());
        }

        // Step 3: Save to database
        // TODO: Implement database save logic
        log.info("Word data ready for import:");
        log.info("  Word: {}", data.getWord());
        log.info("  Gender: {}", data.getGender());
        log.info("  Plural: {}", data.getPlural());
        log.info("  Meaning (EN): {}", data.getMeaning());
        log.info("  Meaning (VI): {}", translations.get("vi"));
        log.info("  Example (DE): {}", data.getExampleDe());
        log.info("  Example (EN): {}", data.getExampleEn());

        // TODO: Insert into words, nouns, word_translations tables

        return true;
    }

    /**
     * Import batch từ vựng từ danh sách
     * 
     * @param words Danh sách từ cần import
     * @param cefrLevel Cấp độ CEFR
     * @return Số từ import thành công
     */
    public int importBatch(String[] words, String cefrLevel) {
        int successCount = 0;
        
        for (String word : words) {
            try {
                if (importWord(word, cefrLevel)) {
                    successCount++;
                }
                // Rate limiting: 1 word per 2 seconds (Wiktionary + DeepL)
                Thread.sleep(2000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                log.error("Import interrupted", e);
                break;
            } catch (Exception e) {
                log.error("Failed to import word: {}", word, e);
            }
        }

        log.info("Batch import completed: {}/{} words imported successfully", successCount, words.length);
        return successCount;
    }

    /**
     * Kiểm tra DeepL usage
     */
    public void checkDeepLUsage() {
        deeplService.checkUsage().ifPresent(usage -> {
            log.info("DeepL API Usage:");
            log.info("  Characters used: {}/{}", usage.getCharacterCount(), usage.getCharacterLimit());
            log.info("  Percentage: {}%", String.format("%.2f", usage.getPercentageUsed()));
            
            if (usage.getPercentageUsed() > 80) {
                log.warn("DeepL API usage is over 80%! Consider upgrading or reducing usage.");
            }
        });
    }
}
