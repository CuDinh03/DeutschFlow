package com.deutschflow.vocabulary.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.vocabulary.dto.WordListItem;
import com.deutschflow.vocabulary.dto.WordListResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class WordQueryService {

    private final JdbcTemplate jdbcTemplate;
    private final GenderColorService genderColorService;

    private static final Set<String> ALLOWED_DTYPES = Set.of("Noun", "Verb");
    private static final Set<String> ALLOWED_GENDERS = Set.of("DER", "DIE", "DAS");

    public WordListResponse listWords(String cefr,
                                     String q,
                                     String tag,
                                     String dtype,
                                     String gender,
                                     String locale,
                                     int page,
                                     int size) {
        String normalizedLocale = (locale == null || locale.isBlank()) ? "vi" : locale.trim().toLowerCase(Locale.ROOT);
        String normalizedCefr = (cefr == null || cefr.isBlank()) ? null : cefr.trim().toUpperCase(Locale.ROOT);
        String normalizedDtype = (dtype == null || dtype.isBlank()) ? null : dtype.trim();
        String query = (q == null || q.isBlank()) ? null : q.trim();
        String normalizedTag = (tag == null || tag.isBlank()) ? null : tag.trim();
        String normalizedGender = (gender == null || gender.isBlank()) ? null : gender.trim().toUpperCase(Locale.ROOT);

        if (normalizedDtype != null && !ALLOWED_DTYPES.contains(normalizedDtype)) {
            throw new BadRequestException("Invalid dtype");
        }
        if (normalizedGender != null && !ALLOWED_GENDERS.contains(normalizedGender)) {
            throw new BadRequestException("Invalid gender");
        }
        if (page < 0) page = 0;
        if (size < 1) size = 20;
        if (size > 100) size = 100;

        List<Object> params = new ArrayList<>();

        StringBuilder from = new StringBuilder();
        from.append("""
                SELECT
                  w.id,
                  w.dtype,
                  w.base_form,
                  w.cefr_level,
                  t.meaning,
                  t.example,
                  n.gender,
                  n.plural_form
                FROM words w
                LEFT JOIN word_translations t
                  ON t.word_id = w.id AND t.locale = ?
                LEFT JOIN nouns n
                  ON n.id = w.id
                """);
        params.add(normalizedLocale);

        if (normalizedTag != null) {
            from.append("""
                    INNER JOIN word_tags wt ON wt.word_id = w.id
                    INNER JOIN tags tg ON tg.id = wt.tag_id
                    """);
        }

        StringBuilder where = new StringBuilder(" WHERE 1=1 ");

        if (normalizedCefr != null) {
            where.append(" AND w.cefr_level = ? ");
            params.add(normalizedCefr);
        }

        if (normalizedDtype != null) {
            where.append(" AND w.dtype = ? ");
            params.add(normalizedDtype);
        }

        if (query != null) {
            where.append(" AND w.base_form LIKE ? ");
            params.add("%" + query + "%");
        }

        if (normalizedTag != null) {
            where.append(" AND tg.name = ? ");
            params.add(normalizedTag);
        }

        if (normalizedGender != null) {
            where.append(" AND n.gender = ? ");
            params.add(normalizedGender);
        }

        long total = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM (" + from + where + ") x",
                params.toArray(),
                Long.class
        );

        int offset = page * size;
        String sql = from.toString() + where + " ORDER BY w.cefr_level, w.base_form LIMIT ? OFFSET ? ";
        List<Object> pageParams = new ArrayList<>(params);
        pageParams.add(size);
        pageParams.add(offset);

        List<WordListItem> items = jdbcTemplate.query(sql, pageParams.toArray(), (rs, rowNum) -> {
            long id = rs.getLong("id");
            String rsDtype = rs.getString("dtype");
            String baseForm = rs.getString("base_form");
            String cefrLevel = rs.getString("cefr_level");
            String meaning = rs.getString("meaning");
            String example = rs.getString("example");
            String nounGender = rs.getString("gender");

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

            return new WordListItem(
                    id,
                    rsDtype,
                    baseForm,
                    cefrLevel,
                    meaning,
                    example,
                    nounGender,
                    article,
                    genderColor
            );
        });

        return new WordListResponse(items, page, size, total);
    }
}

