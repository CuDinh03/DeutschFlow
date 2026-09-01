package com.deutschflow.vocabulary.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.vocabulary.dto.WordCoverageHistoryResponse;
import com.deutschflow.vocabulary.dto.WordCoverageResponse;
import com.deutschflow.vocabulary.dto.WordAdjectiveDetails;
import com.deutschflow.vocabulary.dto.WordFacetsResponse;
import com.deutschflow.vocabulary.dto.WordListItem;
import com.deutschflow.vocabulary.dto.WordLevelCountsResponse;
import com.deutschflow.vocabulary.dto.WordListResponse;
import com.deutschflow.vocabulary.dto.WordNounDeclensionItem;
import com.deutschflow.vocabulary.dto.WordNounDetails;
import com.deutschflow.vocabulary.dto.WordTranslationCoverageHistoryResponse;
import com.deutschflow.vocabulary.dto.WordTopicFacet;
import com.deutschflow.vocabulary.dto.WordTranslationCoverageResponse;
import com.deutschflow.vocabulary.dto.WordVerbConjugationItem;
import com.deutschflow.vocabulary.dto.WordVerbDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class WordQueryService {

    private final JdbcTemplate jdbcTemplate;
    private final GenderColorService genderColorService;

    private static final Set<String> ALLOWED_DTYPES = Set.of("Noun", "Verb", "Adjective", "Word");
    private static final Set<String> ALLOWED_GENDERS = Set.of("DER", "DIE", "DAS");
    private static final List<String> ALLOWED_CEFR_ORDER = List.of("A1", "A2", "B1", "B2", "C1", "C2");
    private static final Set<String> ALLOWED_CEFR = Set.of("A1", "A2", "B1", "B2", "C1", "C2");
    /** Từ chưa có trong wordlist chính thức ⇒ {@code cefr_level IS NULL} (xem CefrLevelResolver). */
    private static final String UNGRADED = "UNGRADED";
    private static final Set<String> ALLOWED_SRS_STATUS = Set.of("NEW", "LEARNING", "MASTERED");
    /** Canonical "mastered" boundary — interval >= 21d (matches VocabReviewRepository.countMastered). */
    private static final int MASTERED_INTERVAL_DAYS = 21;
    /** Lowercase lemma only between slashes — not real IPA (from old backfill). */
    private static final Pattern PSEUDO_IPA_LEMMA = Pattern.compile("^/[a-zA-ZäöüÄÖÜß\\s\\-]+/$");

    /** Join lịch SRS của người dùng — {@code ?} đầu tiên của MỌI câu truy vấn từ vựng là userId. */
    private static final String SRS_JOIN =
            " LEFT JOIN vocab_review_schedule srs ON srs.vocab_id = ('word_' || w.id) AND srs.user_id = ? ";
    /** Biểu thức suy trạng thái SRS — dùng chung cho cột trả về và cho bộ đếm facet. */
    private static final String SRS_STATUS_EXPR =
            "CASE WHEN srs.vocab_id IS NULL THEN 'NEW'"
                    + " WHEN srs.interval_days >= " + MASTERED_INTERVAL_DAYS + " THEN 'MASTERED'"
                    + " ELSE 'LEARNING' END";
    /**
     * Nhóm từ loại chuẩn hoá.
     *
     * <p>Cột {@code words.dtype} trộn hai cách viết ('Noun' của trình import và 'NOUN' của migration seed)
     * và còn nhiều nhãn cũ ngoài danh mục (PRONOUN, NUMBER, PHRASE, INTERJECTION). So sánh thẳng
     * {@code dtype = 'Noun'} chỉ bắt được một phần danh từ và bỏ rơi hẳn các nhãn cũ — đo trên bản migration
     * sạch: 63/154 danh từ, 22 từ không thuộc chip nào. Quy tất cả về bốn nhóm, nhãn lạ vào 'Word'.
     */
    private static final String DTYPE_GROUP_EXPR =
            "CASE UPPER(w.dtype)"
                    + " WHEN 'NOUN' THEN 'Noun'"
                    + " WHEN 'VERB' THEN 'Verb'"
                    + " WHEN 'ADJECTIVE' THEN 'Adjective'"
                    + " ELSE 'Word' END";
    /**
     * Biểu thức ĐẾM của trục từ loại — phải khớp từng chữ với thứ mà bộ lọc trả về.
     *
     * <p>Bộ lọc {@code dtype=Noun} kèm thêm ràng buộc "phải có mạo từ" ({@code n.gender IN …}), nên bộ đếm
     * cũng phải kèm. Thiếu vế đó thì chip nói dối: 02/09/2026 chip "Danh từ" ghi 151 mà bấm vào chỉ ra 60 từ.
     * Danh từ chưa có mạo từ vì thế không thuộc chip nào ({@code NULL}) — chúng vẫn tra được qua ô tìm và các
     * trục khác, và sẽ về đúng chip khi đợt 4 chuyển ràng buộc mạo từ sang endpoint bốc từ cho bài luyện.
     */
    private static final String DTYPE_FACET_EXPR =
            "CASE"
                    + " WHEN UPPER(w.dtype) = 'NOUN' AND n.gender IN ('DER','DIE','DAS') THEN 'Noun'"
                    + " WHEN UPPER(w.dtype) = 'NOUN' THEN NULL"
                    + " WHEN UPPER(w.dtype) = 'VERB' THEN 'Verb'"
                    + " WHEN UPPER(w.dtype) = 'ADJECTIVE' THEN 'Adjective'"
                    + " ELSE 'Word' END";
    /** Thứ tự hiển thị chip — Set kiểm tra hợp lệ ở trên không có thứ tự. */
    private static final List<String> DTYPE_FACET_ORDER = List.of("Noun", "Verb", "Adjective", "Word");
    private static final List<String> GENDER_FACET_ORDER = List.of("DER", "DIE", "DAS");
    private static final List<String> SRS_STATUS_FACET_ORDER = List.of("NEW", "LEARNING", "MASTERED");

    /** Bộ lọc đã chuẩn hoá của một truy vấn từ vựng — dùng chung cho danh sách và bộ đếm facet. */
    private record WordFilters(
            String cefr, boolean cefrExact, String query, String focus,
            String tag, String dtype, String gender, String status, String locale) {}

    /** Mệnh đề WHERE kèm tham số đúng thứ tự dấu {@code ?} bên trong nó. */
    private record FilterSql(String where, List<Object> params) {}

    /**
     * Trục facet đang được đếm.
     *
     * <p>Đếm cho trục nào thì BỎ chính bộ lọc của trục đó ra khỏi WHERE — con số trên mỗi chip phải trả
     * lời "chọn chip này thì còn bao nhiêu từ". Nếu giữ nguyên, mọi chip không được chọn sẽ về 0 và
     * người học kẹt lại ở lựa chọn hiện tại.
     */
    private enum FacetAxis { NONE, CEFR, DTYPE, GENDER, STATUS, TAG }

    public WordListResponse listWords(Long userId,
                                     String cefr,
                                     boolean cefrExact,
                                     String q,
                                     String topic,
                                     String focus,
                                     String tag,
                                     String dtype,
                                     String gender,
                                     String status,
                                     String locale,
                                     int page,
                                     int size) {
        WordFilters filters = normalizeFilters(cefr, cefrExact, q, topic, focus, tag, dtype, gender, status, locale);
        String normalizedLocale = filters.locale();
        String query = filters.query();

        if (page < 0) page = 0;
        if (size < 1) size = 20;
        if (size > 100) size = 100;

        // A dictionary word is "in the user's SRS" iff a schedule row exists with vocab_id
        // 'word_{id}' (see VocabularyService.markWordLearned) — an exact key, no text matching.
        // -1 (no such user) makes every word resolve to NEW for an unexpected null principal.
        long uid = userId != null ? userId : -1L;

        FilterSql filter = buildFilter(filters, FacetAxis.NONE);
        String where = filter.where();
        List<Object> filterParams = filter.params();

        // Both the count and the page query carry the srs join so the status filter resolves
        // and pagination/total stay consistent. The join's userId '?' is the FIRST bound param.
        long total = jdbcTemplate.queryForObject(
                "SELECT COUNT(DISTINCT w.id) FROM words w LEFT JOIN nouns n ON n.id = w.id" + SRS_JOIN + where,
                prependUserId(uid, filterParams),
                Long.class
        );

        int offset = page * size;
        List<Object> queryParams = new ArrayList<>();
        queryParams.add(uid);              // srs join (first '?', placed before t_loc below)
        queryParams.add(normalizedLocale); // t_loc locale
        queryParams.addAll(filterParams);

        // Có từ khoá thì xếp theo CHẤT LƯỢNG KHỚP trước, rồi mới tới cấp độ và alphabet: khớp tuyệt đối →
        // khớp đầu từ → khớp giữa từ (từ ghép tiếng Đức sống nhờ bậc này) → chỉ khớp ở phần nghĩa.
        // Tham số của ORDER BY nằm SAU filterParams vì ORDER BY đứng sau WHERE trong câu SQL.
        String matchRankOrder = "";
        if (query != null) {
            matchRankOrder = """
                      CASE
                        WHEN LOWER(w.base_form) = ? THEN 0
                        WHEN LOWER(w.base_form) LIKE ? THEN 1
                        WHEN LOWER(w.base_form) LIKE ? THEN 2
                        ELSE 3
                      END,
                    """;
            queryParams.add(query.toLowerCase(Locale.ROOT));
            queryParams.add(likePrefix(query));
            queryParams.add(likeContains(query));
        }

        String sql = """
                SELECT
                  w.id,
                  w.dtype,
                  w.base_form,
                  w.cefr_level,
                  w.phonetic,
                  w.usage_note,
                  w.image_url,
                  COALESCE(t_loc.meaning, t_en.meaning, t_de.meaning) AS meaning,
                  t_en.meaning AS meaning_en,
                  COALESCE(t_loc.example, t_en.example) AS example,
                  t_de.example AS example_de,
                  t_en.example AS example_en,
                  n.gender,
                  STRING_AGG(DISTINCT tg_all.name, '|' ORDER BY tg_all.name) AS tags,
                  CASE
                    WHEN srs.vocab_id IS NULL THEN 'NEW'
                    WHEN srs.interval_days >= 21 THEN 'MASTERED'
                    ELSE 'LEARNING'
                  END AS srs_status
                FROM words w
                LEFT JOIN vocab_review_schedule srs
                  ON srs.vocab_id = ('word_' || w.id) AND srs.user_id = ?
                LEFT JOIN word_translations t_loc
                  ON t_loc.word_id = w.id AND t_loc.locale = ?
                LEFT JOIN word_translations t_de
                  ON t_de.word_id = w.id AND t_de.locale = 'de'
                LEFT JOIN word_translations t_en
                  ON t_en.word_id = w.id AND t_en.locale = 'en'
                LEFT JOIN nouns n
                  ON n.id = w.id
                LEFT JOIN word_tags wt_all
                  ON wt_all.word_id = w.id
                LEFT JOIN tags tg_all
                  ON tg_all.id = wt_all.tag_id
                """ + where + """
                GROUP BY
                  w.id, w.dtype, w.base_form, w.cefr_level, w.phonetic, w.usage_note, w.image_url,
                  t_loc.meaning, t_en.meaning, t_de.meaning,
                  t_loc.example, t_en.example, t_de.example, n.gender,
                  srs.vocab_id, srs.interval_days
                ORDER BY
                """ + matchRankOrder + """
                  CASE w.cefr_level
                    WHEN 'A1' THEN 1 WHEN 'A2' THEN 2 WHEN 'B1' THEN 3 WHEN 'B2' THEN 4 WHEN 'C1' THEN 5 WHEN 'C2' THEN 6
                    ELSE 99 END,
                  w.base_form
                LIMIT ? OFFSET ?
                """;
        queryParams.add(size);
        queryParams.add(offset);

        List<WordListItem> items = jdbcTemplate.query(sql, queryParams.toArray(), (rs, rowNum) -> {
            long id = rs.getLong("id");
            String rsDtype = rs.getString("dtype");
            String baseForm = rs.getString("base_form");
            String cefrLevel = rs.getString("cefr_level");
            String phonetic = rs.getString("phonetic");
            String usageNote = rs.getString("usage_note");
            String imageUrl = rs.getString("image_url");
            String meaning = rs.getString("meaning");
            String meaningEn = rs.getString("meaning_en");
            String example = rs.getString("example");
            String exampleDe = rs.getString("example_de");
            String exampleEn = rs.getString("example_en");
            String nounGender = rs.getString("gender");
            String tagsRaw = rs.getString("tags");
            String srsStatus = rs.getString("srs_status");

            String article = null;
            String genderColor = null;
            if (nounGender != null) {
                article = switch (nounGender) {
                    case "DER" -> "der";
                    case "DIE" -> "die";
                    case "DAS" -> "das";
                    default -> null;
                };
                genderColor = genderColorService.colorForNounGender(nounGender);
            }

            WordNounDetails nounDetails = loadNounDetails(id);
            WordVerbDetails verbDetails = loadVerbDetails(id);
            WordAdjectiveDetails adjectiveDetails = loadAdjectiveDetails(id);
            String normalizedPhonetic = normalizePhonetic(phonetic, baseForm);
            String normalizedUsageNote = normalizeUsageNote(usageNote, rsDtype, baseForm, article);
            String cleanedMeaning = sanitizeMeaning(meaning, baseForm);
            String cleanedMeaningEn = sanitizeMeaning(meaningEn, baseForm);
            String cleanedExample = sanitizeExampleText(example);
            String cleanedExampleDe = sanitizeExampleText(exampleDe);
            String cleanedExampleEn = sanitizeExampleText(exampleEn);
            if (cleanedExampleEn != null && cleanedExampleDe != null && cleanedExampleEn.trim().equalsIgnoreCase(cleanedExampleDe.trim())) {
                cleanedExampleEn = null;
            }

            return new WordListItem(
                    id,
                    rsDtype,
                    baseForm,
                    cefrLevel,
                    normalizedPhonetic,
                    cleanedMeaning,
                    cleanedMeaningEn,
                    cleanedExample,
                    cleanedExampleDe,
                    cleanedExampleEn,
                    normalizedUsageNote,
                    nounGender,
                    article,
                    genderColor,
                    parseTags(tagsRaw),
                    nounDetails,
                    verbDetails,
                    adjectiveDetails,
                    imageUrl,
                    srsStatus
            );
        });

        return new WordListResponse(items, page, size, total);
    }

    /** Chuẩn hoá và kiểm tra hợp lệ tham số lọc. Ném {@link BadRequestException} y như trước. */
    private WordFilters normalizeFilters(String cefr, boolean cefrExact, String q, String topic, String focus,
                                         String tag, String dtype, String gender, String status, String locale) {
        String normalizedLocale = (locale == null || locale.isBlank()) ? "vi" : locale.trim().toLowerCase(Locale.ROOT);
        String normalizedCefr = (cefr == null || cefr.isBlank()) ? null : cefr.trim().toUpperCase(Locale.ROOT);
        String normalizedDtype = (dtype == null || dtype.isBlank()) ? null : dtype.trim();
        String query = (q == null || q.isBlank()) ? null : q.trim();
        if (query == null && topic != null && !topic.isBlank()) {
            query = topic.trim();
        }
        String normalizedTag = (tag == null || tag.isBlank()) ? null : tag.trim();
        String normalizedGender = (gender == null || gender.isBlank()) ? null : gender.trim().toUpperCase(Locale.ROOT);
        // Case-insensitive: the mobile chip sends lowercase (new/learning/mastered).
        String normalizedStatus = (status == null || status.isBlank()) ? null : status.trim().toUpperCase(Locale.ROOT);

        if (normalizedDtype != null && !ALLOWED_DTYPES.contains(normalizedDtype)) {
            throw new BadRequestException("Invalid dtype");
        }
        if (normalizedCefr != null && !ALLOWED_CEFR.contains(normalizedCefr) && !UNGRADED.equals(normalizedCefr)) {
            throw new BadRequestException("Invalid cefr");
        }
        if (normalizedGender != null && !ALLOWED_GENDERS.contains(normalizedGender)) {
            throw new BadRequestException("Invalid gender");
        }
        if (normalizedStatus != null && !ALLOWED_SRS_STATUS.contains(normalizedStatus)) {
            throw new BadRequestException("Invalid status");
        }
        return new WordFilters(normalizedCefr, cefrExact, query, focus,
                normalizedTag, normalizedDtype, normalizedGender, normalizedStatus, normalizedLocale);
    }

    /** Mệnh đề WHERE dùng chung; {@code omit} là trục đang đếm (xem {@link FacetAxis}). */
    private FilterSql buildFilter(WordFilters f, FacetAxis omit) {
        List<Object> params = new ArrayList<>();
        StringBuilder where = new StringBuilder(" WHERE 1=1 ");

        if (omit != FacetAxis.CEFR) {
            if (UNGRADED.equals(f.cefr())) {
                where.append(" AND w.cefr_level IS NULL ");
            } else if (f.cefr() != null && f.cefrExact()) {
                // Đúng một cấp — chip cấp độ ở /v2 dùng chế độ này, để nhãn chip khớp badge trên từng thẻ từ.
                where.append(" AND w.cefr_level = ? ");
                params.add(f.cefr());
            } else if (f.cefr() != null) {
                // Cumulative mode: A2 includes A1+A2, B1 includes A1+A2+B1, ...
                // Build IN (...) in Java (clean parameter binding for Postgres).
                List<String> cumulative = cumulativeCefrLevelsIncluding(f.cefr());
                where.append(" AND w.cefr_level IN (");
                where.append(String.join(",", Collections.nCopies(cumulative.size(), "?")));
                where.append(") ");
                params.addAll(cumulative);
            }
        }

        if (omit != FacetAxis.DTYPE && f.dtype() != null) {
            where.append(" AND ").append(DTYPE_GROUP_EXPR).append(" = ? ");
            params.add(f.dtype());
            if ("Noun".equals(f.dtype())) {
                where.append(" AND n.gender IN ('DER','DIE','DAS') ");
            }
        }

        // Ô tìm hứa "Tìm từ / nghĩa" nên phải chạm cả word_translations; LIKE của Postgres phân biệt
        // hoa/thường nên hai vế đều hạ chữ. Ký tự đại diện trong chuỗi người dùng gõ đã được thoát ở
        // likeContains() — một dấu '%' phải là một dấu phần trăm, không phải "trả về cả kho".
        if (f.query() != null) {
            where.append("""
                     AND (
                       LOWER(w.base_form) LIKE ?
                       OR EXISTS (
                         SELECT 1 FROM word_translations wt_q
                         WHERE wt_q.word_id = w.id
                           AND wt_q.locale IN (?, 'en')
                           AND LOWER(wt_q.meaning) LIKE ?
                       )
                     )
                    """);
            String contains = likeContains(f.query());
            params.add(contains);
            params.add(f.locale());
            params.add(contains);
        }

        String focusTail = focusCodeTail(f.focus());
        if (focusTail != null) {
            where.append("""
                    AND (
                      EXISTS (
                        SELECT 1 FROM word_tags wt_fc
                        JOIN tags tg_fc ON tg_fc.id = wt_fc.tag_id
                        WHERE wt_fc.word_id = w.id AND LOWER(tg_fc.name) LIKE ?
                      )
                      OR LOWER(w.base_form) LIKE ?
                    )
                    """);
            String pat = "%" + focusTail.toLowerCase(Locale.ROOT) + "%";
            params.add(pat);
            params.add(pat);
        }

        if (omit != FacetAxis.TAG && f.tag() != null) {
            where.append("""
                     AND EXISTS (
                       SELECT 1
                       FROM word_tags wt_filter
                       JOIN tags tg_filter ON tg_filter.id = wt_filter.tag_id
                       WHERE wt_filter.word_id = w.id AND tg_filter.name = ?
                     )
                    """);
            params.add(f.tag());
        }

        // Giống là facet CON của từ loại (chỉ danh từ mới có der/die/das): đếm trục từ loại thì phải bỏ
        // cả bộ lọc giống, nếu không "Động từ" luôn ra 0 khi người học đang đứng ở "Danh từ · der".
        if (omit != FacetAxis.GENDER && omit != FacetAxis.DTYPE && f.gender() != null) {
            where.append(" AND n.gender = ? ");
            params.add(f.gender());
        }

        // SRS status filter — resolves against the srs LEFT JOIN (no param, threshold is a constant).
        if (omit != FacetAxis.STATUS && f.status() != null) {
            switch (f.status()) {
                case "NEW" -> where.append(" AND srs.vocab_id IS NULL ");
                case "LEARNING" -> where.append(
                        " AND srs.vocab_id IS NOT NULL AND srs.interval_days < " + MASTERED_INTERVAL_DAYS + " ");
                case "MASTERED" -> where.append(
                        " AND srs.vocab_id IS NOT NULL AND srs.interval_days >= " + MASTERED_INTERVAL_DAYS + " ");
                default -> { /* unreachable — validated in normalizeFilters */ }
            }
        }

        return new FilterSql(where.toString(), params);
    }

    /**
     * Số từ theo TỪNG TRỤC lọc, mỗi trục đã tính giao với các bộ lọc khác đang bật.
     *
     * <p>Thay {@link #levelCounts()} ở hub /v2: trước đây UI chỉ có một trục — cấp độ CEFR — mà đó lại là
     * trục dữ liệu yếu nhất, trong khi trạng thái học, từ loại/mạo từ và chủ đề đều đã có sẵn tham số lọc.
     */
    public WordFacetsResponse facets(Long userId, String cefr, boolean cefrExact, String q, String topic,
                                     String focus, String tag, String dtype, String gender, String status,
                                     String locale) {
        WordFilters f = normalizeFilters(cefr, cefrExact, q, topic, focus, tag, dtype, gender, status, locale);
        long uid = userId != null ? userId : -1L;

        FilterSql all = buildFilter(f, FacetAxis.NONE);
        Long total = jdbcTemplate.queryForObject(
                "SELECT COUNT(DISTINCT w.id) FROM words w LEFT JOIN nouns n ON n.id = w.id" + SRS_JOIN + all.where(),
                prependUserId(uid, all.params()),
                Long.class);

        List<String> cefrKeys = new ArrayList<>(ALLOWED_CEFR_ORDER);
        cefrKeys.add(UNGRADED);

        return new WordFacetsResponse(
                total == null ? 0L : total,
                countByKey(uid, buildFilter(f, FacetAxis.STATUS), SRS_STATUS_EXPR, SRS_STATUS_FACET_ORDER),
                countByKey(uid, buildFilter(f, FacetAxis.DTYPE), DTYPE_FACET_EXPR, DTYPE_FACET_ORDER),
                countByKey(uid, buildFilter(f, FacetAxis.GENDER), "n.gender", GENDER_FACET_ORDER),
                countByKey(uid, buildFilter(f, FacetAxis.CEFR),
                        "COALESCE(w.cefr_level, '" + UNGRADED + "')", cefrKeys),
                countTopics(uid, buildFilter(f, FacetAxis.TAG), f.locale()));
    }

    /**
     * Đếm theo một biểu thức khoá. {@code keyExpr} và {@code knownKeys} chỉ đến từ hằng số trong lớp này —
     * không bao giờ từ tham số người dùng — nên nối chuỗi ở đây là an toàn.
     */
    private Map<String, Long> countByKey(long uid, FilterSql filter, String keyExpr, List<String> knownKeys) {
        Map<String, Long> out = new LinkedHashMap<>();
        for (String key : knownKeys) {
            out.put(key, 0L);
        }
        String sql = "SELECT " + keyExpr + " AS facet_key, COUNT(DISTINCT w.id) AS total"
                + " FROM words w LEFT JOIN nouns n ON n.id = w.id" + SRS_JOIN + filter.where()
                + " GROUP BY 1";
        jdbcTemplate.query(sql, prependUserId(uid, filter.params()), rs -> {
            String key = rs.getString("facet_key");
            // Khoá lạ (dtype ngoài danh mục, giống rác) không được tự sinh chip.
            if (key != null && out.containsKey(key)) {
                out.put(key, rs.getLong("total"));
            }
        });
        return out;
    }

    /** Chỉ trả chủ đề CÓ từ — chip rỗng là chip dẫn tới danh sách rỗng. */
    private List<WordTopicFacet> countTopics(long uid, FilterSql filter, String locale) {
        String sql = """
                SELECT tg.name AS name,
                       COALESCE(tt.label, tg.name) AS label,
                       COUNT(DISTINCT w.id) AS total
                FROM words w
                LEFT JOIN nouns n ON n.id = w.id
                """ + SRS_JOIN + """
                JOIN word_tags wt_facet ON wt_facet.word_id = w.id
                JOIN tags tg ON tg.id = wt_facet.tag_id AND tg.is_topic_taxonomy IS TRUE
                LEFT JOIN tag_translations tt ON tt.tag_id = tg.id AND tt.locale = ?
                """ + filter.where() + """
                GROUP BY tg.name, COALESCE(tt.label, tg.name)
                ORDER BY COUNT(DISTINCT w.id) DESC, 2
                """;
        List<Object> params = new ArrayList<>();
        params.add(uid);     // SRS_JOIN
        params.add(locale);  // tag_translations
        params.addAll(filter.params());
        return jdbcTemplate.query(sql, params.toArray(), (rs, rowNum) ->
                new WordTopicFacet(rs.getString("name"), rs.getString("label"), rs.getLong("total")));
    }

    /**
     * Số từ theo từng cấp (kể cả {@code UNGRADED} = chưa phân cấp) — UI dựng chip cấp độ từ đây thay vì
     * hardcode A1–C2, nên không còn chip rỗng như chip C2 trước 14/08/2026.
     */
    public WordLevelCountsResponse levelCounts() {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (String level : ALLOWED_CEFR_ORDER) {
            counts.put(level, 0L);
        }
        counts.put(UNGRADED, 0L);
        jdbcTemplate.query(
                "SELECT COALESCE(cefr_level, '" + UNGRADED + "') AS lvl, COUNT(*) AS total FROM words GROUP BY 1",
                rs -> {
                    counts.merge(rs.getString("lvl"), rs.getLong("total"), Long::sum);
                }
        );
        long total = counts.values().stream().mapToLong(Long::longValue).sum();
        return new WordLevelCountsResponse(counts, total);
    }

    /** Last segment of an error code (e.g. {@code VERB.CONJ} → {@code conj}) for loose tag/word match. */
    private static String focusCodeTail(String focus) {
        if (focus == null || focus.isBlank()) {
            return null;
        }
        String f = focus.trim();
        int dot = f.lastIndexOf('.');
        String tail = (dot >= 0 ? f.substring(dot + 1) : f).trim();
        if (tail.isBlank()) {
            return null;
        }
        return tail.length() > 48 ? tail.substring(0, 48) : tail;
    }

    /**
     * Chuỗi người dùng gõ, hạ chữ và THOÁT ký tự đại diện của LIKE.
     *
     * <p>Không thoát thì một dấu {@code %} khớp cả kho và {@code _} khớp mọi ký tự đơn — người học gõ
     * "50%" hay "ăn_uống" sẽ nhận về kết quả vô nghĩa. Postgres mặc định lấy {@code \\} làm ký tự thoát
     * của LIKE nên không cần mệnh đề {@code ESCAPE}.
     */
    private static String escapeLikeWildcards(String raw) {
        return raw.toLowerCase(Locale.ROOT)
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
    }

    /** Mẫu LIKE khớp GIỮA từ — từ ghép tiếng Đức (Kranken<b>haus</b>) phụ thuộc vào bậc này. */
    private static String likeContains(String raw) {
        return "%" + escapeLikeWildcards(raw) + "%";
    }

    /** Mẫu LIKE khớp ĐẦU từ — chỉ dùng để xếp hạng, không dùng để lọc. */
    private static String likePrefix(String raw) {
        return escapeLikeWildcards(raw) + "%";
    }

    /** Prepends the srs-join userId param ahead of the shared filter params (count query). */
    private static Object[] prependUserId(long userId, List<Object> filterParams) {
        List<Object> params = new ArrayList<>(filterParams.size() + 1);
        params.add(userId);
        params.addAll(filterParams);
        return params.toArray();
    }

    public WordCoverageResponse coverage() {
        WordCoverageResponse snapshot = computeCoverage(LocalDate.now());
        saveCoverageSnapshot(snapshot);
        return snapshot;
    }

    public WordCoverageHistoryResponse coverageHistory(int days) {
        if (days < 1 || days > 3650) {
            throw new BadRequestException("days must be between 1 and 3650");
        }
        // Ensure we always have today's data persisted for dashboard usage.
        coverage();

        LocalDate from = LocalDate.now().minusDays(days - 1L);
        List<WordCoverageResponse> items = jdbcTemplate.query("""
                SELECT
                  snapshot_date,
                  total_words,
                  noun_words,
                  noun_rows,
                  noun_with_gender,
                  noun_der,
                  noun_die,
                  noun_das,
                  noun_coverage_percent,
                  verb_words,
                  verb_rows,
                  verb_coverage_percent
                FROM word_coverage_daily
                WHERE snapshot_date >= ?
                ORDER BY snapshot_date ASC
                """, new Object[]{java.sql.Date.valueOf(from)}, (rs, rowNum) -> new WordCoverageResponse(
                rs.getDate("snapshot_date").toLocalDate(),
                rs.getLong("total_words"),
                rs.getLong("noun_words"),
                rs.getLong("noun_rows"),
                rs.getLong("noun_with_gender"),
                rs.getLong("noun_der"),
                rs.getLong("noun_die"),
                rs.getLong("noun_das"),
                rs.getDouble("noun_coverage_percent"),
                rs.getLong("verb_words"),
                rs.getLong("verb_rows"),
                rs.getDouble("verb_coverage_percent")
        ));
        return new WordCoverageHistoryResponse(days, items);
    }

    public WordTranslationCoverageResponse translationCoverage() {
        WordTranslationCoverageResponse snapshot = computeTranslationCoverage(LocalDate.now());
        saveTranslationCoverageSnapshot(snapshot);
        return snapshot;
    }

    public WordTranslationCoverageHistoryResponse translationCoverageHistory(int days) {
        if (days < 1 || days > 3650) {
            throw new BadRequestException("days must be between 1 and 3650");
        }
        translationCoverage();

        LocalDate from = LocalDate.now().minusDays(days - 1L);
        List<WordTranslationCoverageResponse> items = jdbcTemplate.query("""
                SELECT
                  snapshot_date,
                  total_words,
                  words_with_de,
                  words_with_vi,
                  words_with_en,
                  words_with_all_locales,
                  de_coverage_percent,
                  vi_coverage_percent,
                  en_coverage_percent,
                  all_locales_coverage_percent
                FROM word_translation_coverage_daily
                WHERE snapshot_date >= ?
                ORDER BY snapshot_date ASC
                """, new Object[]{java.sql.Date.valueOf(from)}, (rs, rowNum) -> new WordTranslationCoverageResponse(
                rs.getDate("snapshot_date").toLocalDate(),
                rs.getLong("total_words"),
                rs.getLong("words_with_de"),
                rs.getLong("words_with_vi"),
                rs.getLong("words_with_en"),
                rs.getLong("words_with_all_locales"),
                rs.getDouble("de_coverage_percent"),
                rs.getDouble("vi_coverage_percent"),
                rs.getDouble("en_coverage_percent"),
                rs.getDouble("all_locales_coverage_percent")
        ));
        return new WordTranslationCoverageHistoryResponse(days, items);
    }

    private WordCoverageResponse computeCoverage(LocalDate date) {
        Long totalWords = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM words", Long.class);
        Long nounWords = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM words WHERE dtype = 'Noun'", Long.class);
        Long nounRows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM nouns", Long.class);
        Long nounWithGender = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM nouns WHERE gender IN ('DER','DIE','DAS')", Long.class);
        Long nounDer = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM nouns WHERE gender = 'DER'", Long.class);
        Long nounDie = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM nouns WHERE gender = 'DIE'", Long.class);
        Long nounDas = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM nouns WHERE gender = 'DAS'", Long.class);

        Long verbWords = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM words WHERE dtype = 'Verb'", Long.class);
        Long verbRows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM verbs", Long.class);

        long totalWordsV = totalWords == null ? 0L : totalWords;
        long nounWordsV = nounWords == null ? 0L : nounWords;
        long nounRowsV = nounRows == null ? 0L : nounRows;
        long nounWithGenderV = nounWithGender == null ? 0L : nounWithGender;
        long nounDerV = nounDer == null ? 0L : nounDer;
        long nounDieV = nounDie == null ? 0L : nounDie;
        long nounDasV = nounDas == null ? 0L : nounDas;
        long verbWordsV = verbWords == null ? 0L : verbWords;
        long verbRowsV = verbRows == null ? 0L : verbRows;

        double nounCoveragePercent = nounWordsV == 0L ? 0.0 : round2((nounWithGenderV * 100.0) / nounWordsV);
        double verbCoveragePercent = verbWordsV == 0L ? 0.0 : round2((verbRowsV * 100.0) / verbWordsV);

        return new WordCoverageResponse(
                date,
                totalWordsV,
                nounWordsV,
                nounRowsV,
                nounWithGenderV,
                nounDerV,
                nounDieV,
                nounDasV,
                nounCoveragePercent,
                verbWordsV,
                verbRowsV,
                verbCoveragePercent
        );
    }

    private WordTranslationCoverageResponse computeTranslationCoverage(LocalDate date) {
        Long totalWords = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM words", Long.class);
        Long wordsWithDe = jdbcTemplate.queryForObject("""
                SELECT COUNT(DISTINCT w.id)
                FROM words w
                JOIN word_translations wt ON wt.word_id = w.id
                WHERE wt.locale = 'de' AND wt.meaning IS NOT NULL AND TRIM(wt.meaning) <> ''
                """, Long.class);
        Long wordsWithVi = jdbcTemplate.queryForObject("""
                SELECT COUNT(DISTINCT w.id)
                FROM words w
                JOIN word_translations wt ON wt.word_id = w.id
                WHERE wt.locale = 'vi' AND wt.meaning IS NOT NULL AND TRIM(wt.meaning) <> ''
                """, Long.class);
        Long wordsWithEn = jdbcTemplate.queryForObject("""
                SELECT COUNT(DISTINCT w.id)
                FROM words w
                JOIN word_translations wt ON wt.word_id = w.id
                WHERE wt.locale = 'en' AND wt.meaning IS NOT NULL AND TRIM(wt.meaning) <> ''
                """, Long.class);
        Long wordsWithAllLocales = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM (
                  SELECT w.id
                  FROM words w
                  JOIN word_translations wt ON wt.word_id = w.id
                  WHERE wt.locale IN ('de', 'vi', 'en')
                    AND wt.meaning IS NOT NULL
                    AND TRIM(wt.meaning) <> ''
                  GROUP BY w.id
                  HAVING COUNT(DISTINCT wt.locale) = 3
                ) x
                """, Long.class);

        long totalWordsV = totalWords == null ? 0L : totalWords;
        long wordsWithDeV = wordsWithDe == null ? 0L : wordsWithDe;
        long wordsWithViV = wordsWithVi == null ? 0L : wordsWithVi;
        long wordsWithEnV = wordsWithEn == null ? 0L : wordsWithEn;
        long wordsWithAllLocalesV = wordsWithAllLocales == null ? 0L : wordsWithAllLocales;

        double deCoveragePercent = totalWordsV == 0L ? 0.0 : round2((wordsWithDeV * 100.0) / totalWordsV);
        double viCoveragePercent = totalWordsV == 0L ? 0.0 : round2((wordsWithViV * 100.0) / totalWordsV);
        double enCoveragePercent = totalWordsV == 0L ? 0.0 : round2((wordsWithEnV * 100.0) / totalWordsV);
        double allLocalesCoveragePercent = totalWordsV == 0L ? 0.0 : round2((wordsWithAllLocalesV * 100.0) / totalWordsV);

        return new WordTranslationCoverageResponse(
                date,
                totalWordsV,
                wordsWithDeV,
                wordsWithViV,
                wordsWithEnV,
                wordsWithAllLocalesV,
                deCoveragePercent,
                viCoveragePercent,
                enCoveragePercent,
                allLocalesCoveragePercent
        );
    }

    private void saveCoverageSnapshot(WordCoverageResponse snapshot) {
        jdbcTemplate.update("""
                INSERT INTO word_coverage_daily (
                  snapshot_date,
                  total_words,
                  noun_words,
                  noun_rows,
                  noun_with_gender,
                  noun_der,
                  noun_die,
                  noun_das,
                  noun_coverage_percent,
                  verb_words,
                  verb_rows,
                  verb_coverage_percent
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (snapshot_date) DO UPDATE SET
                  total_words = EXCLUDED.total_words,
                  noun_words = EXCLUDED.noun_words,
                  noun_rows = EXCLUDED.noun_rows,
                  noun_with_gender = EXCLUDED.noun_with_gender,
                  noun_der = EXCLUDED.noun_der,
                  noun_die = EXCLUDED.noun_die,
                  noun_das = EXCLUDED.noun_das,
                  noun_coverage_percent = EXCLUDED.noun_coverage_percent,
                  verb_words = EXCLUDED.verb_words,
                  verb_rows = EXCLUDED.verb_rows,
                  verb_coverage_percent = EXCLUDED.verb_coverage_percent,
                  updated_at = CURRENT_TIMESTAMP
                """,
                java.sql.Date.valueOf(snapshot.date()),
                snapshot.totalWords(),
                snapshot.nounWords(),
                snapshot.nounRows(),
                snapshot.nounWithGender(),
                snapshot.nounDer(),
                snapshot.nounDie(),
                snapshot.nounDas(),
                snapshot.nounCoveragePercent(),
                snapshot.verbWords(),
                snapshot.verbRows(),
                snapshot.verbCoveragePercent()
        );
    }

    private void saveTranslationCoverageSnapshot(WordTranslationCoverageResponse snapshot) {
        jdbcTemplate.update("""
                INSERT INTO word_translation_coverage_daily (
                  snapshot_date,
                  total_words,
                  words_with_de,
                  words_with_vi,
                  words_with_en,
                  words_with_all_locales,
                  de_coverage_percent,
                  vi_coverage_percent,
                  en_coverage_percent,
                  all_locales_coverage_percent
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (snapshot_date) DO UPDATE SET
                  total_words = EXCLUDED.total_words,
                  words_with_de = EXCLUDED.words_with_de,
                  words_with_vi = EXCLUDED.words_with_vi,
                  words_with_en = EXCLUDED.words_with_en,
                  words_with_all_locales = EXCLUDED.words_with_all_locales,
                  de_coverage_percent = EXCLUDED.de_coverage_percent,
                  vi_coverage_percent = EXCLUDED.vi_coverage_percent,
                  en_coverage_percent = EXCLUDED.en_coverage_percent,
                  all_locales_coverage_percent = EXCLUDED.all_locales_coverage_percent,
                  updated_at = CURRENT_TIMESTAMP
                """,
                java.sql.Date.valueOf(snapshot.date()),
                snapshot.totalWords(),
                snapshot.wordsWithDe(),
                snapshot.wordsWithVi(),
                snapshot.wordsWithEn(),
                snapshot.wordsWithAllLocales(),
                snapshot.deCoveragePercent(),
                snapshot.viCoveragePercent(),
                snapshot.enCoveragePercent(),
                snapshot.allLocalesCoveragePercent()
        );
    }

    private List<String> parseTags(String tagsRaw) {
        if (tagsRaw == null || tagsRaw.isBlank()) {
            return Collections.emptyList();
        }
        return Arrays.stream(tagsRaw.split("\\|"))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList();
    }

    private WordNounDetails loadNounDetails(long wordId) {
        List<WordNounDetails> nounRows = jdbcTemplate.query("""
                SELECT plural_form, genitive_form, noun_type
                FROM nouns
                WHERE id = ?
                """, new Object[]{wordId}, (rs, rowNum) -> new WordNounDetails(
                rs.getString("plural_form"),
                rs.getString("genitive_form"),
                rs.getString("noun_type"),
                Collections.emptyList()
        ));
        if (nounRows.isEmpty()) {
            return null;
        }

        List<WordNounDeclensionItem> declensions = jdbcTemplate.query("""
                SELECT kasus, numerus, form
                FROM noun_declension_forms
                WHERE noun_id = ?
                ORDER BY CASE kasus
                           WHEN 'NOMINATIV' THEN 1 WHEN 'AKKUSATIV' THEN 2 WHEN 'DATIV' THEN 3 WHEN 'GENITIV' THEN 4
                           ELSE 99 END,
                         CASE numerus WHEN 'SINGULAR' THEN 1 WHEN 'PLURAL' THEN 2 ELSE 99 END
                """, new Object[]{wordId}, (rs, rowNum) -> new WordNounDeclensionItem(
                rs.getString("kasus"),
                rs.getString("numerus"),
                rs.getString("form")
        ));

        WordNounDetails head = nounRows.get(0);
        return new WordNounDetails(head.pluralForm(), head.genitiveForm(), head.nounType(), declensions);
    }

    private WordVerbDetails loadVerbDetails(long wordId) {
        List<WordVerbDetails> verbRows = jdbcTemplate.query("""
                SELECT auxiliary_verb, partizip2, is_separable, prefix, is_irregular
                FROM verbs
                WHERE id = ?
                """, new Object[]{wordId}, (rs, rowNum) -> new WordVerbDetails(
                rs.getString("auxiliary_verb"),
                rs.getString("partizip2"),
                rs.getBoolean("is_separable"),
                rs.getString("prefix"),
                rs.getBoolean("is_irregular"),
                Collections.emptyList()
        ));
        if (verbRows.isEmpty()) {
            return null;
        }

        List<WordVerbConjugationItem> conjugations = jdbcTemplate.query("""
                SELECT tense, pronoun, form
                FROM verb_conjugations
                WHERE verb_id = ?
                ORDER BY CASE tense
                           WHEN 'PRASENS' THEN 1 WHEN 'PRATERITUM' THEN 2 WHEN 'PERFEKT' THEN 3
                           WHEN 'FUTUR1' THEN 4 WHEN 'KONJUNKTIV2' THEN 5 WHEN 'IMPERATIV' THEN 6
                           ELSE 99 END,
                         CASE pronoun
                           WHEN 'ICH' THEN 1 WHEN 'DU' THEN 2 WHEN 'ER_SIE_ES' THEN 3
                           WHEN 'WIR' THEN 4 WHEN 'IHR' THEN 5 WHEN 'SIE_FORMAL' THEN 6
                           ELSE 99 END
                """, new Object[]{wordId}, (rs, rowNum) -> new WordVerbConjugationItem(
                rs.getString("tense"),
                rs.getString("pronoun"),
                rs.getString("form")
        ));

        WordVerbDetails head = verbRows.get(0);
        return new WordVerbDetails(
                head.auxiliaryVerb(),
                head.partizip2(),
                head.isSeparable(),
                head.prefix(),
                head.isIrregular(),
                conjugations
        );
    }

    private WordAdjectiveDetails loadAdjectiveDetails(long wordId) {
        List<WordAdjectiveDetails> rows = jdbcTemplate.query("""
                SELECT comparative, superlative, is_irregular
                FROM adjectives
                WHERE id = ?
                """, new Object[]{wordId}, (rs, rowNum) -> new WordAdjectiveDetails(
                rs.getString("comparative"),
                rs.getString("superlative"),
                rs.getBoolean("is_irregular")
        ));
        return rows.isEmpty() ? null : rows.get(0);
    }

    private String normalizePhonetic(String phonetic, String baseForm) {
        if (phonetic == null || phonetic.isBlank()) {
            return null;
        }
        String t = phonetic.trim();
        if (isPseudoIpa(t, baseForm)) {
            return null;
        }
        return t;
    }

    private boolean isPseudoIpa(String phonetic, String baseForm) {
        if (phonetic == null || baseForm == null) {
            return true;
        }
        if (PSEUDO_IPA_LEMMA.matcher(phonetic).matches()) {
            return true;
        }
        if (phonetic.startsWith("/") && phonetic.endsWith("/") && phonetic.length() >= 3) {
            String inner = phonetic.substring(1, phonetic.length() - 1).trim().toLowerCase(Locale.ROOT);
            return inner.equals(baseForm.trim().toLowerCase(Locale.ROOT));
        }
        return false;
    }

    private String sanitizeMeaning(String meaning, String baseForm) {
        if (meaning == null || meaning.isBlank()) {
            return null;
        }
        String m = meaning.trim();
        if (baseForm != null && m.equalsIgnoreCase(baseForm.trim())) {
            return null;
        }
        if (isPlaceholderMeaningOrExample(m)) {
            return null;
        }
        return m;
    }

    private String sanitizeExampleText(String example) {
        if (example == null || example.isBlank()) {
            return null;
        }
        String e = example.trim();
        if (isPlaceholderMeaningOrExample(e)) {
            return null;
        }
        return e;
    }

    private boolean isPlaceholderMeaningOrExample(String text) {
        if (text == null) {
            return true;
        }
        String x = text.toLowerCase(Locale.ROOT);
        return x.contains("goethe-derived vocabulary")
                || x.contains("tu vung goethe")
                || x.contains("not in wordlists/local_lexicon.tsv")
                || x.contains("chưa có trong wordlists/local_lexicon.tsv")
                || x.startsWith("beispiel: das wort")
                || x.equals("goethe-derived vocabulary");
    }

    private String normalizeUsageNote(String usageNote, String dtype, String baseForm, String article) {
        if (usageNote != null && !usageNote.isBlank()) {
            String u = usageNote.trim();
            if (looksLikeLegacyAsciiUsage(u)) {
                return defaultUsageNote(dtype, baseForm, article);
            }
            return u;
        }
        return defaultUsageNote(dtype, baseForm, article);
    }

    private boolean looksLikeLegacyAsciiUsage(String usageNote) {
        return usageNote.startsWith("Danh tu tieng")
                || usageNote.startsWith("Dong tu tieng")
                || usageNote.startsWith("Tinh tu tieng")
                || usageNote.startsWith("Hoc tu nay theo cum tu");
    }

    private String defaultUsageNote(String dtype, String baseForm, String article) {
        if ("Noun".equals(dtype)) {
            String articleText = article == null ? "mạo từ phù hợp" : article;
            return "Danh từ tiếng Đức. Luôn học kèm mạo từ (" + articleText + "), số nhiều và ngữ cảnh câu.";
        }
        if ("Verb".equals(dtype)) {
            return "Động từ tiếng Đức. Dùng theo ngôi (ich/du/er-sie-es/wir/ihr/sie) và chú ý trợ động từ khi chia Perfekt.";
        }
        if ("Adjective".equals(dtype)) {
            return "Tính từ tiếng Đức. Biến đổi đuôi theo mạo từ, giống, cách (Kasus) và số.";
        }
        String term = (baseForm == null || baseForm.isBlank()) ? "từ" : baseForm;
        return "Từ vựng " + term + " dùng theo ngữ cảnh giao tiếp; ưu tiên học cùng cụm từ và câu ví dụ.";
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    /** Cumulative CEFR: B1 ⇒ A1+A2+B1. {@code cap} must already satisfy {@link #ALLOWED_CEFR}. */
    private static List<String> cumulativeCefrLevelsIncluding(String cap) {
        String[] order = {"A1", "A2", "B1", "B2", "C1", "C2"};
        int end = Arrays.asList(order).indexOf(cap);
        if (end < 0) {
            throw new IllegalArgumentException("Invalid CEFR cap: " + cap);
        }
        return Arrays.asList(Arrays.copyOfRange(order, 0, end + 1));
    }
}

