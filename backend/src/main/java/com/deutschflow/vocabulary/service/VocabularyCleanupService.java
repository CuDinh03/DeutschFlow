package com.deutschflow.vocabulary.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Cleanup utilities for imported vocabulary data.
 */
@Service
@RequiredArgsConstructor
public class VocabularyCleanupService {
    private final JdbcTemplate jdbcTemplate;

    public Map<String, Object> dbInfo() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("database", jdbcTemplate.queryForObject("SELECT current_database()", String.class));
        out.put("version", jdbcTemplate.queryForObject("SELECT version()", String.class));
        out.put("host", jdbcTemplate.queryForObject("SELECT COALESCE(inet_server_addr()::text, '')", String.class));
        out.put("port", jdbcTemplate.queryForObject("SELECT inet_server_port()", Integer.class));
        out.put("currentUser", jdbcTemplate.queryForObject("SELECT current_user", String.class));
        out.put("sessionUser", jdbcTemplate.queryForObject("SELECT session_user", String.class));
        return out;
    }

    public Map<String, Object> searchWordsByBaseForm(String query, Integer limit) {
        String q = query == null ? "" : query.trim();
        int cap = (limit == null || limit < 1) ? 50 : Math.min(limit, 500);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("query", q);
        out.put("limit", cap);

        if (q.isBlank()) {
            out.put("items", List.of());
            return out;
        }

        String like = "%" + q + "%";
        List<Map<String, Object>> items = jdbcTemplate.query(
                """
                SELECT id, base_form, cefr_level, dtype
                FROM words
                WHERE base_form LIKE ?
                ORDER BY id ASC
                LIMIT ?
                """,
                new Object[]{like, cap},
                (rs, rowNum) -> Map.of(
                        "id", rs.getLong("id"),
                        "baseForm", rs.getString("base_form"),
                        "cefrLevel", rs.getString("cefr_level"),
                        "dtype", rs.getString("dtype")
                )
        );
        out.put("items", items);
        return out;
    }

    public Map<String, Object> sampleConcatenatedLemmas(Integer limit) {
        int cap = (limit == null || limit < 1) ? 50 : Math.min(limit, 500);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("limit", cap);
        Long total = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM words
                WHERE base_form ~ '[[:lower:]][[:upper:]]'
                  AND base_form NOT LIKE '% %'
                  AND CHAR_LENGTH(base_form) >= 20
                """,
                Long.class
        );
        out.put("matchedTotal", total == null ? 0 : total);
        List<Map<String, Object>> items = jdbcTemplate.query(
                """
                SELECT id, base_form, cefr_level, dtype
                FROM words
                WHERE base_form ~ '[[:lower:]][[:upper:]]'
                  AND base_form NOT LIKE '% %'
                  AND CHAR_LENGTH(base_form) >= 20
                ORDER BY id ASC
                LIMIT ?
                """,
                new Object[]{cap},
                (rs, rowNum) -> Map.of(
                        "id", rs.getLong("id"),
                        "baseForm", rs.getString("base_form"),
                        "cefrLevel", rs.getString("cefr_level"),
                        "dtype", rs.getString("dtype")
                )
        );
        out.put("items", items);
        return out;
    }

    @Transactional
    public Map<String, Object> updateWord(long wordId, Map<String, Object> body) {
        // Validate word exists
        Integer exists = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM words WHERE id = ?", Integer.class, wordId);
        if (exists == null || exists == 0) {
            throw new IllegalArgumentException("Word not found: " + wordId);
        }

        // Update words table
        String baseForm  = str(body.get("baseForm"));
        String cefrLevel = str(body.get("cefrLevel"));
        String dtype     = str(body.get("dtype"));
        String phonetic  = str(body.get("phonetic"));
        String usageNote = str(body.get("usageNote"));

        if (!baseForm.isBlank()) {
            jdbcTemplate.update("UPDATE words SET base_form = ?, updated_at = NOW() WHERE id = ?", baseForm, wordId);
        }
        if (!cefrLevel.isBlank()) {
            jdbcTemplate.update("UPDATE words SET cefr_level = ?, updated_at = NOW() WHERE id = ?", cefrLevel, wordId);
        }
        if (!dtype.isBlank()) {
            jdbcTemplate.update("UPDATE words SET dtype = ?, updated_at = NOW() WHERE id = ?", dtype, wordId);
        }
        // phonetic và usageNote có thể set về rỗng (xóa)
        if (body.containsKey("phonetic")) {
            jdbcTemplate.update("UPDATE words SET phonetic = NULLIF(?, ''), updated_at = NOW() WHERE id = ?", phonetic, wordId);
        }
        if (body.containsKey("usageNote")) {
            jdbcTemplate.update("UPDATE words SET usage_note = NULLIF(?, ''), updated_at = NOW() WHERE id = ?", usageNote, wordId);
        }
        // imageUrl — có thể set về null để xóa ảnh
        if (body.containsKey("imageUrl")) {
            String imageUrl = str(body.get("imageUrl"));
            jdbcTemplate.update("UPDATE words SET image_url = NULLIF(?, ''), updated_at = NOW() WHERE id = ?", imageUrl, wordId);
        }

        // Update translations
        upsertTranslation(wordId, "vi", str(body.get("meaningVi")), str(body.get("exampleVi")));
        upsertTranslation(wordId, "en", str(body.get("meaningEn")), str(body.get("exampleEn")));
        upsertTranslation(wordId, "de", null, str(body.get("exampleDe")));

        // Update nouns (gender, plural)
        String gender = str(body.get("gender"));
        String plural  = str(body.get("pluralForm"));
        if ("Noun".equals(dtype.isBlank() ? jdbcTemplate.queryForObject("SELECT dtype FROM words WHERE id=?", String.class, wordId) : dtype)) {
            if (!gender.isBlank()) {
                jdbcTemplate.update("""
                    INSERT INTO nouns (id, gender, plural_form, noun_type)
                    VALUES (?, ?, NULLIF(?, ''), 'STARK')
                    ON CONFLICT (id) DO UPDATE SET
                      gender = EXCLUDED.gender,
                      plural_form = CASE WHEN ? != '' THEN ? ELSE nouns.plural_form END
                    """, wordId, gender, plural, plural, plural);
            }
        }

        return Map.of("wordId", wordId, "status", "OK");
    }

    private void upsertTranslation(long wordId, String locale, String meaning, String example) {
        if ((meaning == null || meaning.isBlank()) && (example == null || example.isBlank())) return;
        jdbcTemplate.update("""
            INSERT INTO word_translations (word_id, locale, meaning, example)
            VALUES (?, ?, COALESCE(NULLIF(?, ''), ''), NULLIF(?, ''))
            ON CONFLICT (word_id, locale) DO UPDATE SET
              meaning = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE word_translations.meaning END,
              example = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE word_translations.example END
            """,
            wordId, locale, meaning, example,
            meaning, meaning, meaning,
            example, example, example
        );
    }

    private static String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }

    public Map<String, Object> debugTranslations(long wordId) {
        List<Map<String, Object>> rows = jdbcTemplate.query(
                """
                SELECT locale, meaning, example
                FROM word_translations
                WHERE word_id = ?
                ORDER BY locale ASC
                """,
                new Object[]{wordId},
                (rs, rowNum) -> Map.of(
                        "locale", rs.getString("locale"),
                        "meaning", rs.getString("meaning"),
                        "example", rs.getString("example")
                )
        );
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("wordId", wordId);
        out.put("rows", rows);
        return out;
    }

    /**
     * Deletes words whose {@code base_form} looks like concatenated multi-token text (e.g. "ausseinDieSchule..."),
     * typically caused by whitespace-stripping during import.
     */
    @Transactional
    public Map<String, Object> deleteConcatenatedLemmas(Integer limit, boolean dryRun) {
        int cap = (limit == null || limit < 1) ? 500 : Math.min(limit, 10_000);

        // Internal uppercase after lowercase strongly suggests concatenation, and we only target rows with no spaces.
        List<Long> ids = jdbcTemplate.query(
                """
                SELECT id
                FROM words
                WHERE base_form ~ '[[:lower:]][[:upper:]]'
                  AND base_form NOT LIKE '% %'
                  AND CHAR_LENGTH(base_form) >= 20
                ORDER BY id ASC
                LIMIT ?
                """,
                new Object[]{cap},
                (rs, rowNum) -> rs.getLong("id")
        );

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("matched", ids.size());
        out.put("limit", cap);
        out.put("dryRun", dryRun);

        if (ids.isEmpty()) {
            out.put("deleted", 0);
            return out;
        }

        List<Map<String, Object>> sample = jdbcTemplate.query(
                """
                SELECT id, base_form, cefr_level, dtype
                FROM words
                WHERE id IN (%s)
                ORDER BY id ASC
                LIMIT 20
                """.formatted(ids.stream().map(x -> "?").reduce((a, b) -> a + "," + b).orElse("?")),
                ids.toArray(),
                (rs, rowNum) -> Map.of(
                        "id", rs.getLong("id"),
                        "baseForm", rs.getString("base_form"),
                        "cefrLevel", rs.getString("cefr_level"),
                        "dtype", rs.getString("dtype")
                )
        );
        out.put("sample", sample);

        if (dryRun) {
            out.put("deleted", 0);
            return out;
        }

        out.put("deleted", deleteWordsWithChildren(ids));
        return out;
    }

    // ── Làm sạch meaning_en bị nhồi trích dẫn Wiktionary ────────────────────────
    // Bộ enrich cào nguyên khối từ Wiktionary nên nghĩa tiếng Anh bị nối thêm câu ví dụ,
    // trích dẫn nguồn (Einstein 1905, Der Spiegel…), danh sách đồng nghĩa, hoặc cả bảng
    // biến cách. Đo trên mẫu 2.314 bản ghi prod: 78 dòng (3,4%) dính, 749 nghĩa sạch.

    /** "inflection of alt: <bảng biến cách khổng lồ>" — giữ phần trước dấu hai chấm. */
    private static final Pattern INFLECTION_DUMP =
            Pattern.compile("^\\s*inflection of\\s+[^:]{1,60}:", Pattern.CASE_INSENSITIVE);
    /** Mốc bắt đầu trích dẫn: năm 4 chữ số, có thể kèm "c." (circa). */
    private static final Pattern CITATION_YEAR = Pattern.compile("\\s(?:c\\.\\s*)?(?:1[0-9]{3}|20[0-9]{2})\\b");
    private static final Pattern SYNONYM_LIST = Pattern.compile("\\sSynonyms?:");
    private static final int MEANING_SUSPECT_LENGTH = 150;

    /**
     * Cắt phần nhồi khỏi một {@code meaning_en}; trả về CHÍNH chuỗi cũ khi không có gì để cắt.
     *
     * <p>Chỉ đụng vào chuỗi CÓ dấu hiệu ô nhiễm (năm trích dẫn / "Synonyms:" / dài bất thường) —
     * nghĩa sạch không bao giờ bị rờ tới. Không bao giờ trả về rỗng: thà giữ nguyên bản bẩn còn
     * hơn xoá mất nghĩa thật.
     *
     * <p>Nghĩa thật luôn nằm ở ĐẦU chuỗi, phần nhồi bắt đầu ở từ viết hoa hoặc chữ số đầu tiên nằm
     * NGOÀI ngoặc — nhờ vậy phần giải nghĩa trong ngoặc được giữ trọn:
     * {@code "village (rural habitation of size between a hamlet and a town) 1903, Fanny zu…"}
     * → {@code "village (rural habitation of size between a hamlet and a town)"}.
     */
    static String cleanStuffedMeaning(String raw) {
        if (raw == null) {
            return null;
        }
        String s = raw.trim();
        if (s.isEmpty()) {
            return raw;
        }
        Matcher dump = INFLECTION_DUMP.matcher(s);
        if (dump.find()) {
            String head = s.substring(0, s.indexOf(':')).trim();
            return head.isEmpty() ? raw : head;
        }
        boolean suspect = CITATION_YEAR.matcher(s).find()
                || SYNONYM_LIST.matcher(s).find()
                || s.length() > MEANING_SUSPECT_LENGTH;
        if (!suspect) {
            return raw;
        }
        // Nghĩa tiếng Anh luôn mở đầu bằng chữ THƯỜNG ("lake", "court (of justice)"). Mở đầu bằng
        // chữ hoa nghĩa là không có phần nghĩa nào ở đầu để giữ — cắt kiểu gì cũng ra rác
        // ("Dieser See ist sehr klein…" → "Dieser"). Không đụng tới, để người xử lý.
        if (Character.isUpperCase(s.codePointAt(0))) {
            return raw;
        }
        String cut = s;
        Matcher year = CITATION_YEAR.matcher(cut);
        if (year.find()) {
            cut = cut.substring(0, year.start());
        }
        Matcher syn = SYNONYM_LIST.matcher(cut);
        if (syn.find()) {
            cut = cut.substring(0, syn.start());
        }
        cut = cutAtFirstCapitalOutsideParens(cut).trim().replaceAll("[\\s,;:.]+$", "");
        // Rỗng hoặc mất hết chữ cái ⇒ quy tắc không áp được, giữ nguyên bản gốc.
        return (cut.isEmpty() || !cut.codePoints().anyMatch(Character::isLetter)) ? raw : cut;
    }

    /** Cắt ở từ viết hoa/chữ số đầu tiên nằm ngoài ngoặc — chỗ câu ví dụ bắt đầu. */
    private static String cutAtFirstCapitalOutsideParens(String s) {
        int depth = 0;
        boolean atWordStart = false;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '(') {
                depth++;
            } else if (c == ')') {
                depth = Math.max(0, depth - 1);
            }
            if (Character.isWhitespace(c)) {
                atWordStart = true;
                continue;
            }
            if (atWordStart && depth == 0 && i > 0
                    && (Character.isUpperCase(c) || Character.isDigit(c))) {
                return s.substring(0, i);
            }
            atWordStart = false;
        }
        return s;
    }

    /**
     * Cắt phần nhồi khỏi {@code word_translations.meaning} (locale {@code en}).
     * Dry-run mặc định — trả về danh sách trước/sau để soi trước khi ghi. KHÔNG xoá bản dịch nào.
     */
    @Transactional
    public Map<String, Object> repairStuffedMeanings(Integer limit, boolean dryRun) {
        int cap = (limit == null || limit < 1) ? 200 : Math.min(limit, 5000);

        List<Map<String, Object>> candidates = jdbcTemplate.queryForList(
                """
                SELECT t.word_id, t.meaning, w.base_form
                FROM word_translations t
                JOIN words w ON w.id = t.word_id
                WHERE t.locale = 'en'
                  AND t.meaning IS NOT NULL
                  AND (
                        CHAR_LENGTH(t.meaning) > ?
                     OR t.meaning ~ '\\s(1[0-9]{3}|20[0-9]{2})([^0-9]|$)'
                     OR t.meaning LIKE '% Synonyms:%'
                     OR t.meaning LIKE '% Synonym:%'
                     OR t.meaning ILIKE 'inflection of %'
                  )
                ORDER BY t.word_id ASC
                LIMIT ?
                """,
                MEANING_SUSPECT_LENGTH, cap);

        List<Map<String, Object>> plan = new ArrayList<>();
        Map<Long, String> updates = new LinkedHashMap<>();
        for (Map<String, Object> row : candidates) {
            long wordId = ((Number) row.get("word_id")).longValue();
            String before = String.valueOf(row.get("meaning"));
            String after = cleanStuffedMeaning(before);
            if (after == null || after.equals(before)) {
                continue;
            }
            updates.put(wordId, after);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("wordId", wordId);
            item.put("baseForm", row.get("base_form"));
            item.put("beforeLength", before.length());
            item.put("before", before.length() > 160 ? before.substring(0, 160) + "…" : before);
            item.put("after", after);
            plan.add(item);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("scanned", candidates.size());
        out.put("limit", cap);
        out.put("dryRun", dryRun);
        out.put("plannedUpdate", updates.size());
        out.put("plan", plan);

        if (dryRun) {
            out.put("updated", 0);
            return out;
        }
        int updated = 0;
        for (Map.Entry<Long, String> e : updates.entrySet()) {
            updated += jdbcTemplate.update(
                    "UPDATE word_translations SET meaning = ? WHERE word_id = ? AND locale = 'en'",
                    e.getValue(), e.getKey());
        }
        out.put("updated", updated);
        return out;
    }

    /** Xoá từ kèm mọi bảng con (không giả định FK cascade). Trả về số dòng {@code words} đã xoá. */
    private int deleteWordsWithChildren(List<Long> ids) {
        if (ids.isEmpty()) {
            return 0;
        }
        String in = ids.stream().map(x -> "?").reduce((a, b) -> a + "," + b).orElse("?");
        Object[] args = ids.toArray();
        jdbcTemplate.update("DELETE FROM noun_declension_forms WHERE noun_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM verb_conjugations WHERE verb_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM nouns WHERE id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM verbs WHERE id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM adjectives WHERE id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM word_tags WHERE word_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM word_translations WHERE word_id IN (" + in + ")", args);
        return jdbcTemplate.update("DELETE FROM words WHERE id IN (" + in + ")", args);
    }

    /**
     * Sửa lemma dính ký tự điều khiển — di chứng của bộ trích PDF Goethe CŨ, đã vá ở #356.
     *
     * <p>Bộ trích cũ đặt TAB sai ranh giới cột nên {@code base_form} nuốt luôn từ đầu của câu ví dụ:
     * {@code "Salz<TAB>Entschuldigung"}, {@code "See<TAB>Komm"}, {@code "schließen<TAB>Bitte"}.
     * Đo trên mẫu 2.314 bản ghi prod: 5 dòng (0,22%), nằm gọn trong một khối id liền kề.
     *
     * <p><b>Vì sao KHÔNG cắt cụt tất cả:</b> 4/5 ca có lemma chuẩn ĐÃ tồn tại ở dòng khác
     * ({@code "Entschuldigung"}, {@code "See"}, {@code "einsteigen"}, {@code "schließen"}), mà kho
     * hiện <b>không có lemma trùng nào</b> — cắt cụt sẽ tạo ra bản trùng đầu tiên. Nên quyết định
     * theo từng dòng, đọc dữ liệu thật lúc chạy:
     * <ul>
     *   <li>đã có dòng khác mang đúng lemma đó → dòng hỏng là <b>thừa</b> ⇒ xoá cả cây con;</li>
     *   <li>chưa có → <b>sửa</b> {@code base_form} về phần trước ký tự điều khiển.</li>
     * </ul>
     *
     * <p>Lưu ý: 1.939 lemma chứa DẤU CÁCH ({@code "das Auto"}, {@code "an sein"}) là HỢP LỆ và
     * không bao giờ bị đụng tới — bộ lọc chỉ bắt TAB/CR/LF.
     */
    @Transactional
    public Map<String, Object> repairControlCharLemmas(Integer limit, boolean dryRun) {
        int cap = (limit == null || limit < 1) ? 200 : Math.min(limit, 2000);

        List<Map<String, Object>> broken = jdbcTemplate.queryForList(
                """
                SELECT id, base_form, cefr_level, dtype
                FROM words
                WHERE base_form LIKE '%' || CHR(9)  || '%'
                   OR base_form LIKE '%' || CHR(10) || '%'
                   OR base_form LIKE '%' || CHR(13) || '%'
                ORDER BY id ASC
                LIMIT ?
                """,
                cap);

        List<Map<String, Object>> plan = new ArrayList<>();
        List<Long> toDelete = new ArrayList<>();
        Map<Long, String> toRepair = new LinkedHashMap<>();

        for (Map<String, Object> row : broken) {
            long id = ((Number) row.get("id")).longValue();
            String raw = String.valueOf(row.get("base_form"));
            String trimmed = raw.split("[\t\r\n]", 2)[0].trim();

            String action;
            if (trimmed.isEmpty()) {
                // Toàn ký tự điều khiển — không còn gì để giữ.
                action = "delete_empty";
                toDelete.add(id);
            } else {
                Integer canonical = jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM words WHERE id <> ? AND LOWER(TRIM(base_form)) = LOWER(?)",
                        Integer.class, id, trimmed);
                if (canonical != null && canonical > 0) {
                    action = "delete_redundant";
                    toDelete.add(id);
                } else {
                    action = "repair";
                    toRepair.put(id, trimmed);
                }
            }

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", id);
            item.put("baseForm", raw);
            item.put("trimmed", trimmed);
            item.put("cefrLevel", row.get("cefr_level"));
            item.put("dtype", row.get("dtype"));
            item.put("action", action);
            plan.add(item);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("matched", broken.size());
        out.put("limit", cap);
        out.put("dryRun", dryRun);
        out.put("plannedRepair", toRepair.size());
        out.put("plannedDelete", toDelete.size());
        out.put("plan", plan);

        if (dryRun) {
            out.put("repaired", 0);
            out.put("deleted", 0);
            return out;
        }

        int repaired = 0;
        for (Map.Entry<Long, String> e : toRepair.entrySet()) {
            repaired += jdbcTemplate.update(
                    "UPDATE words SET base_form = ?, updated_at = NOW() WHERE id = ?", e.getValue(), e.getKey());
        }
        out.put("repaired", repaired);
        out.put("deleted", deleteWordsWithChildren(toDelete));
        return out;
    }
}

