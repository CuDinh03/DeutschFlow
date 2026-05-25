package com.deutschflow.vocabulary.service;

import com.deutschflow.vocabulary.dto.GlosbeLexicalEntry;
import com.deutschflow.vocabulary.dto.WordNounDeclensionItem;
import com.deutschflow.vocabulary.dto.WordVerbConjugationItem;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class GlosbeHtmlParser {

    private static final Pattern IPA_PATTERN = Pattern.compile("/[^/]{2,80}/");
    private static final Pattern GENDER_PATTERN = Pattern.compile("\\b(der|die|das)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern PRONOUN_FORM_PATTERN = Pattern.compile(
            "^(ich|du|er/sie/es|wir|ihr|sie|Sie)\\s+(.+)$",
            Pattern.CASE_INSENSITIVE
    );

    public Set<String> parseWordLinks(Document document, String baseDomain) {
        Set<String> links = new LinkedHashSet<>();
        for (Element anchor : document.select("a[href]")) {
            String href = anchor.attr("href").trim();
            if (href.isBlank()) {
                continue;
            }
            String abs = anchor.absUrl("href");
            String text = normalize(anchor.text());
            if (abs.isBlank()) {
                continue;
            }
            if (!abs.startsWith(baseDomain + "/de/vi")) {
                continue;
            }
            if (abs.contains("?")) {
                continue;
            }
            if (text.length() < 2) {
                continue;
            }
            links.add(abs);
        }
        return links;
    }

    public String parseNextPageLink(Document document) {
        for (Element anchor : document.select("a[rel=next], a[href]")) {
            String label = normalize(anchor.text()).toLowerCase(Locale.ROOT);
            if (!label.contains("next") && !label.contains("trang") && !label.contains("more")) {
                continue;
            }
            String abs = anchor.absUrl("href");
            if (!abs.isBlank()) {
                return abs;
            }
        }
        return null;
    }

    public GlosbeLexicalEntry parseDetail(Document document, String sourceUrl) {
        String pageText = normalize(document.text());
        String baseForm = extractBaseForm(document, sourceUrl);
        if (baseForm == null || baseForm.isBlank()) {
            return null;
        }

        String phonetic = parsePhonetic(document, pageText);
        String meaningVi = parseVietnameseMeaning(document);
        String meaningDe = baseForm;
        String exampleDe = parseGermanExample(document);
        String exampleVi = parseVietnameseExample(document, exampleDe);
        String gender = parseGender(document);
        String dtype = inferDtype(baseForm, gender, pageText);
        String usageNote = buildUsageNote(dtype, gender);
        String nounPlural = parsePlural(document, pageText);
        List<WordVerbConjugationItem> verbConjugations = parseVerbConjugations(document);
        String verbPartizip2 = parsePartizip2(document, pageText);

        List<String> missingFields = new ArrayList<>();
        if (phonetic == null) missingFields.add("phonetic");
        if (meaningVi == null) missingFields.add("meaning_vi");
        if (exampleDe == null) missingFields.add("example_de");
        if (exampleVi == null) missingFields.add("example_vi");
        if ("Noun".equals(dtype) && gender == null) missingFields.add("noun_gender");
        if ("Verb".equals(dtype) && verbConjugations.isEmpty()) missingFields.add("verb_conjugations");

        return new GlosbeLexicalEntry(
                baseForm,
                dtype,
                "A1",
                phonetic,
                usageNote,
                meaningVi,
                meaningDe,
                exampleDe,
                exampleVi,
                gender,
                nounPlural,
                null,
                "STARK",
                List.of(),
                "HABEN",
                verbPartizip2,
                Boolean.FALSE,
                null,
                Boolean.FALSE,
                verbConjugations,
                missingFields,
                sourceUrl
        );
    }

    private String extractBaseForm(Document document, String sourceUrl) {
        Element h1 = document.selectFirst("h1");
        if (h1 != null) {
            String text = normalize(h1.text());
            if (looksLikeWord(text)) {
                return text;
            }
        }
        String fromUrl = sourceUrl.substring(sourceUrl.lastIndexOf('/') + 1);
        fromUrl = normalize(fromUrl.replace('-', ' '));
        if (looksLikeWord(fromUrl)) {
            return fromUrl;
        }
        return null;
    }

    private String parsePhonetic(Document document, String pageText) {
        for (Element node : document.select("span, div, p, li")) {
            Matcher m = IPA_PATTERN.matcher(node.text());
            if (m.find()) {
                return m.group();
            }
        }
        Matcher m = IPA_PATTERN.matcher(pageText);
        if (m.find()) {
            return m.group();
        }
        return null;
    }

    private String parseVietnameseMeaning(Document document) {
        for (Element node : document.select("li, div, p, span")) {
            String text = normalize(node.text());
            if (text.isBlank()) continue;
            if (containsVietnamese(text) && text.length() >= 2 && text.length() <= 180) {
                return text;
            }
        }
        return null;
    }

    private String parseGermanExample(Document document) {
        for (Element node : document.select("li, p, div")) {
            String text = normalize(node.text());
            if (text.length() < 8 || text.length() > 220) continue;
            if (!text.contains(" ")) continue;
            if (containsVietnamese(text)) continue;
            if (looksLikeSentence(text)) {
                return text;
            }
        }
        return null;
    }

    private String parseVietnameseExample(Document document, String germanExample) {
        if (germanExample == null) {
            return null;
        }
        for (Element node : document.select("li, p, div")) {
            String text = normalize(node.text());
            if (text.length() < 8 || text.length() > 260) continue;
            if (!containsVietnamese(text)) continue;
            if (text.equalsIgnoreCase(germanExample)) continue;
            return text;
        }
        return null;
    }

    private String parseGender(Document document) {
        Matcher inline = GENDER_PATTERN.matcher(normalize(document.text()));
        if (inline.find()) {
            return inline.group().toUpperCase(Locale.ROOT);
        }
        return null;
    }

    private String parsePlural(Document document, String pageText) {
        for (Element node : document.select("li, p, div, span")) {
            String text = normalize(node.text()).toLowerCase(Locale.ROOT);
            if (!text.contains("plural")) continue;
            String cleaned = text.replace("plural", "").replace(":", "").trim();
            if (!cleaned.isBlank() && cleaned.length() <= 120) {
                return cleaned;
            }
        }
        return pageText.toLowerCase(Locale.ROOT).contains("plural") ? "n/a" : null;
    }

    private List<WordVerbConjugationItem> parseVerbConjugations(Document document) {
        List<WordVerbConjugationItem> out = new ArrayList<>();
        for (Element node : document.select("li, p, td, div")) {
            String text = normalize(node.text());
            Matcher m = PRONOUN_FORM_PATTERN.matcher(text);
            if (!m.find()) continue;
            String pronoun = mapPronoun(m.group(1));
            if (pronoun == null) continue;
            String form = m.group(2).trim();
            if (form.isBlank()) continue;
            out.add(new WordVerbConjugationItem("PRASENS", pronoun, form));
        }
        return out.stream().distinct().limit(6).toList();
    }

    private String parsePartizip2(Document document, String pageText) {
        for (Element node : document.select("li, p, div, span")) {
            String text = normalize(node.text());
            if (text.toLowerCase(Locale.ROOT).contains("partizip ii")) {
                int idx = text.indexOf(':');
                if (idx > -1 && idx < text.length() - 1) {
                    return text.substring(idx + 1).trim();
                }
                return text;
            }
        }
        return pageText.toLowerCase(Locale.ROOT).contains("ge") ? "n/a" : null;
    }

    private String inferDtype(String baseForm, String gender, String pageText) {
        String normalized = baseForm.toLowerCase(Locale.ROOT);
        String lower = pageText.toLowerCase(Locale.ROOT);
        if (gender != null || lower.contains("noun") || Character.isUpperCase(baseForm.charAt(0))) {
            return "Noun";
        }
        if (normalized.endsWith("en") || lower.contains("conjugation") || lower.contains("verb")) {
            return "Verb";
        }
        if (lower.contains("adjective")) {
            return "Adjective";
        }
        return "Word";
    }

    private String buildUsageNote(String dtype, String gender) {
        if ("Noun".equals(dtype)) {
            String articleHint = gender == null ? "mạo từ chưa xác định" : gender.toLowerCase(Locale.ROOT);
            return "Danh từ từ Glosbe, học kèm mạo từ (" + articleHint + "), số nhiều và ví dụ.";
        }
        if ("Verb".equals(dtype)) {
            return "Động từ từ Glosbe, ưu tiên học kèm chia theo ngôi và ví dụ theo ngữ cảnh.";
        }
        if ("Adjective".equals(dtype)) {
            return "Tính từ từ Glosbe, cần luyện biến đổi đuôi theo giống, số và cách.";
        }
        return "Mục từ từ Glosbe, nên học cùng câu ví dụ để nhớ ngữ cảnh.";
    }

    private String mapPronoun(String raw) {
        return switch (raw.toLowerCase(Locale.ROOT)) {
            case "ich" -> "ICH";
            case "du" -> "DU";
            case "er/sie/es" -> "ER_SIE_ES";
            case "wir" -> "WIR";
            case "ihr" -> "IHR";
            case "sie" -> "SIE_FORMAL";
            default -> null;
        };
    }

    private boolean containsVietnamese(String text) {
        for (char c : text.toCharArray()) {
            if ("ăâđêôơưĂÂĐÊÔƠƯ".indexOf(c) >= 0) return true;
            if (c >= 0x1EA0 && c <= 0x1EF9) return true;
        }
        return false;
    }

    private boolean looksLikeSentence(String text) {
        if (text.chars().filter(ch -> ch == ' ').count() < 2) {
            return false;
        }
        return text.endsWith(".") || text.endsWith("!") || text.endsWith("?");
    }

    private boolean looksLikeWord(String value) {
        if (value == null || value.isBlank()) return false;
        String cleaned = value.trim();
        if (cleaned.length() < 2 || cleaned.length() > 80) return false;
        return cleaned.matches("[\\p{L}\\-\\s]+");
    }

    private String normalize(String raw) {
        if (raw == null) return "";
        String normalized = Normalizer.normalize(raw, Normalizer.Form.NFKC).trim();
        return normalized.replace('\u00A0', ' ').replaceAll("\\s+", " ");
    }
}
