package com.deutschflow.grammar.service;

import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * AI-powered evaluation for Schreiben Teil 2 (email writing) using Goethe official rubric.
 * Uses the existing OpenAiChatClient (Groq/local) so no new API keys are needed.
 */
@Service
public class AiExamEvaluatorService {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(AiExamEvaluatorService.class);
    private static final ObjectMapper om = new ObjectMapper();

    private final OpenAiChatClient chatClient;

    public AiExamEvaluatorService(OpenAiChatClient chatClient) {
        this.chatClient = chatClient;
    }

    /**
     * Evaluate a Sprechen oral response against the official Goethe Sprechen rubric.
     * Returns a scored map with rubric scores and Vietnamese feedback.
     */
    public Map<String, Object> evaluateSprechen(String transcript, String taskPrompt, String cefrLevel) {
        if (transcript == null || transcript.isBlank()) {
            return buildEmptySprechenEvaluation("Không có nội dung bài nói");
        }

        try {
            String prompt = buildSprechenPrompt(transcript, taskPrompt, cefrLevel);
            var messages = List.of(
                new ChatMessage("system", SPRECHEN_SYSTEM_PROMPT),
                new ChatMessage("user", prompt)
            );

            var result = chatClient.chatCompletion(messages, null, 0.2, 800);
            return parseSprechenResponse(result.content(), transcript);

        } catch (Exception e) {
            log.error("AI evaluation failed for Sprechen: {}", e.getMessage(), e);
            return buildEmptySprechenEvaluation("AI chưa sẵn sàng — điểm sẽ được cập nhật sau");
        }
    }

    private String buildSprechenPrompt(String transcript, String taskPrompt, String cefrLevel) {
        String task = (taskPrompt != null && !taskPrompt.isBlank())
            ? taskPrompt
            : "Sprechen Sie frei auf Deutsch.";
        String level = (cefrLevel != null && !cefrLevel.isBlank()) ? cefrLevel : "B1";

        return """
            Task: %s
            CEFR level: %s
            Student's spoken response (text transcription):
            %s

            Evaluate using the official Goethe Sprechen rubric. Return ONLY valid JSON:
            {
              "aufgabenerfuellung": <0-5>,
              "ausdruck": <0-5>,
              "interaktion": <0-4>,
              "korrektheit": <0-4>,
              "total": <sum>,
              "max": 18,
              "feedback_vi": "<2-3 sentence feedback in Vietnamese>",
              "strengths_vi": ["<strength 1>", "<strength 2>"],
              "improvements_vi": ["<improvement 1>", "<improvement 2>"]
            }
            """.formatted(task, level, transcript);
    }

    private Map<String, Object> parseSprechenResponse(String rawJson, String transcript) {
        try {
            // Clean markdown code blocks if present
            String cleaned = rawJson.trim();
            if (cleaned.startsWith("```")) {
                cleaned = cleaned.replaceAll("^```[a-z]*\\n?", "").replaceAll("```$", "").trim();
            }
            // Extract JSON object if wrapped in extra text
            int start = cleaned.indexOf('{');
            int end = cleaned.lastIndexOf('}');
            if (start >= 0 && end > start) {
                cleaned = cleaned.substring(start, end + 1);
            }

            JsonNode node = om.readTree(cleaned);
            int aufgabe = clamp(node.path("aufgabenerfuellung").asInt(0), 0, 5);
            int ausdruck = clamp(node.path("ausdruck").asInt(0), 0, 5);
            int interaktion = clamp(node.path("interaktion").asInt(0), 0, 4);
            int korrektheit = clamp(node.path("korrektheit").asInt(0), 0, 4);
            int total = aufgabe + ausdruck + interaktion + korrektheit;

            List<String> strengths = new ArrayList<>();
            List<String> improvements = new ArrayList<>();
            node.path("strengths_vi").forEach(s -> strengths.add(s.asText()));
            node.path("improvements_vi").forEach(s -> improvements.add(s.asText()));

            Map<String, Object> eval = new LinkedHashMap<>();
            eval.put("status", "AI_EVALUATED");
            eval.put("aufgabenerfuellung", aufgabe);
            eval.put("ausdruck", ausdruck);
            eval.put("interaktion", interaktion);
            eval.put("korrektheit", korrektheit);
            eval.put("total", total);
            eval.put("max", 18);
            eval.put("percentage", (total * 100) / 18);
            eval.put("feedback_vi", node.path("feedback_vi").asText(""));
            eval.put("strengths", strengths);
            eval.put("improvements", improvements);
            eval.put("transcript", transcript);

            log.info("Sprechen AI evaluation complete: total={}/18", total);
            return eval;

        } catch (Exception e) {
            log.error("Failed to parse Sprechen AI evaluation response: {}", e.getMessage());
            return buildEmptySprechenEvaluation("Lỗi phân tích kết quả AI — vui lòng thử lại");
        }
    }

    private Map<String, Object> buildEmptySprechenEvaluation(String reason) {
        Map<String, Object> eval = new LinkedHashMap<>();
        eval.put("status", "PENDING_AI_EVALUATION");
        eval.put("total", 0);
        eval.put("max", 18);
        eval.put("percentage", 0);
        eval.put("feedback_vi", reason);
        eval.put("strengths", List.of());
        eval.put("improvements", List.of());
        return eval;
    }

    /**
     * Evaluate a Schreiben Teil 2 email response against the official Goethe A1 rubric.
     * Returns a scored map with rubric scores and bilingual feedback.
     */
    public Map<String, Object> evaluateSchreibenEmail(String emailContent, String taskPrompt) {
        if (emailContent == null || emailContent.isBlank()) {
            return buildEmptyEvaluation("Không có nội dung bài viết");
        }

        try {
            String prompt = buildSchreibenPrompt(emailContent, taskPrompt);
            var messages = List.of(
                new ChatMessage("system", SYSTEM_PROMPT),
                new ChatMessage("user", prompt)
            );

            var result = chatClient.chatCompletion(messages, null, 0.2, 800);
            return parseEvaluationResponse(result.content(), emailContent);

        } catch (Exception e) {
            log.error("AI evaluation failed for Schreiben Teil 2: {}", e.getMessage(), e);
            return buildEmptyEvaluation("AI chưa sẵn sàng — điểm sẽ được cập nhật sau");
        }
    }

    private String buildSchreibenPrompt(String emailContent, String taskPrompt) {
        String task = (taskPrompt != null && !taskPrompt.isBlank())
            ? taskPrompt
            : "Schreibe eine kurze E-Mail oder Nachricht auf Deutsch (A1-Niveau).";

        return """
            Aufgabe (task given to the student):
            %s

            Student's response:
            %s

            Evaluate this response using the Goethe Start Deutsch 1 rubric. Return ONLY valid JSON with this exact structure:
            {
              "aufgabenerfuellung": <0-5>,
              "kohaerenz": <0-4>,
              "wortschatz": <0-3>,
              "strukturen": <0-3>,
              "total": <sum of above>,
              "max": 15,
              "feedback_vi": "<2-3 sentence feedback in Vietnamese>",
              "feedback_de": "<2-3 sentence feedback in German>",
              "strengths_vi": ["<strength 1>", "<strength 2>"],
              "improvements_vi": ["<improvement 1>", "<improvement 2>"]
            }
            """.formatted(task, emailContent);
    }

    private Map<String, Object> parseEvaluationResponse(String rawJson, String emailContent) {
        try {
            // Clean markdown code blocks if present
            String cleaned = rawJson.trim();
            if (cleaned.startsWith("```")) {
                cleaned = cleaned.replaceAll("^```[a-z]*\\n?", "").replaceAll("```$", "").trim();
            }
            // Extract JSON object if wrapped in extra text
            int start = cleaned.indexOf('{');
            int end = cleaned.lastIndexOf('}');
            if (start >= 0 && end > start) {
                cleaned = cleaned.substring(start, end + 1);
            }

            JsonNode node = om.readTree(cleaned);
            int aufgabe = clamp(node.path("aufgabenerfuellung").asInt(0), 0, 5);
            int kohaerenz = clamp(node.path("kohaerenz").asInt(0), 0, 4);
            int wortschatz = clamp(node.path("wortschatz").asInt(0), 0, 3);
            int strukturen = clamp(node.path("strukturen").asInt(0), 0, 3);
            int total = aufgabe + kohaerenz + wortschatz + strukturen;

            List<String> strengths = new ArrayList<>();
            List<String> improvements = new ArrayList<>();
            node.path("strengths_vi").forEach(s -> strengths.add(s.asText()));
            node.path("improvements_vi").forEach(s -> improvements.add(s.asText()));

            Map<String, Object> eval = new LinkedHashMap<>();
            eval.put("status", "AI_EVALUATED");
            eval.put("aufgabenerfuellung", aufgabe);
            eval.put("kohaerenz", kohaerenz);
            eval.put("wortschatz", wortschatz);
            eval.put("strukturen", strukturen);
            eval.put("total", total);
            eval.put("max", 15);
            eval.put("percentage", (total * 100) / 15);
            eval.put("feedback_vi", node.path("feedback_vi").asText(""));
            eval.put("feedback_de", node.path("feedback_de").asText(""));
            eval.put("strengths", strengths);
            eval.put("improvements", improvements);
            eval.put("email_content", emailContent);

            log.info("Schreiben AI evaluation complete: total={}/15", total);
            return eval;

        } catch (Exception e) {
            log.error("Failed to parse AI evaluation response: {}", e.getMessage());
            return buildEmptyEvaluation("Lỗi phân tích kết quả AI — vui lòng thử lại");
        }
    }

    private Map<String, Object> buildEmptyEvaluation(String reason) {
        Map<String, Object> eval = new LinkedHashMap<>();
        eval.put("status", "PENDING_AI_EVALUATION");
        eval.put("total", 0);
        eval.put("max", 15);
        eval.put("percentage", 0);
        eval.put("feedback_vi", reason);
        eval.put("feedback_de", "");
        eval.put("strengths", List.of());
        eval.put("improvements", List.of());
        return eval;
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private static final String SYSTEM_PROMPT = """
        You are a certified Goethe-Institut examiner evaluating Start Deutsch 1 (A1) writing responses.

        Use the official Goethe rubric:
        - aufgabenerfuellung (0-5): Did the student address all 3 required points?
        - kohaerenz (0-4): Is the text logically organized with clear flow?
        - wortschatz (0-3): Is the vocabulary appropriate and sufficient for A1?
        - strukturen (0-3): Is the grammar and sentence structure correct for A1?

        Be strict but fair. A1 students make grammatical errors — penalize heavily only for unintelligible writing.
        Always return valid JSON only. No extra text outside the JSON object.
        """;

    private static final String SPRECHEN_SYSTEM_PROMPT = """
        You are a certified Goethe-Institut oral examiner evaluating Sprechen (speaking) responses.

        Use the official Goethe Sprechen rubric:
        - aufgabenerfuellung (0-5): Did the student fully address the task and communicate the required information?
        - ausdruck (0-5): Is the vocabulary range and expression appropriate for the CEFR level?
        - interaktion (0-4): Does the student interact appropriately, respond to prompts, and maintain conversation flow?
        - korrektheit (0-4): Is the grammar accurate enough to be clearly understood at this CEFR level?

        Total max: 18 points.
        Be encouraging but honest. Beginners make grammar errors — focus on communicative effectiveness.
        Provide feedback in Vietnamese (feedback_vi). Return valid JSON only. No extra text outside the JSON object.
        """;
}
