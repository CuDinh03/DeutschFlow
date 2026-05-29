package com.deutschflow.vocabulary.service;

import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.parser.Tag;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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
    private static final Pattern IPA_FALLBACK = Pattern.compile("/[^/]{2,80}/");

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

            // Normalize base_form trước khi scrape:
            // 1. Lấy phần trước dấu phẩy đầu tiên: "abholen, holt ab" → "abholen"
            // 2. Strip article nếu có: "der Drucker" → "Drucker"
            // 3. Lấy từ đầu tiên nếu còn nhiều từ không phải article
            String cleanWord = word == null ? "" : word.trim();

            int commaIdx = cleanWord.indexOf(',');
            if (commaIdx > 0) cleanWord = cleanWord.substring(0, commaIdx).trim();

            int parenIdx = cleanWord.indexOf('(');
            if (parenIdx > 0) cleanWord = cleanWord.substring(0, parenIdx).trim();

            // Strip article prefix: "der/die/das Wort" → "Wort"
            String lower = cleanWord.toLowerCase();
            if (lower.startsWith("der ")) cleanWord = cleanWord.substring(4).trim();
            else if (lower.startsWith("die ")) cleanWord = cleanWord.substring(4).trim();
            else if (lower.startsWith("das ")) cleanWord = cleanWord.substring(4).trim();

            // Nếu vẫn còn nhiều từ (không phải compound), lấy từ đầu tiên
            String[] parts = cleanWord.split("\\s+");
            if (parts.length > 1) cleanWord = parts[0];

            if (cleanWord.isBlank()) {
                log.warn("Empty word after normalization, original: {}", word);
                return Optional.empty();
            }

            String encoded = java.net.URLEncoder.encode(cleanWord, java.nio.charset.StandardCharsets.UTF_8)
                    .replace("+", "%20");
            String url = WIKTIONARY_BASE_URL + encoded;
            log.info("Scraping Wiktionary: {} (original: {})", url, word);

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

            extractIpa(germanSection, data);

            // Extract plural form
            extractPlural(germanSection, data);

            // Extract meaning (English translation)
            extractMeaning(germanSection, data);

            // Extract example sentences
            extractExamples(germanSection, data);

            // Extract usage note (grammar/usage info)
            extractUsageNote(germanSection, data);

            // Extract verb-specific data (partizip2, auxiliary, separable)
            extractVerbData(germanSection, data);

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
        // Wiktionary markup has changed over time; handle both variants.
        // Newer: <h2 id="German">German</h2>
        // Older: <h2><span class="mw-headline" id="German">German</span></h2>
        Element h2 = doc.selectFirst("h2#German");
        if (h2 == null) {
            Element germanHeadline = doc.selectFirst("h2 span.mw-headline#German");
            if (germanHeadline == null) {
                germanHeadline = doc.selectFirst("span#German.mw-headline");
            }
            if (germanHeadline == null) {
                // Fallback: match by visible text.
                germanHeadline = doc.select("h2 span.mw-headline").stream()
                        .filter(el -> "German".equalsIgnoreCase(el.text().trim()))
                        .findFirst()
                        .orElse(null);
            }
            if (germanHeadline == null) {
                return null;
            }
            h2 = germanHeadline.closest("h2");
            if (h2 == null) {
                return null;
            }
        }

        // The H2 is often wrapped in a heading div; the actual section content comes after that wrapper.
        Element anchor = h2;
        if (h2.parent() != null && "div".equalsIgnoreCase(h2.parent().tagName()) && h2.parent().classNames().contains("mw-heading")) {
            anchor = h2.parent();
        }

        // Build a container containing all siblings until the next heading block (h2 or mw-heading2).
        Element container = new Element(Tag.valueOf("div"), "");
        Element cur = anchor.nextElementSibling();
        while (cur != null) {
            if ("h2".equalsIgnoreCase(cur.tagName())) {
                break;
            }
            if ("div".equalsIgnoreCase(cur.tagName()) && cur.classNames().contains("mw-heading") && cur.classNames().contains("mw-heading2")) {
                break;
            }
            container.appendChild(cur.clone());
            cur = cur.nextElementSibling();
        }
        return container;
    }

    private void extractGender(Element section, WordData data) {
        // Chỉ extract gender cho Noun thực sự.
        // Wiktionary dùng <span class="gender"> trong headword template — đây là nguồn chính xác nhất.
        Elements genderElements = section.select("span.gender");
        if (!genderElements.isEmpty()) {
            String genderText = genderElements.first().text().toLowerCase();
            if (genderText.contains("m")) data.setGender("DER");
            else if (genderText.contains("f")) data.setGender("DIE");
            else if (genderText.contains("n")) data.setGender("DAS");
        }

        // Fallback: headword line — chỉ xét dòng headword, không scan toàn section
        if (data.getGender() == null) {
            Element headword = section.selectFirst("strong.headword, span.headword-line");
            if (headword != null) {
                String hw = headword.text().toLowerCase().trim();
                if (hw.startsWith("der ")) data.setGender("DER");
                else if (hw.startsWith("die ")) data.setGender("DIE");
                else if (hw.startsWith("das ")) data.setGender("DAS");
            }
        }

        // Fallback: first <p> — chỉ match nếu article đứng đầu dòng
        if (data.getGender() == null) {
            Element firstP = section.selectFirst("p");
            if (firstP != null) {
                String line = firstP.text().toLowerCase().trim();
                if (line.startsWith("der ")) data.setGender("DER");
                else if (line.startsWith("die ")) data.setGender("DIE");
                else if (line.startsWith("das ")) data.setGender("DAS");
            }
        }
        // KHÔNG dùng full-text search — sẽ bắt nhầm article trong câu ví dụ
    }

    private void extractIpa(Element section, WordData data) {
        Element ipaNode = section.selectFirst("span.IPA");
        if (ipaNode != null && !ipaNode.text().isBlank()) {
            data.setIpa(ipaNode.text().trim());
            return;
        }
        Matcher m = IPA_FALLBACK.matcher(section.text());
        if (m.find()) {
            data.setIpa(m.group().trim());
        }
    }

    private void extractVerbData(Element section, WordData data) {
        String sectionText = section.text().toLowerCase(java.util.Locale.ROOT);

        // Partizip II — tìm trong inflection table hoặc headword
        // Wiktionary thường có dạng: "past participle: gelernt" hoặc trong bảng chia động từ
        Elements tables = section.select("table.inflection-table, table.wikitable");
        for (Element table : tables) {
            String tableText = table.text();
            // Tìm partizip II
            if (tableText.toLowerCase().contains("past participle") || tableText.toLowerCase().contains("partizip ii")) {
                Elements cells = table.select("td, th");
                for (int i = 0; i < cells.size() - 1; i++) {
                    String cellText = cells.get(i).text().toLowerCase();
                    if (cellText.contains("past participle") || cellText.contains("partizip")) {
                        String nextCell = cells.get(i + 1).text().trim();
                        if (!nextCell.isBlank() && nextCell.length() < 50) {
                            data.setPartizip2(nextCell.split("[,/\\s]+")[0].trim());
                            break;
                        }
                    }
                }
            }
        }

        // Auxiliary verb (sein/haben) — detect từ definition text
        // "sein" verbs: motion/state change verbs
        if (sectionText.contains("auxiliary: sein") || sectionText.contains("auxiliary verb: sein")
                || sectionText.contains("(sein)") || sectionText.contains("with sein")) {
            data.setAuxiliaryVerb("SEIN");
        } else if (sectionText.contains("auxiliary: haben") || sectionText.contains("(haben)")) {
            data.setAuxiliaryVerb("HABEN");
        }

        // Separable verb — detect từ headword hoặc definition
        // Wiktionary thường đánh dấu: "separable" hoặc prefix in bold
        if (sectionText.contains("separable") || sectionText.contains("trennbar")) {
            data.setIsSeparable(true);
        }

        // Reflexive verb
        if (sectionText.contains("reflexive") || sectionText.contains("reflexiv")
                || sectionText.contains("sich ")) {
            // Chỉ set reflexive nếu "sich" xuất hiện trong headword/definition, không phải ví dụ
            Element headword = section.selectFirst("strong.headword, p strong");
            if (headword != null && headword.text().toLowerCase().contains("sich")) {
                data.setIsReflexive(true);
            }
        }
    }

    private void extractUsageNote(Element section, WordData data) {
        // Try to find usage notes from Wiktionary "Usage notes" section
        Elements headers = section.select("h3, h4");
        for (Element h : headers) {
            String text = h.text().trim();
            if (text.equalsIgnoreCase("Usage notes") || text.equalsIgnoreCase("Gebrauchshinweise")) {
                Element next = h.nextElementSibling();
                if (next != null) {
                    String note = next.text().trim();
                    if (!note.isBlank() && note.length() > 10) {
                        data.setUsageNote(note.length() > 300 ? note.substring(0, 300) + "…" : note);
                        return;
                    }
                }
            }
        }

        // Fallback: build usage note from grammar info we already have
        StringBuilder note = new StringBuilder();
        if (data.getGender() != null) {
            String article = switch (data.getGender()) {
                case "DER" -> "der";
                case "DIE" -> "die";
                case "DAS" -> "das";
                default -> "";
            };
            note.append("Noun (").append(article).append(")");
            if (data.getPlural() != null && !data.getPlural().isBlank()) {
                note.append(", Plural: ").append(data.getPlural());
            }
        }
        if (!note.isEmpty()) {
            data.setUsageNote(note.toString());
        }
    }

    private void extractPlural(Element section, WordData data) {
        // Strategy 1: headword line — "plural <b class="Latn" lang="de">Häuser</b>"
        // Wiktionary format: "genitive Hauses, plural Häuser"
        Elements headwords = section.select("strong.headword, p.headword, .headword-line");
        for (Element hw : headwords) {
            String text = hw.text();
            // Find "plural X" pattern
            java.util.regex.Matcher m = java.util.regex.Pattern
                    .compile("plural\\s+([\\wäöüÄÖÜß\\-]+)", java.util.regex.Pattern.CASE_INSENSITIVE)
                    .matcher(text);
            if (m.find()) {
                String plural = m.group(1).trim();
                if (!plural.isBlank() && plural.length() <= 60) {
                    data.setPlural(plural);
                    return;
                }
            }
        }

        // Strategy 2: find "plural" keyword followed by bold/strong lang-de element
        // Pattern: <i>plural</i> <b class="Latn" lang="de">Häuser</b>
        Elements italics = section.select("i");
        for (Element i : italics) {
            if ("plural".equalsIgnoreCase(i.text().trim())) {
                // Next sibling element should be the plural form
                Element next = i.nextElementSibling();
                if (next != null) {
                    String plural = next.text().trim();
                    if (!plural.isBlank() && plural.length() <= 60) {
                        data.setPlural(plural);
                        return;
                    }
                }
                // Also check text node after <i>
                String parentText = i.parent() != null ? i.parent().text() : "";
                java.util.regex.Matcher m = java.util.regex.Pattern
                        .compile("plural\\s+([\\wäöüÄÖÜß\\-]+)", java.util.regex.Pattern.CASE_INSENSITIVE)
                        .matcher(parentText);
                if (m.find()) {
                    String plural = m.group(1).trim();
                    if (!plural.isBlank() && plural.length() <= 60) {
                        data.setPlural(plural);
                        return;
                    }
                }
            }
        }

        // Strategy 3: inflection table (some entries have it)
        Elements tables = section.select("table.inflection-table, table.wikitable");
        for (Element table : tables) {
            Elements cells = table.select("td, th");
            for (int i = 0; i < cells.size() - 1; i++) {
                String cellText = cells.get(i).text().toLowerCase().trim();
                if (cellText.contains("plural") || cellText.equals("pl.")) {
                    String nextCell = cells.get(i + 1).text().trim();
                    if (!nextCell.isBlank() && nextCell.length() <= 60
                            && !nextCell.equals("—") && !nextCell.equals("-")) {
                        data.setPlural(nextCell.split("[,/]")[0].trim());
                        return;
                    }
                }
            }
        }

        // Strategy 4: span.form-of.lang-de (old Wiktionary format)
        Elements pluralElements = section.select("span.form-of.lang-de");
        for (Element el : pluralElements) {
            String text = el.text();
            if (text.contains("plural")) {
                Element pluralForm = el.parent().selectFirst("strong.Latn");
                if (pluralForm != null) {
                    data.setPlural(pluralForm.text());
                    return;
                }
            }
        }
    }

    private void extractMeaning(Element section, WordData data) {
        Elements definitions = section.select("ol > li");
        if (definitions.isEmpty()) return;

        String raw = definitions.first().ownText();
        if (raw == null || raw.isBlank()) {
            raw = definitions.first().text();
        }
        if (raw == null) return;

        // Remove citations like [1], [2]
        String meaning = raw.replaceAll("\\[\\d+\\]", "").trim();

        // Strip parenthetical grammar labels at start: "(transitive)", "(intransitive, computing)"
        meaning = meaning.replaceAll("^\\([^)]{1,60}\\)\\s*", "").trim();

        // Cut at first inline example (German sentence followed by ―)
        int dashIdx = meaning.indexOf(" ― ");
        if (dashIdx > 0) {
            // Find the last period before the dash — that's where the gloss ends
            String beforeDash = meaning.substring(0, dashIdx);
            int lastPeriod = beforeDash.lastIndexOf(". ");
            if (lastPeriod > 10) {
                meaning = beforeDash.substring(0, lastPeriod + 1).trim();
            } else {
                // No period — check if there's a German sentence (starts with capital, ends before dash)
                // Split on first German sentence pattern
                int firstCap = -1;
                for (int i = 1; i < beforeDash.length(); i++) {
                    if (Character.isUpperCase(beforeDash.charAt(i)) && beforeDash.charAt(i - 1) == ' ') {
                        // Check if previous word ends with comma or is a gloss word
                        String prev = beforeDash.substring(0, i).trim();
                        if (prev.endsWith(",") || prev.length() < 80) {
                            firstCap = i;
                            break;
                        }
                    }
                }
                if (firstCap > 10) {
                    meaning = beforeDash.substring(0, firstCap).trim().replaceAll("[,\\s]+$", "");
                } else {
                    meaning = beforeDash.trim();
                }
            }
        }

        // Cut at Synonym/Antonym sections
        meaning = meaning.replaceAll("\\bSynonym(?:e)?\\b.*$", "").trim();
        meaning = meaning.replaceAll("\\bAntonym(?:e)?\\b.*$", "").trim();

        // Trim trailing punctuation noise
        meaning = meaning.replaceAll("[,;:\\s]+$", "").trim();

        data.setMeaning(meaning.isBlank() || meaning.length() < 2 ? null : meaning);
    }

    private void extractExamples(Element section, WordData data) {
        Elements definitions = section.select("ol > li");

        // Strategy: scan all definition items for "DE ― EN" patterns
        for (Element li : definitions) {
            String raw = li.text();
            if (raw == null || !raw.contains(" ― ")) continue;

            // Split on ― to get DE/EN pairs
            String[] segments = raw.split(" ― ");
            for (int i = 0; i < segments.length - 1; i++) {
                String left = segments[i].trim();
                String right = segments[i + 1].trim();

                // Extract the last German sentence from left side
                // German sentences: start with capital letter, contain German chars
                String de = extractLastSentence(left);
                // Extract first English sentence from right side
                String en = extractFirstSentence(right);

                if (de != null && de.length() > 5 && looksGerman(de)) {
                    // Validate: DE sentence should not be too long
                    if (de.length() <= 200) {
                        data.setExampleDe(de);
                        if (en != null && en.length() > 5 && en.length() <= 200) {
                            data.setExampleEn(en);
                        }
                        return;
                    }
                }
            }
        }

        // Fallback: quotation blocks
        Elements quotes = section.select("ul.quotations li, dd.quote, span.example, .h-usage-example");
        for (Element q : quotes) {
            String text = q.text();
            if (text != null && !text.isBlank() && text.length() > 5 && text.length() <= 300) {
                if (looksGerman(text)) {
                    data.setExampleDe(text.trim());
                    return;
                }
            }
        }
    }

    /** Lấy câu cuối cùng trong đoạn text (tách bởi ". ") */
    private String extractLastSentence(String text) {
        if (text == null || text.isBlank()) return null;
        // Remove grammar labels in parens at start
        String s = text.replaceAll("^\\([^)]{1,60}\\)\\s*", "").trim();
        // Remove gloss (short definition before first German sentence)
        // German sentence: starts with capital, contains German-specific chars or common German words
        int lastPeriod = s.lastIndexOf(". ");
        if (lastPeriod >= 0 && lastPeriod + 2 < s.length()) {
            String candidate = s.substring(lastPeriod + 2).trim();
            if (candidate.length() > 5) return candidate;
        }
        // No period — return whole thing if it looks like a sentence
        if (s.length() > 5 && s.length() <= 200) return s;
        return null;
    }

    /** Lấy câu đầu tiên trong đoạn text */
    private String extractFirstSentence(String text) {
        if (text == null || text.isBlank()) return null;
        int period = text.indexOf(". ");
        if (period > 5) return text.substring(0, period + 1).trim();
        if (text.length() <= 200) return text.trim();
        return null;
    }

    /** Kiểm tra text có vẻ là tiếng Đức không */
    private boolean looksGerman(String text) {
        if (text == null) return false;
        String lower = text.toLowerCase();
        // Contains German-specific characters or common German words
        return lower.contains("ä") || lower.contains("ö") || lower.contains("ü")
                || lower.contains("ß") || lower.contains(" ich ") || lower.contains(" sie ")
                || lower.contains(" der ") || lower.contains(" die ") || lower.contains(" das ")
                || lower.contains(" ist ") || lower.contains(" hat ") || lower.contains(" ein ")
                || lower.contains(" nicht ") || lower.contains(" und ") || lower.contains(" mit ")
                || lower.startsWith("ich ") || lower.startsWith("er ") || lower.startsWith("sie ")
                || lower.startsWith("wir ") || lower.startsWith("das ") || lower.startsWith("der ")
                || lower.startsWith("die ");
    }

        /**
         * Data class chứa thông tin từ vựng từ Wiktionary
         */
    public static class WordData {
        private String word;
        private String gender;       // DER, DIE, DAS — chỉ cho Noun
        private String ipa;
        private String plural;
        private String meaning;      // English meaning
        private String exampleDe;
        private String exampleEn;
        private String usageNote;
        // Verb-specific
        private String partizip2;    // e.g. "gelernt", "gegangen"
        private String auxiliaryVerb; // "HABEN" hoặc "SEIN"
        private Boolean isSeparable; // true nếu là trennbares Verb
        private String verbPrefix;   // e.g. "ab" từ "abholen"
        private Boolean isReflexive; // true nếu reflexiv (sich ...)

        public String getWord() { return word; }
        public void setWord(String word) { this.word = word; }
        public String getGender() { return gender; }
        public void setGender(String gender) { this.gender = gender; }
        public String getIpa() { return ipa; }
        public void setIpa(String ipa) { this.ipa = ipa; }
        public String getPlural() { return plural; }
        public void setPlural(String plural) { this.plural = plural; }
        public String getMeaning() { return meaning; }
        public void setMeaning(String meaning) { this.meaning = meaning; }
        public String getExampleDe() { return exampleDe; }
        public void setExampleDe(String exampleDe) { this.exampleDe = exampleDe; }
        public String getExampleEn() { return exampleEn; }
        public void setExampleEn(String exampleEn) { this.exampleEn = exampleEn; }
        public String getUsageNote() { return usageNote; }
        public void setUsageNote(String usageNote) { this.usageNote = usageNote; }
        public String getPartizip2() { return partizip2; }
        public void setPartizip2(String partizip2) { this.partizip2 = partizip2; }
        public String getAuxiliaryVerb() { return auxiliaryVerb; }
        public void setAuxiliaryVerb(String auxiliaryVerb) { this.auxiliaryVerb = auxiliaryVerb; }
        public Boolean getIsSeparable() { return isSeparable; }
        public void setIsSeparable(Boolean isSeparable) { this.isSeparable = isSeparable; }
        public String getVerbPrefix() { return verbPrefix; }
        public void setVerbPrefix(String verbPrefix) { this.verbPrefix = verbPrefix; }
        public Boolean getIsReflexive() { return isReflexive; }
        public void setIsReflexive(Boolean isReflexive) { this.isReflexive = isReflexive; }
    }
}
