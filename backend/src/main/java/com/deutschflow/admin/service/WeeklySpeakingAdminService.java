package com.deutschflow.admin.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.speaking.dto.WeeklySpeakingDtos;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class WeeklySpeakingAdminService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listPrompts(LocalDate weekStartFilter) {
        StringBuilder sql = new StringBuilder("""
                SELECT id, week_start_date, cefr_band, title, prompt_de,
                       mandatory_points_json, optional_points_json, prompt_version, is_active,
                       created_at, updated_at
                FROM weekly_speaking_prompts
                WHERE 1 = 1
                """);
        if (weekStartFilter != null) {
            sql.append(" AND week_start_date = ? ");
        }
        sql.append(" ORDER BY week_start_date DESC, cefr_band ASC");
        if (weekStartFilter != null) {
            return jdbcTemplate.queryForList(sql.toString(), Date.valueOf(weekStartFilter));
        }
        return jdbcTemplate.queryForList(sql.toString());
    }

    @Transactional
    public long createPrompt(WeeklySpeakingDtos.WeeklyPromptAdminUpsertRequest r) throws Exception {
        String mandatory = objectMapper.writeValueAsString(r.mandatoryPoints());
        String optional = (r.optionalPoints() == null || r.optionalPoints().isEmpty())
                ? null
                : objectMapper.writeValueAsString(r.optionalPoints());
        boolean active = r.active() == null || r.active();
        GeneratedKeyHolder kh = new GeneratedKeyHolder();
        jdbcTemplate.update(con -> {
            PreparedStatement ps = con.prepareStatement("""
                            INSERT INTO weekly_speaking_prompts (
                              week_start_date, cefr_band, title, prompt_de,
                              mandatory_points_json, optional_points_json, prompt_version, is_active
                            ) VALUES (?, ?, ?, ?, ?, ?, 'v1', ?)
                            """, Statement.RETURN_GENERATED_KEYS);
            ps.setDate(1, Date.valueOf(r.weekStartDate()));
            ps.setString(2, r.cefrBand().trim().toUpperCase(Locale.ROOT));
            ps.setString(3, r.title().trim());
            ps.setString(4, r.promptDe());
            ps.setString(5, mandatory);
            if (optional == null) {
                ps.setNull(6, java.sql.Types.LONGVARCHAR);
            } else {
                ps.setString(6, optional);
            }
            ps.setBoolean(7, active);
            return ps;
        }, kh);
        Number key = kh.getKey();
        if (key == null) {
            throw new IllegalStateException("Insert failed");
        }
        return key.longValue();
    }

    @Transactional
    public Map<String, Object> updatePrompt(long id, WeeklySpeakingDtos.WeeklyPromptAdminUpsertRequest r) throws Exception {
        Integer cnt = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM weekly_speaking_prompts WHERE id = ?", Integer.class, id);
        if (cnt == null || cnt == 0) {
            throw new NotFoundException("Weekly prompt not found");
        }
        String mandatory = objectMapper.writeValueAsString(r.mandatoryPoints());
        String optional = (r.optionalPoints() == null || r.optionalPoints().isEmpty())
                ? null
                : objectMapper.writeValueAsString(r.optionalPoints());
        boolean active = r.active() == null || r.active();
        jdbcTemplate.update("""
                        UPDATE weekly_speaking_prompts SET
                          week_start_date = ?,
                          cefr_band = ?,
                          title = ?,
                          prompt_de = ?,
                          mandatory_points_json = ?,
                          optional_points_json = ?,
                          is_active = ?,
                          updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                        """,
                Date.valueOf(r.weekStartDate()),
                r.cefrBand().trim().toUpperCase(Locale.ROOT),
                r.title().trim(),
                r.promptDe(),
                mandatory,
                optional,
                active,
                id);
        return getPrompt(id);
    }

    @Transactional
    public void deactivatePrompt(long id) {
        int u = jdbcTemplate.update("""
                        UPDATE weekly_speaking_prompts SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?
                        """, id);
        if (u == 0) {
            throw new NotFoundException("Weekly prompt not found");
        }
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getPrompt(long id) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT * FROM weekly_speaking_prompts WHERE id = ?", id);
        if (rows.isEmpty()) {
            throw new NotFoundException("Weekly prompt not found");
        }
        return new LinkedHashMap<>(rows.get(0));
    }
}
