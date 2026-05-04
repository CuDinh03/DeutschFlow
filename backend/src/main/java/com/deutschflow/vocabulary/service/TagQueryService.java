package com.deutschflow.vocabulary.service;

import com.deutschflow.vocabulary.dto.TagItem;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TagQueryService {

    private final JdbcTemplate jdbcTemplate;

    /** Returns all tags. Localized label falls back to the German canonical name. */
    public List<TagItem> listTags(String locale) {
        return listTags(locale, false);
    }

    /**
     * @param topicsOnly when true, returns only tags flagged as V31 topic taxonomy (student pickers).
     */
    public List<TagItem> listTags(String locale, boolean topicsOnly) {
        String loc = locale == null ? "de" : locale;
        String sql = topicsOnly
                ? """
                SELECT t.id, t.name, t.color,
                       COALESCE(tt.label, t.name) AS localized_label
                FROM tags t
                LEFT JOIN tag_translations tt ON tt.tag_id = t.id AND tt.locale = ?
                WHERE t.is_topic_taxonomy IS TRUE
                ORDER BY COALESCE(tt.label, t.name)
                """
                : """
                SELECT t.id, t.name, t.color,
                       COALESCE(tt.label, t.name) AS localized_label
                FROM tags t
                LEFT JOIN tag_translations tt ON tt.tag_id = t.id AND tt.locale = ?
                ORDER BY COALESCE(tt.label, t.name)
                """;
        return jdbcTemplate.query(sql, (rs, rowNum) -> new TagItem(
                rs.getLong("id"),
                rs.getString("name"),
                rs.getString("color"),
                rs.getString("localized_label")
        ), loc);
    }

    /** Convenience overload without locale — returns German labels. */
    public List<TagItem> listTags() {
        return listTags("de");
    }

    /** Returns all tag names (admin / diagnostics). */
    public List<String> listTagNames() {
        return jdbcTemplate.queryForList("SELECT name FROM tags ORDER BY name", String.class);
    }

    /** Topic facet used by auto-tag prompts and reset scope (V31 + is_topic_taxonomy). */
    public List<String> listTopicTaxonomyTagNames() {
        return jdbcTemplate.queryForList(
                "SELECT name FROM tags WHERE is_topic_taxonomy IS TRUE ORDER BY name", String.class);
    }

    /** Admin: quick coverage for topic taxonomy vs total words. */
    public Map<String, Object> topicTaxonomyCoverageSummary() {
        Long topicTagCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM tags WHERE is_topic_taxonomy IS TRUE", Long.class);
        Long totalWords = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM words", Long.class);
        Long wordsWithTopicTag = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(DISTINCT w.id) FROM words w
                        WHERE EXISTS (
                          SELECT 1 FROM word_tags wt
                          JOIN tags t ON t.id = wt.tag_id
                          WHERE wt.word_id = w.id AND t.is_topic_taxonomy IS TRUE
                        )
                        """,
                Long.class);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("topicTagCount", topicTagCount != null ? topicTagCount.longValue() : 0L);
        m.put("totalWords", totalWords != null ? totalWords : 0L);
        m.put("wordsWithTopicTag", wordsWithTopicTag != null ? wordsWithTopicTag : 0L);
        long tw = totalWords != null ? totalWords : 0L;
        long wt = wordsWithTopicTag != null ? wordsWithTopicTag : 0L;
        double pct = tw > 0 ? (100.0 * wt / tw) : 0.0;
        m.put("percentWordsWithTopicTag", Math.round(pct * 10.0) / 10.0);
        return m;
    }
}

