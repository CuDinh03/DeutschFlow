package com.deutschflow.speaking.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.common.quota.RequestContext;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.WeeklyRubricParser;
import com.deutschflow.speaking.ai.WeeklyRubricPromptBuilder;
import com.deutschflow.speaking.dto.WeeklySpeakingDtos;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.deutschflow.speaking.util.SpeakingCefrSupport;

import java.nio.charset.StandardCharsets;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDateTime;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class WeeklySpeakingService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final OpenAiChatClient openAiChatClient;
    private final WeeklyRubricPromptBuilder weeklyRubricPromptBuilder;
    private final WeeklyRubricParser weeklyRubricParser;
    private final QuotaService quotaService;
    private final AiUsageLedgerService aiUsageLedgerService;
    private final WeeklyCompanionRollupService weeklyCompanionRollupService;
    private final UserLearningProfileRepository userLearningProfileRepository;

    /** VN-aware calendar week anchored on ISO Monday (education default). */
    public LocalDate currentWeekStartVn(Instant now) {
        LocalDate today = com.deutschflow.common.quota.QuotaVnCalendar.localDateOf(now);
        return today.with(DayOfWeek.MONDAY);
    }

    public WeeklySpeakingDtos.WeeklyPromptResponse getCurrentPrompt(long userId, String cefrParam) {
        LocalDate weekStart = currentWeekStartVn(Instant.now());
        String band = resolveCefrBand(userId, cefrParam);
        Map<String, Object> row = loadPromptRow(weekStart, band);
        if (row == null) {
            row = jdbcTemplate.query("""
                                    SELECT id, week_start_date, cefr_band, title, prompt_de,
                                           mandatory_points_json, optional_points_json, prompt_version
                                    FROM weekly_speaking_prompts
                                    WHERE week_start_date = ? AND is_active = TRUE
                                    ORDER BY id ASC
                                    LIMIT 1
                                    """,
                            (rs, n) -> mapPromptRow(rs), Date.valueOf(weekStart)).stream().findFirst().orElse(null);
        }
        if (row == null) {
            throw new NotFoundException("No weekly speaking prompt for this week yet.");
        }
        return mapPrompt(row);
    }

    private Map<String, Object> loadPromptRow(LocalDate weekStart, String cefrBand) {
        List<Map<String, Object>> hits = jdbcTemplate.query("""
                        SELECT id, week_start_date, cefr_band, title, prompt_de,
                               mandatory_points_json, optional_points_json, prompt_version
                        FROM weekly_speaking_prompts
                        WHERE week_start_date = ? AND cefr_band = ? AND is_active = TRUE
                        LIMIT 1
                        """,
                (rs, n) -> mapPromptRow(rs), Date.valueOf(weekStart), cefrBand.toUpperCase(Locale.ROOT));
        return hits.isEmpty() ? null : hits.get(0);
    }

    @Transactional
    public WeeklySpeakingDtos.WeeklySubmissionResponse submit(long userId, WeeklySpeakingDtos.WeeklySubmissionRequest request) {
        if (request.transcript() == null || request.transcript().isBlank()) {
            throw new BadRequestException("transcript required");
        }
        Map<String, Object> prompt = jdbcTemplate.query("""
                                SELECT id, week_start_date, cefr_band, title, prompt_de,
                                       mandatory_points_json, optional_points_json, prompt_version
                                FROM weekly_speaking_prompts
                                WHERE id = ? AND is_active = TRUE
                                LIMIT 1
                                """,
                (rs, n) -> mapPromptRow(rs),
                request.promptId()).stream().findFirst().orElseThrow(() ->
                new NotFoundException("Weekly prompt not found or inactive."));
        LocalDate promptWeekStart = ((Date) prompt.get("week_start_date")).toLocalDate();
        LocalDate weekEndExclusive = promptWeekStart.plusDays(7);

        Integer dup = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM weekly_speaking_submissions WHERE user_id = ? AND prompt_id = ?",
                Integer.class, userId, request.promptId());
        if (dup != null && dup > 0) {
            throw new ConflictException("You already submitted audio for this weekly prompt.");
        }

        quotaService.assertAllowed(userId, Instant.now(), 1L);
        List<String> mandatory = readJsonStringList(prompt.get("mandatory_points_json"));
        List<String> optional = readJsonStringList(prompt.get("optional_points_json"));
        String learnerBand = resolveCefrBand(userId, request.cefrBand());

        ChatMessage sys = weeklyRubricPromptBuilder.buildSystemMessage(mandatory, optional, learnerBand);
        int wc = WeeklyRubricPromptBuilder.germanWordApproxCount(request.transcript());
        ChatMessage usr = weeklyRubricPromptBuilder.buildUserMessage(
                String.valueOf(prompt.get("prompt_de")),
                request.transcript(),
                request.audioDurationSec(),
                Integer.toString(wc));

        var snap = quotaService.getSnapshot(userId, Instant.now());
        int maxTokens = (int) Math.min(8192L, Math.min(4096L, Math.max(256L, snap.remainingThisMonth())));

        AiChatCompletionResult ai;
        try {
            ai = openAiChatClient.chatCompletion(List.of(sys, usr), null, 0.2, maxTokens);
        } catch (Exception e) {
            log.warn("Weekly rubric LLM failed: {}", e.getMessage());
            throw new BadRequestException("Grading temporarily unavailable.");
        }

        if (ai.usage() != null) {
            aiUsageLedgerService.record(
                    userId,
                    ai.provider(),
                    ai.model(),
                    ai.usage().promptTokens(),
                    ai.usage().completionTokens(),
                    ai.usage().totalTokens(),
                    "WEEK_RUBRIC",
                    RequestContext.requestIdOrNull(),
                    null);
        }

        WeeklyRubricParser.ParsedWeeklyRubric parsed;
        try {
            parsed = weeklyRubricParser.parseValidated(ai.content());
        } catch (IllegalArgumentException ex) {
            log.warn("Rubric validation failed: {}", ex.getMessage());
            throw new BadRequestException("Model returned unusable grading JSON.");
        }

        WeeklySpeakingDtos.WeeklyRubricView view = parsed.view();

        String grammarExtract;
        try {
            grammarExtract = objectMapper.writeValueAsString(view.grammar().errors());
        } catch (Exception e) {
            grammarExtract = "[]";
        }

        jdbcTemplate.update("""
                        INSERT INTO weekly_speaking_submissions (
                          user_id, prompt_id, transcript_text, audio_duration_sec,
                          rubric_payload_json, grammar_errors_extracted_json, model_used, rubric_prompt_version
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                userId, request.promptId(), request.transcript(),
                request.audioDurationSec(),
                parsed.validatedJsonCanonical(),
                grammarExtract,
                ai.model(),
                String.valueOf(prompt.get("prompt_version")));

        Long sid = jdbcTemplate.queryForObject(
                "SELECT id FROM weekly_speaking_submissions WHERE user_id = ? AND prompt_id = ?",
                Long.class, userId, request.promptId());

        boolean merged = weeklyCompanionRollupService.tryMergeWeeklySubmission(
                userId,
                promptWeekStart,
                weekEndExclusive,
                view,
                sid != null ? sid : 0L,
                ((Number) prompt.get("id")).longValue(),
                ai.model());

        return new WeeklySpeakingDtos.WeeklySubmissionResponse(
                sid != null ? sid : 0L,
                request.promptId(),
                view,
                merged);
    }

    @Transactional(readOnly = true)
    public Page<WeeklySpeakingDtos.WeeklySubmissionListItem> listMySubmissions(long userId, Pageable pageable) {
        Long totalLong = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM weekly_speaking_submissions WHERE user_id = ?",
                Long.class,
                userId);
        long total = totalLong == null ? 0L : totalLong;
        if (total == 0L) {
            return new PageImpl<>(List.of(), pageable, 0L);
        }
        List<WeeklySpeakingDtos.WeeklySubmissionListItem> rows = jdbcTemplate.query("""
                        SELECT s.id, s.prompt_id, s.created_at, s.rubric_payload_json,
                               p.week_start_date, p.title, p.cefr_band
                        FROM weekly_speaking_submissions s
                        JOIN weekly_speaking_prompts p ON p.id = s.prompt_id
                        WHERE s.user_id = ?
                        ORDER BY s.created_at DESC
                        LIMIT ? OFFSET ?
                        """,
                (rs, n) -> mapSubmissionListRow(rs),
                userId,
                pageable.getPageSize(),
                (int) pageable.getOffset());
        return new PageImpl<>(rows, pageable, total);
    }

    @Transactional(readOnly = true)
    public WeeklySpeakingDtos.WeeklySubmissionDetailDto getSubmissionForUser(long userId, long submissionId) {
        List<WeeklySpeakingDtos.WeeklySubmissionDetailDto> rows = jdbcTemplate.query("""
                            SELECT s.id, s.prompt_id, s.created_at, s.transcript_text, s.rubric_payload_json,
                                   p.week_start_date, p.title, p.prompt_de, p.cefr_band
                            FROM weekly_speaking_submissions s
                            JOIN weekly_speaking_prompts p ON p.id = s.prompt_id
                            WHERE s.user_id = ? AND s.id = ?
                            LIMIT 1
                            """,
                (rs, n) -> mapSubmissionDetailRow(rs),
                userId,
                submissionId);
        return rows.stream()
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Weekly submission not found."));
    }

    private WeeklySpeakingDtos.WeeklySubmissionListItem mapSubmissionListRow(ResultSet rs) throws SQLException {
        JsonNode rubric = parseRubricJson(rs.getString("rubric_payload_json"));
        LocalDate ws = rs.getDate("week_start_date").toLocalDate();
        Timestamp ts = rs.getTimestamp("created_at");
        LocalDateTime created = ts != null ? ts.toLocalDateTime() : LocalDateTime.now();
        return new WeeklySpeakingDtos.WeeklySubmissionListItem(
                rs.getLong("id"),
                rs.getLong("prompt_id"),
                ws,
                rs.getString("title"),
                rs.getString("cefr_band"),
                created,
                rubric != null ? readTaskScore(rubric) : null,
                rubricFeedbackPreview(rubric));
    }

    private WeeklySpeakingDtos.WeeklySubmissionDetailDto mapSubmissionDetailRow(ResultSet rs) throws SQLException {
        String rawRub = rs.getString("rubric_payload_json");
        WeeklySpeakingDtos.WeeklyRubricView view = null;
        try {
            if (rawRub != null && !rawRub.isBlank()) {
                view = objectMapper.readValue(rawRub, WeeklySpeakingDtos.WeeklyRubricView.class);
            }
        } catch (Exception e) {
            log.debug("Could not map WeeklyRubricView from DB payload: {}", e.getMessage());
        }
        Timestamp ts = rs.getTimestamp("created_at");
        LocalDateTime created = ts != null ? ts.toLocalDateTime() : LocalDateTime.now();
        LocalDate ws = rs.getDate("week_start_date").toLocalDate();
        return new WeeklySpeakingDtos.WeeklySubmissionDetailDto(
                rs.getLong("id"),
                rs.getLong("prompt_id"),
                ws,
                rs.getString("title"),
                rs.getString("prompt_de"),
                rs.getString("cefr_band"),
                created,
                rs.getString("transcript_text"),
                view,
                view == null ? rawRub : null);
    }

    private JsonNode parseRubricJson(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readTree(raw);
        } catch (Exception e) {
            return null;
        }
    }

    private Integer readTaskScore(JsonNode rubricRoot) {
        JsonNode tc = rubricRoot.get("task_completion");
        if (tc != null && tc.hasNonNull("score_1_to_5")) {
            return tc.get("score_1_to_5").asInt();
        }
        return null;
    }

    private String rubricFeedbackPreview(JsonNode rubricRoot) {
        if (rubricRoot == null || !rubricRoot.hasNonNull("feedback_vi_summary")) {
            return null;
        }
        String s = rubricRoot.get("feedback_vi_summary").asText();
        return s.length() <= 280 ? s : s.substring(0, 277) + "…";
    }

    private static Map<String, Object> mapPromptRow(ResultSet rs) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", rs.getLong("id"));
        m.put("week_start_date", rs.getDate("week_start_date"));
        m.put("cefr_band", rs.getString("cefr_band"));
        m.put("title", rs.getString("title"));
        m.put("prompt_de", rs.getString("prompt_de"));
        m.put("mandatory_points_json", rs.getString("mandatory_points_json"));
        m.put("optional_points_json", rs.getString("optional_points_json"));
        m.put("prompt_version", rs.getString("prompt_version"));
        return m;
    }

    private WeeklySpeakingDtos.WeeklyPromptResponse mapPrompt(Map<String, Object> row) {
        LocalDate ws = ((Date) row.get("week_start_date")).toLocalDate();
        return new WeeklySpeakingDtos.WeeklyPromptResponse(
                ((Number) row.get("id")).longValue(),
                ws,
                String.valueOf(row.get("cefr_band")),
                String.valueOf(row.get("title")),
                String.valueOf(row.get("prompt_de")),
                readJsonStringList(row.get("mandatory_points_json")),
                readOptionalList(row.get("optional_points_json")),
                String.valueOf(row.get("prompt_version")));
    }

    private List<String> readOptionalList(Object jsonCol) {
        List<String> l = readJsonStringList(jsonCol);
        return l == null ? Collections.emptyList() : l;
    }

    private List<String> readJsonStringList(Object jsonCol) {
        if (jsonCol == null) return List.of();
        try {
            String raw;
            if (jsonCol instanceof String s) {
                raw = s;
            } else if (jsonCol instanceof byte[] b) {
                raw = new String(b, StandardCharsets.UTF_8);
            } else {
                raw = objectMapper.writeValueAsString(jsonCol);
            }
            if (raw == null || raw.isBlank()) return List.of();
            JsonNode node = objectMapper.readTree(raw);
            if (node.isTextual()) {
                node = objectMapper.readTree(node.asText());
            }
            if (!node.isArray()) return List.of();
            List<String> out = new ArrayList<>();
            for (JsonNode n : node) {
                if (n != null && n.isTextual()) {
                    out.add(n.asText());
                }
            }
            return out;
        } catch (Exception e) {
            log.warn("Could not parse string list JSON: {}", e.getMessage());
            return List.of();
        }
    }

    private String resolveCefrBand(Long userId, String param) {
        UserLearningProfile p =
                userId == null ? null : userLearningProfileRepository.findByUserId(userId).orElse(null);
        if (param != null && !param.isBlank()) {
            return SpeakingCefrSupport.clampToProfileRange(param, p);
        }
        return SpeakingCefrSupport.floorPracticeBand(p);
    }
}
