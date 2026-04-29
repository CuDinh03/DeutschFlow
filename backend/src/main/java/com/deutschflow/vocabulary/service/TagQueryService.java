package com.deutschflow.vocabulary.service;

import com.deutschflow.vocabulary.dto.TagItem;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TagQueryService {

    private final JdbcTemplate jdbcTemplate;

    /** Returns all tags. Localized label falls back to the German canonical name. */
    public List<TagItem> listTags(String locale) {
        String sql = """
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
        ), locale == null ? "de" : locale);
    }

    /** Convenience overload without locale — returns German labels. */
    public List<TagItem> listTags() {
        return listTags("de");
    }

    /** Returns all canonical tag names for use in auto-tagging prompts. */
    public List<String> listTagNames() {
        return jdbcTemplate.queryForList("SELECT name FROM tags ORDER BY name", String.class);
    }
}

