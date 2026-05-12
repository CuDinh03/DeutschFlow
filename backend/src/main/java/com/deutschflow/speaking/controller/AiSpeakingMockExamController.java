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
        
        // Use LLM to analyze the transcript
        String prompt = """
            Du bist ein Goethe-Zertifikat Prüfer. Analysiere das folgende Transkript eines 3-minütigen Sprechtests.
            Gib ein JSON zurück mit:
            1. estimated_cefr: (A1, A2, B1, B2, C1)
            2. radar_chart: { grammar: 0-100, pronunciation: 0-100, vocabulary: 0-100, fluency: 0-100 }
            3. top_errors: Array von 3 häufigsten Fehlern, z.B. {"code": "KASUS_AKK", "message": "Der Akkusativ wird oft falsch verwendet", "example": "Ich sehe der Mann -> den Mann"}
            
            Transkript:
            """ + transcript;

        var messages = List.of(new ChatMessage("user", prompt));
        var response = chatClient.chatCompletion(messages, "json_object", 0.3, 1000);
        
        try {
            Map<String, Object> result = objectMapper.readValue(response.content(), Map.class);
            
            // Save to user_placement_tests
            jdbcTemplate.update("""
                INSERT INTO user_placement_tests 
                (user_id, transcript_de, estimated_cefr, radar_chart_data_json, top_errors_json) 
                VALUES (?, ?, ?, ?::jsonb, ?::jsonb)
                """,
                user.getId(),
                transcript,
                result.get("estimated_cefr"),
                objectMapper.writeValueAsString(result.get("radar_chart")),
                objectMapper.writeValueAsString(result.get("top_errors"))
            );
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Failed to parse mock exam analysis", e);
            return ResponseEntity.internalServerError().build();
        }
    }
}
