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

    public List<TagItem> listTags() {
        return jdbcTemplate.query(
                "SELECT id, name, color FROM tags ORDER BY name",
                (rs, rowNum) -> new TagItem(
                        rs.getLong("id"),
                        rs.getString("name"),
                        rs.getString("color")
                )
        );
    }
}

