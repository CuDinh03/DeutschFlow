package com.deutschflow.vocabulary.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Nạp {@code wordlists/goethe_official_wordlist.tsv} (sinh từ {@code scripts/extract_goethe_pdfs.py}):
 * lemma, {@code cefr_level}, và ví dụ tiếng Đức vào {@code word_translations} (locale {@code de}).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GoetheOfficialWordlistImportService {

    private static final String CLASSPATH_TSV = "wordlists/goethe_official_wordlist.tsv";
    private static final String TAG_NAME = "GOETHE_OFFICIAL_LIST";
    private static final int MAX_EXAMPLE = 4000;

    private final JdbcTemplate jdbcTemplate;
    private final LocalLexiconService localLexiconService;

    @Transactional
    public Map<String, Object> importFromClasspathTsv() {
        String body = ClasspathWordlistReader.readUtf8(CLASSPATH_TSV);
        long tagId = ensureTag();

        int insertedWords = 0;
        int updatedWords = 0;
        int skippedRows = 0;
        int examplesApplied = 0;

        for (String raw : body.split("\\R")) {
            String line = raw == null ? "" : raw.trim();
            if (line.isEmpty() || line.startsWith("cefr\t") || line.startsWith("cefr,")) {
                continue;
            }
            String[] parts = line.split("\t", 3);
            if (parts.length < 3) {
                skippedRows++;
                continue;
            }
            String cefr = normalizeCefr(parts[0]);
            String rawLemma = parts[1].trim();
            String exampleDe = parts[2].trim();
            if (rawLemma.isEmpty() || cefr == null) {
                skippedRows++;
                continue;
            }
            if (exampleDe.length() > MAX_EXAMPLE) {
                exampleDe = exampleDe.substring(0, MAX_EXAMPLE);
            }

            // ── Parse lemma: tách article, base_form, plural ──────────────
            ParsedLemma parsed = parseLemma(rawLemma);
            String baseForm = parsed.baseForm();
            String gender   = parsed.gender();
            String plural   = parsed.plural();
            String dtype    = parsed.dtype();

            if (baseForm.isEmpty()) {
                skippedRows++;
                continue;
            }

            Long wordId = findWordIdByLemma(baseForm, cefr);
            boolean inserted = false;
            boolean updated  = false;

            if (wordId == null) {
                jdbcTemplate.update(
                        "INSERT INTO words (dtype, base_form, cefr_level, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())",
                        dtype, baseForm, cefr
                );
                wordId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
                inserted = true;
                insertedWords++;
            } else {
                String current = jdbcTemplate.queryForObject(
                        "SELECT cefr_level FROM words WHERE id = ?", String.class, wordId);
                if (shouldUpgradeCefr(current, cefr)) {
                    jdbcTemplate.update("UPDATE words SET cefr_level = ?, updated_at = NOW() WHERE id = ?", cefr, wordId);
                    updated = true;
                    updatedWords++;
                }
                // Update dtype if currently generic
                jdbcTemplate.update(
                        "UPDATE words SET dtype = ?, updated_at = NOW() WHERE id = ? AND dtype = 'Word'",
                        dtype, wordId);
            }

            if (wordId == null) { skippedRows++; continue; }

            // ── Lưu gender + plural vào nouns table ──────────────────────
            if ("Noun".equals(dtype) && gender != null) {
                String resolvedPlural = resolvePluralForm(baseForm, plural);
                jdbcTemplate.update(
                        """
                        INSERT INTO nouns (id, gender, plural_form, genitive_form, noun_type)
                        VALUES (?, ?, ?, ?, 'STARK')
                        ON DUPLICATE KEY UPDATE
                          gender = CASE WHEN gender IS NULL THEN VALUES(gender) ELSE gender END,
                          plural_form = CASE WHEN plural_form IS NULL OR TRIM(plural_form) = '' THEN VALUES(plural_form) ELSE plural_form END,
                          genitive_form = CASE WHEN genitive_form IS NULL OR TRIM(genitive_form) = '' THEN VALUES(genitive_form) ELSE genitive_form END
                        """,
                        wordId, gender, resolvedPlural, plural
                );
            }

            // ── Lưu verb data (separable, reflexive, prefix) ─────────────
            if ("Verb".equals(dtype)) {
                jdbcTemplate.update(
                        """
                        INSERT INTO verbs (id, auxiliary_verb, partizip2, is_separable, prefix, is_irregular)
                        VALUES (?, 'HABEN', NULL, ?, ?, FALSE)
                        ON DUPLICATE KEY UPDATE
                          is_separable = CASE WHEN ? THEN TRUE ELSE is_separable END,
                          prefix = CASE WHEN ? IS NOT NULL AND (prefix IS NULL OR prefix = '') THEN ? ELSE prefix END
                        """,
                        wordId,
                        parsed.isSeparable(),
                        parsed.verbPrefix(),
                        parsed.isSeparable(),
                        parsed.verbPrefix(), parsed.verbPrefix()
                );
            }

            jdbcTemplate.update("INSERT IGNORE INTO word_tags (word_id, tag_id) VALUES (?, ?)", wordId, tagId);
            applyTranslations(wordId, baseForm, exampleDe);
            examplesApplied++;

            if (inserted || updated) {
                log.debug("goethe official: {} ({}) {} inserted={} updated={}", baseForm, gender, cefr, inserted, updated);
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("classpath", CLASSPATH_TSV);
        out.put("insertedWords", insertedWords);
        out.put("updatedCefrRows", updatedWords);
        out.put("examplesApplied", examplesApplied);
        out.put("skippedRows", skippedRows);
        out.put("tag", TAG_NAME);
        return out;
    }

    // ── Lemma parser ──────────────────────────────────────────────────────────

    private record ParsedLemma(String baseForm, String gender, String plural, String dtype,
                               boolean isSeparable, String verbPrefix, boolean isReflexive) {}

    /**
     * Parse các dạng lemma từ Goethe TSV:
     * - "der Arbeitsplatz, -ä, e"  → Noun, gender=DER, plural
     * - "abholen"                  → Verb, separable=true, prefix="ab"
     * - "sich freuen"              → Verb, reflexive=true
     * - "bekannt"                  → Adjective
     * - "auf"                      → Word
     */
    private ParsedLemma parseLemma(String raw) {
        if (raw == null || raw.isBlank()) return new ParsedLemma("", null, null, "Word", false, null, false);

        String s = raw.trim();
        String gender = null;
        String plural = null;
        boolean isSeparable = false;
        String verbPrefix = null;
        boolean isReflexive = false;

        // 1. Detect article prefix → Noun
        String lower = s.toLowerCase(Locale.ROOT);
        if (lower.startsWith("der ")) { gender = "DER"; s = s.substring(4).trim(); }
        else if (lower.startsWith("die ")) { gender = "DIE"; s = s.substring(4).trim(); }
        else if (lower.startsWith("das ")) { gender = "DAS"; s = s.substring(4).trim(); }
        else if (lower.startsWith("der/die ") || lower.startsWith("die/der ")) {
            gender = "DER"; s = s.replaceFirst("(?i)^(der/die|die/der)\\s+", "").trim();
        }

        // 2. Detect reflexive: "sich freuen", "(sich) anmelden"
        if (lower.startsWith("sich ")) {
            isReflexive = true;
            s = s.substring(5).trim();
        } else if (lower.startsWith("(sich) ")) {
            isReflexive = true;
            s = s.substring(7).trim();
        }

        // 3. Split off plural info after first comma
        int commaIdx = s.indexOf(',');
        if (commaIdx > 0) {
            plural = s.substring(commaIdx + 1).trim();
            s = s.substring(0, commaIdx).trim();
        }

        // 4. Strip parenthetical
        int parenIdx = s.indexOf('(');
        if (parenIdx > 0) s = s.substring(0, parenIdx).trim();

        String baseForm = s.trim();

        // 5. Infer dtype
        String dtype;
        if (gender != null) {
            dtype = "Noun";
        } else {
            dtype = inferDtype(baseForm);
        }

        // 6. Detect separable verb: prefix ends with "-" in TSV (e.g. "ab-holen") or common prefixes
        if ("Verb".equals(dtype)) {
            // Goethe TSV sometimes has "ab-" prefix notation
            if (baseForm.contains("-")) {
                int dashIdx = baseForm.indexOf('-');
                verbPrefix = baseForm.substring(0, dashIdx).toLowerCase(Locale.ROOT);
                baseForm = baseForm.replace("-", "");
                isSeparable = true;
            } else {
                // Detect common separable prefixes
                verbPrefix = detectSeparablePrefix(baseForm);
                isSeparable = verbPrefix != null;
            }
        }

        return new ParsedLemma(baseForm, gender, plural, dtype, isSeparable, verbPrefix, isReflexive);
    }

    private static final java.util.Set<String> SEPARABLE_PREFIXES = java.util.Set.of(
        "ab", "an", "auf", "aus", "bei", "ein", "fest", "fort", "her", "hin",
        "los", "mit", "nach", "vor", "weg", "weiter", "zu", "zurück", "zusammen",
        "rein", "raus", "rauf", "runter", "rüber", "durch", "um", "über", "unter"
    );

    private String detectSeparablePrefix(String verb) {
        if (verb == null || verb.length() < 4) return null;
        String vl = verb.toLowerCase(Locale.ROOT);
        for (String prefix : SEPARABLE_PREFIXES) {
            if (vl.startsWith(prefix) && vl.length() > prefix.length() + 2) {
                // Verify the rest looks like a verb stem
                String stem = vl.substring(prefix.length());
                if (stem.endsWith("en") || stem.endsWith("eln") || stem.endsWith("ern")) {
                    return prefix;
                }
            }
        }
        return null;
    }

    /**
     * Resolve Goethe plural shorthand thành dạng số nhiều thực.
     *
     * Shorthand conventions:
     *   "-"      → không đổi:          Essen → Essen
     *   "-n"     → thêm -n:            Auge  → Augen
     *   "-en"    → thêm -en:           Bett  → Betten
     *   "-e"     → thêm -e:            Bier  → Biere
     *   "-er"    → thêm -er:           Ei    → Eier
     *   "-s"     → thêm -s:            Baby  → Babys
     *   "¨-"     → umlaut, không thêm: Mutter → Mütter (không đủ info, giữ shorthand)
     *   "¨-e"    → umlaut + -e:        Arzt  → Ärzte
     *   "¨-er"   → umlaut + -er:       Bad   → Bäder
     *   "¨-en"   → umlaut + -en:       (hiếm)
     *   "-ä, e"  → umlaut + -e:        Arbeitsplatz → Arbeitsplätze
     *   "-ü, e"  → umlaut + -e
     *   "-ö, e"  → umlaut + -e
     *
     * Nếu không resolve được → trả về null (frontend sẽ hiển thị shorthand từ genitive_form).
     */
    static String resolvePluralForm(String baseForm, String shorthand) {
        if (shorthand == null || shorthand.isBlank() || baseForm == null || baseForm.isBlank()) {
            return null;
        }
        String s = shorthand.trim();

        // Không đổi: "-" hoặc "–"
        if (s.equals("-") || s.equals("–") || s.equals("—")) {
            return baseForm;
        }

        // Detect umlaut flag
        boolean umlaut = s.startsWith("¨") || s.startsWith("\"");
        if (umlaut) s = s.substring(1).trim();

        // Normalize: "-ä, e" → "-e" (umlaut đã được đánh dấu bởi ký tự ä/ö/ü trong shorthand)
        // Một số TSV dùng "-ä, e" thay vì "¨-e"
        if (s.matches("^-[äöü],\\s*[a-z]+$")) {
            umlaut = true;
            s = "-" + s.replaceAll("^-[äöü],\\s*", "");
        }

        // Xác định suffix cần thêm
        String suffix = "";
        if (s.startsWith("-")) {
            suffix = s.substring(1); // e.g. "n", "en", "e", "er", "s", ""
        } else if (s.isEmpty()) {
            suffix = "";
        } else {
            // Không nhận dạng được
            return null;
        }

        // Apply umlaut lên nguyên âm cuối cùng trong baseForm
        String stem = umlaut ? applyUmlaut(baseForm) : baseForm;
        if (stem == null) return null; // không có nguyên âm để umlaut

        return stem + suffix;
    }

    /**
     * Áp dụng umlaut lên nguyên âm cuối cùng trong từ:
     * a→ä, o→ö, u→ü, au→äu (case-insensitive, giữ nguyên case)
     */
    private static String applyUmlaut(String word) {
        if (word == null || word.isEmpty()) return word;
        String lower = word.toLowerCase(java.util.Locale.ROOT);

        // Tìm "au" diphthong — ưu tiên nếu không có nguyên âm nào sau nó
        int auIdx = lower.lastIndexOf("au");
        if (auIdx >= 0) {
            boolean hasVowelAfterAu = false;
            for (int i = auIdx + 2; i < lower.length(); i++) {
                char c = lower.charAt(i);
                if (c == 'a' || c == 'o' || c == 'u' || c == 'e' || c == 'i') {
                    hasVowelAfterAu = true;
                    break;
                }
            }
            if (!hasVowelAfterAu) {
                return word.substring(0, auIdx) + "äu" + word.substring(auIdx + 2);
            }
        }

        // Tìm nguyên âm đơn cuối cùng (a, o, u) — case-insensitive
        int best = -1;
        char bestChar = 0;
        for (int i = lower.length() - 1; i >= 0; i--) {
            char c = lower.charAt(i);
            if (c == 'a' || c == 'o' || c == 'u') {
                best = i;
                bestChar = c;
                break;
            }
        }
        if (best < 0) return null;
        String umlautChar = switch (bestChar) {
            case 'a' -> "ä";
            case 'o' -> "ö";
            case 'u' -> "ü";
            default  -> null;
        };
        if (umlautChar == null) return null;
        return word.substring(0, best) + umlautChar + word.substring(best + 1);
    }

    private void applyTranslations(long wordId, String lemma, String exampleDe) {
        var lex = localLexiconService.lookup(lemma);

        String viMeaning = lex.map(LocalLexiconService.LocalEntry::vi).filter(s -> !s.isBlank()).orElse(null);
        String enMeaning = lex.map(LocalLexiconService.LocalEntry::en).filter(s -> !s.isBlank()).orElse(null);
        String lexExampleDe = lex.map(LocalLexiconService.LocalEntry::exampleDe).filter(s -> !s.isBlank()).orElse(null);

        // Canonical: German example lives in locale='de'. EN/VI examples are filled by Wiktionary/other sources.
        upsertTranslation(wordId, "de", null, exampleDe);
        upsertTranslation(wordId, "en", enMeaning, null);
        upsertTranslation(wordId, "vi", viMeaning, null);

        // If local lexicon includes a DE example, also use it to fill missing DE example.
        if (lexExampleDe != null) {
            upsertTranslation(wordId, "de", null, lexExampleDe.length() > 500 ? lexExampleDe.substring(0, 500) : lexExampleDe);
        }
    }

    private void upsertTranslation(Long wordId, String locale, String meaning, String example) {
        jdbcTemplate.update(
                """
                INSERT INTO word_translations (word_id, locale, meaning, example)
                VALUES (?, ?, COALESCE(?, ''), ?)
                ON DUPLICATE KEY UPDATE
                  meaning = CASE
                    WHEN (meaning IS NULL OR TRIM(meaning) = '' OR meaning LIKE 'Not in wordlists/local_lexicon.tsv%%' OR meaning LIKE 'Chưa có trong wordlists/local_lexicon.tsv%%')
                      AND (? IS NOT NULL AND TRIM(?) <> '')
                    THEN ?
                    ELSE meaning
                  END,
                  example = CASE
                    WHEN (example IS NULL OR TRIM(example) = '' OR example LIKE 'Beispiel: Das Wort %%')
                      AND (? IS NOT NULL AND TRIM(?) <> '')
                    THEN ?
                    ELSE example
                  END
                """,
                wordId,
                locale,
                meaning,
                example,
                meaning, meaning, meaning,
                example, example, example
        );
    }

    private Long findWordIdByLemma(String lemma, String cefrLevel) {
        String level = normalizeCefr(cefrLevel);
        // Prefer the row whose CEFR matches the source TSV and whose base_form is clean (no comma noise).
        return jdbcTemplate.query(
                """
                SELECT id
                FROM words
                WHERE LOWER(base_form) = LOWER(?)
                  AND base_form NOT LIKE '%%,%%'
                ORDER BY
                  CASE WHEN cefr_level = ? THEN 1 ELSE 0 END DESC,
                  id ASC
                LIMIT 1
                """,
                rs -> rs.next() ? rs.getLong("id") : null,
                lemma,
                level == null ? "" : level
        );
    }

    private String normalizeCefr(String raw) {
        if (raw == null) {
            return null;
        }
        String u = raw.trim().toUpperCase(Locale.ROOT);
        if (u.equals("A1") || u.equals("A2") || u.equals("B1")) {
            return u;
        }
        return null;
    }

    private int rankCefr(String level) {
        if (level == null) {
            return 0;
        }
        return switch (level.toUpperCase(Locale.ROOT)) {
            case "A1" -> 1;
            case "A2" -> 2;
            case "B1" -> 3;
            case "B2" -> 4;
            case "C1" -> 5;
            default -> 0;
        };
    }

    private boolean shouldUpgradeCefr(String current, String incoming) {
        if (incoming == null) {
            return false;
        }
        if (current == null || current.isBlank()) {
            return true;
        }
        return rankCefr(incoming) > rankCefr(current);
    }

    private static final java.util.Set<String> KNOWN_ADJECTIVES = java.util.Set.of(
        "alt","neu","gut","groß","klein","lang","kurz","jung","warm","kalt",
        "schnell","langsam","laut","leise","billig","teuer","schwer","leicht",
        "dunkel","hell","schön","hübsch","hässlich","sauber","schmutzig",
        "voll","leer","offen","richtig","falsch","einfach","schwierig",
        "möglich","nötig","wichtig","interessant","langweilig","lustig",
        "traurig","froh","glücklich","müde","krank","gesund","stark","schwach",
        "breit","schmal","hoch","tief","nah","weit","früh","spät","fertig",
        "bereit","bekannt","beliebt","typisch","normal","natürlich","direkt",
        "genau","sicher","gefährlich","ruhig","lecker","süß","sauer","bitter",
        "salzig","scharf","weich","hart","nass","trocken","frisch","modern",
        "international","national","lokal","sozial","politisch","technisch",
        "digital","öffentlich","privat","persönlich","offiziell","professionell",
        "praktisch","positiv","negativ","aktiv","passiv","kreativ","intelligent",
        "ehrlich","freundlich","höflich","grob","nett","böse","lieb","streng",
        "riesig","winzig","dick","dünn","flach","rund","gerade","bunt","grau"
    );

    private String inferDtype(String word) {
        if (word == null || word.isBlank()) return "Word";
        String w = word.trim();
        String wl = w.toLowerCase(Locale.ROOT);

        // Verb: kết thúc bằng -en, -eln, -ern, -ieren và bắt đầu chữ thường
        if (!Character.isUpperCase(w.charAt(0))) {
            if (wl.endsWith("ieren") || wl.endsWith("eln") || wl.endsWith("ern")) return "Verb";
            if (wl.endsWith("en") && w.length() > 3) {
                // Loại trừ adverbs/prepositions thường gặp
                if (!wl.equals("oben") && !wl.equals("unten") && !wl.equals("neben")
                        && !wl.equals("zwischen") && !wl.equals("innen") && !wl.equals("außen")
                        && !wl.equals("hinten") && !wl.equals("vorne") && !wl.equals("daneben")
                        && !wl.equals("dazwischen") && !wl.equals("nebenan")) {
                    return "Verb";
                }
            }
            // Adjective: suffix đặc trưng
            if (wl.endsWith("ig") || wl.endsWith("lich") || wl.endsWith("isch")
                    || wl.endsWith("los") || wl.endsWith("sam") || wl.endsWith("bar")
                    || wl.endsWith("haft") || wl.endsWith("voll") || wl.endsWith("reich")
                    || wl.endsWith("arm") || wl.endsWith("frei") || wl.endsWith("wert")
                    || wl.endsWith("fähig") || wl.endsWith("mäßig")) {
                return "Adjective";
            }
            // Adjective: danh sách cứng
            if (KNOWN_ADJECTIVES.contains(wl)) return "Adjective";
        }

        // Noun: bắt đầu chữ hoa
        if (Character.isUpperCase(w.charAt(0))) return "Noun";

        return "Word";
    }

    private long ensureTag() {
        jdbcTemplate.update(
                "INSERT INTO tags (name, color) VALUES (?, ?) ON DUPLICATE KEY UPDATE color = VALUES(color)",
                TAG_NAME,
                "#0d9488"
        );
        Long id = jdbcTemplate.query(
                "SELECT id FROM tags WHERE name = ? LIMIT 1",
                rs -> rs.next() ? rs.getLong("id") : null,
                TAG_NAME
        );
        if (id == null) {
            throw new IllegalStateException("Cannot resolve tag id for " + TAG_NAME);
        }
        return id;
    }
}
