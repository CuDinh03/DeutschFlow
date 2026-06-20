package com.deutschflow.speaking.controller;

import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.dto.MockExamEvalDto;
import com.deutschflow.speaking.dto.PlacementTestDto;
import com.deutschflow.speaking.dto.SprechenTurnDto;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/onboarding")
@RequiredArgsConstructor
@Slf4j
public class AiSpeakingMockExamController {

    private static final long MOCK_EVAL_ESTIMATED_TOKENS = 800L;

    private final OpenAiChatClient chatClient;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final com.deutschflow.speaking.service.SprechenTeil2Service sprechenTeil2Service;
    private final com.deutschflow.speaking.AiRateLimiterService aiRateLimiterService;
    private final QuotaService quotaService;
    private final OrgPoolGuard orgPoolGuard;

    @PostMapping("/mock-exam/evaluate")
    public ResponseEntity<MockExamEvalDto> evaluateMockExam(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, String> payload) {

        requireEvalBudget(user.getId());
        String transcript = payload.get("transcript_de");

        // ── Input Validation ────────────────────────────────────
        if (transcript == null || transcript.trim().length() < 10) {
            return ResponseEntity.badRequest().body(
                    MockExamEvalDto.error("Transcript quá ngắn hoặc không hợp lệ. Cần ít nhất 10 ký tự."));
        }

        // ── Sanitize: limit length to prevent prompt abuse ──────
        String sanitized = transcript.trim();
        if (sanitized.length() > 5000) {
            sanitized = sanitized.substring(0, 5000);
        }

        // ── LLM Analysis ────────────────────────────────────────
        String prompt = """
            Du bist ein erfahrener Goethe-Zertifikat Prüfer. Analysiere das folgende Transkript eines 3-minütigen Sprechtests.
            
            WICHTIG: Antworte NUR mit gültigem JSON. Keine Markdown, kein Text davor oder danach.
            
            JSON-Schema:
            {
              "estimated_cefr": "A1" | "A2" | "B1" | "B2" | "C1",
              "radar_chart": {
                "grammar": 0-100,
                "pronunciation": 0-100,
                "vocabulary": 0-100,
                "fluency": 0-100
              },
              "top_errors": [
                {
                  "code": "ERROR_CODE",
                  "message": "Beschreibung auf Vietnamesisch",
                  "example": "falsch -> richtig"
                }
              ],
              "summary_vi": "Tóm tắt ngắn gọn năng lực bằng tiếng Việt (2-3 câu)"
            }
            
            Regeln:
            - top_errors: maximal 5 Fehler, sortiert nach Häufigkeit
            - Bewerte ehrlich und fair
            - Berücksichtige auch die Länge und Komplexität der Sätze
            
            Transkript des Prüflings:
            ---
            """ + sanitized + "\n---";

        var messages = List.of(new ChatMessage("user", prompt));

        try {
            // model = null → configured default speaking model (app.ai.groq.model). JSON output is
            // already forced by GroqChatClient's response_format; passing "json_object" here would be
            // sent as the MODEL name → Groq HTTP 400 → this catch → mock-exam eval silently fails.
            // (Same bug family as the SprechenTeil2 / #94 grading fix.)
            var response = chatClient.chatCompletion(messages, null, 0.3, 1200);
            Map<String, Object> result = objectMapper.readValue(response.content(), Map.class);

            // ── Validate LLM output ─────────────────────────────
            if (!result.containsKey("estimated_cefr") || !result.containsKey("radar_chart")) {
                log.warn("[MockExam] LLM returned incomplete JSON for user {}", user.getId());
                return ResponseEntity.internalServerError().body(
                        MockExamEvalDto.error("AI trả về kết quả không đầy đủ. Hãy thử lại."));
            }

            // ── Persist to database ─────────────────────────────
            Long recordId = jdbcTemplate.queryForObject("""
                INSERT INTO user_placement_tests
                (user_id, transcript_de, estimated_cefr, radar_chart_data_json, top_errors_json)
                VALUES (?, ?, ?, ?::jsonb, ?::jsonb)
                RETURNING id
                """,
                    Long.class,
                    user.getId(),
                    sanitized,
                    result.get("estimated_cefr"),
                    objectMapper.writeValueAsString(result.get("radar_chart")),
                    objectMapper.writeValueAsString(result.get("top_errors"))
            );

            // Add record ID to response for client-side navigation
            result.put("id", recordId);

            log.info("[MockExam] user={}, cefr={}, errors={}",
                    user.getId(), result.get("estimated_cefr"),
                    result.containsKey("top_errors") ? ((List<?>) result.get("top_errors")).size() : 0);

            return ResponseEntity.ok(MockExamEvalDto.success(result));
        } catch (Exception e) {
            log.error("[MockExam] Failed to evaluate for user {}", user.getId(), e);
            return ResponseEntity.internalServerError().body(
                    MockExamEvalDto.error("Phân tích thất bại. Hãy thử lại sau."));
        }
    }

    @GetMapping("/mock-exam/sprechen-teil2/card")
    public ResponseEntity<com.deutschflow.speaking.service.SprechenTeil2Service.SprechenCard> getRandomCard() {
        return ResponseEntity.ok(sprechenTeil2Service.getRandomCard());
    }

    @PostMapping("/mock-exam/sprechen-teil2/turn")
    public ResponseEntity<SprechenTurnDto> evaluateSprechenTeil2Turn(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, String> payload) {

        requireEvalBudget(user.getId());
        String stage = payload.get("stage");
        String thema = payload.get("thema");
        String wort = payload.get("wort");
        String transcript = payload.get("transcript");
        String aiQuestionAsked = payload.get("ai_question_asked");

        if (stage == null || thema == null || wort == null || transcript == null) {
            return ResponseEntity.badRequest().body(SprechenTurnDto.error("Missing required fields"));
        }

        try {
            // Evaluate user's input
            Map<String, Object> evaluation = sprechenTeil2Service.evaluateTurn(stage, thema, wort, transcript, aiQuestionAsked);
            
            // If the user just asked, the AI answers. Now we need to prepare the next turn (AI asking user).
            if ("USER_ASKING".equals(stage)) {
                var nextCard = sprechenTeil2Service.getRandomCard();
                String nextAiQuestion = sprechenTeil2Service.generateAiQuestion(nextCard.thema(), nextCard.wort());
                evaluation.put("next_stage", "USER_ANSWERING");
                evaluation.put("next_thema", nextCard.thema());
                evaluation.put("next_wort", nextCard.wort());
                evaluation.put("next_ai_question", nextAiQuestion);
            } else {
                evaluation.put("next_stage", "FINISHED");
            }
            
            return ResponseEntity.ok(SprechenTurnDto.from(evaluation));
        } catch (Exception e) {
            log.error("[MockExam] Failed to process Sprechen Teil 2 for user {}", user.getId(), e);
            return ResponseEntity.internalServerError().body(SprechenTurnDto.error("AI processing failed"));
        }
    }

    /**
     * GET /api/onboarding/placement-tests/latest
     * Fetch the most recent placement test result for the current user.
     */
    @GetMapping("/placement-tests/latest")
    public ResponseEntity<PlacementTestDto> getLatestPlacementTest(
            @AuthenticationPrincipal User user) {
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT id, transcript_de, estimated_cefr,
                       radar_chart_data_json::text AS radar_chart_data_json,
                       top_errors_json::text AS top_errors_json,
                       created_at
                FROM user_placement_tests
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT 1
                """, user.getId());

            if (rows.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Map<String, Object> row = rows.get(0);
            String radarJson = (String) row.get("radar_chart_data_json");
            String errorsJson = (String) row.get("top_errors_json");
            PlacementTestDto result = new PlacementTestDto(
                    ((Number) row.get("id")).longValue(),
                    (String) row.get("transcript_de"),
                    (String) row.get("estimated_cefr"),
                    (Date) row.get("created_at"),
                    radarJson != null ? objectMapper.readValue(radarJson, Object.class) : null,
                    errorsJson != null ? objectMapper.readValue(errorsJson, Object.class) : null);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("[MockExam] Failed to fetch latest test for user {}", user.getId(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /** Throw 429/402 when this user has exceeded rate-limit or token quota. */
    private void requireEvalBudget(long userId) {
        quotaService.assertAllowed(userId, Instant.now(), MOCK_EVAL_ESTIMATED_TOKENS);
        orgPoolGuard.assertOrgPoolAvailable(userId, MOCK_EVAL_ESTIMATED_TOKENS);
        if (!aiRateLimiterService.allow(com.deutschflow.speaking.AiRateLimiterService.Bucket.EVAL, userId)) {
            throw new com.deutschflow.common.exception.RateLimitExceededException(
                    "Too many evaluations. Please slow down.",
                    aiRateLimiterService.retryAfterSeconds(com.deutschflow.speaking.AiRateLimiterService.Bucket.EVAL));
        }
    }
}
