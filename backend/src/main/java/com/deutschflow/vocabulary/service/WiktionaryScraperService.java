package com.deutschflow.vocabulary.service;

import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Scraper để lấy từ vựng tiếng Đức từ Wiktionary
 * Source: https://en.wiktionary.org/wiki/{word}
 * 
 * IMPORTANT: Tuân thủ robots.txt và rate limiting
 * - Max 1 request/second
 * - User-Agent phải được set
 */
@Service
@Slf4j
public class WiktionaryScraperService {

    private static final String WIKTIONARY_BASE_URL = "https://en.wiktionary.org/wiki/";
    private static final String USER_AGENT = "DeutschFlow/1.0 (Educational purposes; contact@deutschflow.com)";
    private static final int TIMEOUT_MS = 10000;
    private static final int RATE_LIMIT_MS = 1000; // 1 request per second

    private long lastRequestTime = 0;

    /**
     * Scrape thông tin từ vựng từ Wiktionary
     * 
     * @param word Từ tiếng Đức cần tra
     * @return WordData chứa gender, plural, meaning, examples
     */
    public Optional<WordData> scrapeWord(String word) {
        try {
            enforceRateLimit();
            
            String url = WIKTIONARY_BASE_URL + word;
            log.info("Scraping Wiktionary: {}", url);

            Document doc = Jsoup.connect(url)
                    .userAgent(USER_AGENT)
                    .timeout(TIMEOUT_MS)
                    .get();

            // Tìm section German
            Element germanSection = findGermanSection(doc);
            if (germanSection == null) {
                log.warn("No German section found for word: {}", word);
                return Optional.empty();
            }

            WordData data = new WordData();
            data.setWord(word);

            // Extract gender (der/die/das) cho nouns
            extractGender(germanSection, data);

            // Extract plural form
            extractPlural(germanSection, data);

            // Extract meaning (English translation)
            extractMeaning(germanSection, data);

            // Extract example sentences
            extractExamples(germanSection, data);

            log.info("Successfully scraped: {} - Gender: {}, Plural: {}", 
                    word, data.getGender(), data.getPlural());

            return Optional.of(data);

        } catch (IOException e) {
            log.error("Failed to scrape word: {}", word, e);
            return Optional.empty();
        }
    }

    private void enforceRateLimit() {
        long now = System.currentTimeMillis();
        long timeSinceLastRequest = now - lastRequestTime;
        
        if (timeSinceLastRequest < RATE_LIMIT_MS) {
            try {
                Thread.sleep(RATE_LIMIT_MS - timeSinceLastRequest);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        
        lastRequestTime = System.currentTimeMillis();
    }

    private Element findGermanSection(Document doc) {
        // Tìm heading "German"
        Elements headings = doc.select("h2");
        for (Element heading : headings) {
            Element span = heading.selectFirst("span.mw-headline");
            if (span != null && "German".equals(span.text())) {
                return heading.parent();
            }
        }
        return null;
    }

    private void extractGender(Element section, WordData data) {
        // Tìm trong headword-line hoặc gender template
        Elements genderElements = section.select("span.gender");
        if (!genderElements.isEmpty()) {
            String genderText = genderElements.first().text().toLowerCase();
            if (genderText.contains("m")) {
                data.setGender("DER");
            } else if (genderText.contains("f")) {
                data.setGender("DIE");
            } else if (genderText.contains("n")) {
                data.setGender("DAS");
            }
        }

        // Fallback: tìm trong text "der/die/das"
        if (data.getGender() == null) {
            String text = section.text().toLowerCase();
            if (text.contains("der ")) {
                data.setGender("DER");
            } else if (text.contains("die ")) {
                data.setGender("DIE");
            } else if (text.contains("das ")) {
                data.setGender("DAS");
            }
        }
    }

    private void extractPlural(Element section, WordData data) {
        // Tìm trong inflection table hoặc headword
        Elements pluralElements = section.select("span.form-of.lang-de");
        for (Element el : pluralElements) {
            String text = el.text();
            if (text.contains("plural")) {
                // Extract plural form từ sibling elements
                Element pluralForm = el.parent().selectFirst("strong.Latn");
                if (pluralForm != null) {
                    data.setPlural(pluralForm.text());
                    break;
                }
            }
        }
    }

    private void extractMeaning(Element section, WordData data) {
        // Tìm definition list
        Elements definitions = section.select("ol > li");
        if (!definitions.isEmpty()) {
            // Lấy definition đầu tiên
            String meaning = definitions.first().text();
            // Clean up (remove citations, examples)
            meaning = meaning.replaceAll("\\[.*?\\]", "").trim();
            data.setMeaning(meaning);
        }
    }

    private void extractExamples(Element section, WordData data) {
        // Tìm example sentences (thường trong <dd> hoặc <ul class="quotations">)
        Elements examples = section.select("dd.quote, ul.quotations li");
        if (!examples.isEmpty()) {
            Element firstExample = examples.first();
            String exampleText = firstExample.text();
            // Extract German sentence và English translation
            String[] parts = exampleText.split("―"); // Wiktionary dùng ― để ngăn cách
            if (parts.length >= 2) {
                data.setExampleDe(parts[0].trim());
                data.setExampleEn(parts[1].trim());
            } else {
                data.setExampleDe(exampleText);
            }
        }
    }

    /**
     * Data class chứa thông tin từ vựng từ Wiktionary
     */
    public static class WordData {
        private String word;
        private String gender;      // DER, DIE, DAS
        private String plural;
        private String meaning;     // English meaning
        private String exampleDe;   // German example sentence
        private String exampleEn;   // English translation of example

        // Getters and Setters
        public String getWord() { return word; }
        public void setWord(String word) { this.word = word; }

        public String getGender() { return gender; }
        public void setGender(String gender) { this.gender = gender; }

        public String getPlural() { return plural; }
        public void setPlural(String plural) { this.plural = plural; }

        public String getMeaning() { return meaning; }
        public void setMeaning(String meaning) { this.meaning = meaning; }

        public String getExampleDe() { return exampleDe; }
        public void setExampleDe(String exampleDe) { this.exampleDe = exampleDe; }

        public String getExampleEn() { return exampleEn; }
        public void setExampleEn(String exampleEn) { this.exampleEn = exampleEn; }
    }
}
