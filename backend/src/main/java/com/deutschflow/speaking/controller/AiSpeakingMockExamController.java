package com.deutschflow.speaking.controller;

import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/onboarding")
@RequiredArgsConstructor
@Slf4j
public class AiSpeakingMockExamController {

    private final OpenAiChatClient chatClient;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @PostMapping("/mock-exam/evaluate")
    public ResponseEntity<Map<String, Object>> evaluateMockExam(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, String> payload) {

        String transcript = payload.get("transcript_de");

        // ── Input Validation ────────────────────────────────────
        if (transcript == null || transcript.trim().length() < 10) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Transcript quá ngắn hoặc không hợp lệ. Cần ít nhất 10 ký tự."
            ));
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
            var response = chatClient.chatCompletion(messages, "json_object", 0.3, 1200);
            Map<String, Object> result = objectMapper.readValue(response.content(), Map.class);

            // ── Validate LLM output ─────────────────────────────
            if (!result.containsKey("estimated_cefr") || !result.containsKey("radar_chart")) {
                log.warn("[MockExam] LLM returned incomplete JSON for user {}", user.getId());
                return ResponseEntity.internalServerError().body(Map.of(
                        "error", "AI trả về kết quả không đầy đủ. Hãy thử lại."
                ));
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

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("[MockExam] Failed to evaluate for user {}", user.getId(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "Phân tích thất bại. Hãy thử lại sau."
            ));
        }
    }

    /**
     * GET /api/onboarding/placement-tests/latest
     * Fetch the most recent placement test result for the current user.
     */
    @GetMapping("/placement-tests/latest")
    public ResponseEntity<Map<String, Object>> getLatestPlacementTest(
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
            Map<String, Object> result = new java.util.LinkedHashMap<>();
            result.put("id", row.get("id"));
            result.put("transcript_de", row.get("transcript_de"));
            result.put("estimated_cefr", row.get("estimated_cefr"));
            result.put("created_at", row.get("created_at"));

            String radarJson = (String) row.get("radar_chart_data_json");
            if (radarJson != null) {
                result.put("radar_chart", objectMapper.readValue(radarJson, Map.class));
            }

            String errorsJson = (String) row.get("top_errors_json");
            if (errorsJson != null) {
                result.put("top_errors", objectMapper.readValue(errorsJson, List.class));
            }

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("[MockExam] Failed to fetch latest test for user {}", user.getId(), e);
            return ResponseEntity.internalServerError().build();
        }
    }
}
