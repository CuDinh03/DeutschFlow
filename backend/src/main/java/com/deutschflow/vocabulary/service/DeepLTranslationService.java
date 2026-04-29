package com.deutschflow.vocabulary.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Service tích hợp DeepL API để dịch từ vựng tiếng Đức
 * 
 * DeepL API Docs: https://www.deepl.com/docs-api
 * Free tier: 500,000 characters/month
 * 
 * Features:
 * - Dịch từ Đức sang Việt/Anh
 * - Context-aware translation (tốt hơn Google Translate)
 * - Formal/Informal detection
 */
@Service
@Slf4j
public class DeepLTranslationService {

    private static final String DEEPL_API_URL = "https://api-free.deepl.com/v2/translate";
    private static final String DEEPL_USAGE_URL = "https://api-free.deepl.com/v2/usage";

    @Value("${app.deepl.api-key:}")
    private String apiKey;

    private final RestTemplate restTemplate;

    public DeepLTranslationService() {
        this.restTemplate = new RestTemplate();
    }

    /**
     * Dịch text từ tiếng Đức sang ngôn ngữ đích
     * 
     * @param text Text tiếng Đức cần dịch
     * @param targetLang Ngôn ngữ đích (VI, EN)
     * @return Bản dịch
     */
    public Optional<String> translate(String text, String targetLang) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("DeepL API key not configured. Skipping translation.");
            return Optional.empty();
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            headers.set("Authorization", "DeepL-Auth-Key " + apiKey);

            String encodedText = URLEncoder.encode(text, StandardCharsets.UTF_8);
            String requestBody = String.format(
                    "text=%s&source_lang=DE&target_lang=%s&formality=default",
                    encodedText, targetLang.toUpperCase()
            );

            HttpEntity<String> request = new HttpEntity<>(requestBody, headers);

            ResponseEntity<DeepLResponse> response = restTemplate.exchange(
                    DEEPL_API_URL,
                    HttpMethod.POST,
                    request,
                    DeepLResponse.class
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                List<Translation> translations = response.getBody().getTranslations();
                if (translations != null && !translations.isEmpty()) {
                    String translated = translations.get(0).getText();
                    log.info("Translated '{}' to {}: '{}'", text, targetLang, translated);
                    return Optional.of(translated);
                }
            }

            log.warn("DeepL API returned empty response for: {}", text);
            return Optional.empty();

        } catch (Exception e) {
            log.error("Failed to translate text: {}", text, e);
            return Optional.empty();
        }
    }

    /**
     * Dịch từ tiếng Đức sang cả Việt và Anh
     * 
     * @param text Text tiếng Đức
     * @return Map với key "vi" và "en"
     */
    public Map<String, String> translateToMultiple(String text) {
        Map<String, String> translations = new HashMap<>();
        
        translate(text, "VI").ifPresent(vi -> translations.put("vi", vi));
        translate(text, "EN").ifPresent(en -> translations.put("en", en));
        
        return translations;
    }

    /**
     * Kiểm tra usage của API key (số ký tự còn lại)
     * 
     * @return Usage info
     */
    public Optional<UsageInfo> checkUsage() {
        if (apiKey == null || apiKey.isBlank()) {
            return Optional.empty();
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "DeepL-Auth-Key " + apiKey);

            HttpEntity<Void> request = new HttpEntity<>(headers);

            ResponseEntity<UsageResponse> response = restTemplate.exchange(
                    DEEPL_USAGE_URL,
                    HttpMethod.GET,
                    request,
                    UsageResponse.class
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                UsageResponse body = response.getBody();
                UsageInfo info = new UsageInfo();
                info.setCharacterCount(body.getCharacterCount());
                info.setCharacterLimit(body.getCharacterLimit());
                info.setPercentageUsed((body.getCharacterCount() * 100.0) / body.getCharacterLimit());
                
                log.info("DeepL Usage: {}/{} characters ({}%)", 
                        info.getCharacterCount(), 
                        info.getCharacterLimit(), 
                        String.format("%.2f", info.getPercentageUsed()));
                
                return Optional.of(info);
            }

            return Optional.empty();

        } catch (Exception e) {
            log.error("Failed to check DeepL usage", e);
            return Optional.empty();
        }
    }

    // DTO classes for DeepL API responses

    public static class DeepLResponse {
        private List<Translation> translations;

        public List<Translation> getTranslations() { return translations; }
        public void setTranslations(List<Translation> translations) { this.translations = translations; }
    }

    public static class Translation {
        private String text;
        private String detected_source_language;

        public String getText() { return text; }
        public void setText(String text) { this.text = text; }

        public String getDetected_source_language() { return detected_source_language; }
        public void setDetected_source_language(String detected_source_language) { 
            this.detected_source_language = detected_source_language; 
        }
    }

    public static class UsageResponse {
        private long character_count;
        private long character_limit;

        public long getCharacterCount() { return character_count; }
        public void setCharacterCount(long character_count) { this.character_count = character_count; }

        public long getCharacterLimit() { return character_limit; }
        public void setCharacterLimit(long character_limit) { this.character_limit = character_limit; }
    }

    public static class UsageInfo {
        private long characterCount;
        private long characterLimit;
        private double percentageUsed;

        public long getCharacterCount() { return characterCount; }
        public void setCharacterCount(long characterCount) { this.characterCount = characterCount; }

        public long getCharacterLimit() { return characterLimit; }
        public void setCharacterLimit(long characterLimit) { this.characterLimit = characterLimit; }

        public double getPercentageUsed() { return percentageUsed; }
        public void setPercentageUsed(double percentageUsed) { this.percentageUsed = percentageUsed; }
    }
}
