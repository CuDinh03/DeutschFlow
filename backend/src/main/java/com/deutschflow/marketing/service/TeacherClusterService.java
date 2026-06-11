package com.deutschflow.marketing.service;

import com.deutschflow.marketing.dto.TeacherClusterDto;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Detects centers with ≥N non-org (free) teachers who self-declared the same place (checklist D11)
 * → surfaces them as B2B org-sales leads in the admin growth dashboard. Org teachers are excluded
 * (they already belong to a center). Grouping is case-insensitive on the trimmed center name.
 */
@Service
@RequiredArgsConstructor
public class TeacherClusterService {

    private static final int MIN_CLUSTER_SIZE = 2;
    /** Upper bound so a nonsensical {@code minSize} (ADMIN-only param) can't reach the query/logs. */
    private static final int MAX_CLUSTER_SIZE = 10_000;

    private final JdbcTemplate jdbcTemplate;

    @Transactional(readOnly = true)
    public List<TeacherClusterDto> clusters(int minSize) {
        int threshold = Math.min(MAX_CLUSTER_SIZE, Math.max(MIN_CLUSTER_SIZE, minSize));
        return jdbcTemplate.query("""
                        SELECT MIN(TRIM(center_name))                 AS center_name,
                               COUNT(*)::int                          AS teacher_count,
                               STRING_AGG(email, ', ' ORDER BY email) AS emails
                        FROM users
                        WHERE role = 'TEACHER'
                          AND org_id IS NULL
                          AND center_name IS NOT NULL
                          AND TRIM(center_name) <> ''
                        GROUP BY LOWER(TRIM(center_name))
                        HAVING COUNT(*) >= ?
                        ORDER BY teacher_count DESC, center_name ASC
                        """,
                (rs, rowNum) -> new TeacherClusterDto(
                        rs.getString("center_name"),
                        rs.getInt("teacher_count"),
                        rs.getString("emails")),
                threshold);
    }
}
