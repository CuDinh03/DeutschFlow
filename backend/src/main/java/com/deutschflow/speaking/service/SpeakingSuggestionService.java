package com.deutschflow.speaking.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.common.quota.RequestContext;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.dto.AiSpeakingChatResponse.SuggestionDto;
import com.deutschflow.speaking.entity.AiSpeakingMessage;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.exception.AiErrorCode;
import com.deutschflow.speaking.exception.AiServiceException;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.speaking.util.SpeakingCefrSupport;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Đ4 (kế hoạch 04/08) — sinh 2 gợi ý trả lời THEO YÊU CẦU cho câu hỏi gần nhất của trợ lý,
 * thay vì sinh kèm mọi lượt chat (mặc định mới {@code speaking.suggestionsMode=on_demand}).
 * Call chuyên trách tí hon (~200 token vào / cap 400 ra) — rẻ hơn hẳn khối suggestions từng
 * chiếm ~⅓ completion của lượt chat, và chỉ tốn khi học viên thật sự bấm nút.
 *
 * <p>Nội dung quy tắc gợi ý giữ NGUYÊN VĂN với khối Scaffolding của prompt chat V1 (ngắn/an toàn
 * + dài/giàu ý, trả lời thẳng câu hỏi cuối, 100% đúng ngữ pháp) để chất lượng không đổi.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SpeakingSuggestionService {

    /** Cap đặt chỗ: gpt-oss là reasoning model — 2 gợi ý ~80 token nhưng phải chừa budget "nghĩ". */
    static final int SUGGESTIONS_MAX_COMPLETION_TOKENS = 400;

    private final AiSpeakingSessionRepository sessionRepository;
    private final AiSpeakingMessageRepository messageRepository;
    private final OpenAiChatClient openAiChatClient;
    private final QuotaService quotaService;
    private final AiUsageLedgerService ledgerService;
    private final ObjectMapper objectMapper;

    public List<SuggestionDto> suggestForLastAiTurn(long userId, long sessionId) {
        AiSpeakingSession session = sessionRepository.findById(sessionId)
                .filter(s -> s.getUserId().equals(userId))
                .orElseThrow(() -> new NotFoundException("Session not found: " + sessionId));

        String lastAiQuestion = messageRepository.findTop10BySessionIdOrderByCreatedAtDesc(sessionId).stream()
                .filter(m -> m.getRole() == AiSpeakingMessage.MessageRole.ASSISTANT)
                .map(AiSpeakingMessage::getAiSpeechDe)
                .filter(t -> t != null && !t.isBlank())
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Phiên chưa có câu hỏi nào của trợ lý."));

        quotaService.assertAllowed(userId, Instant.now(), 1L);

        String level = session.getCefrLevel() != null && !session.getCefrLevel().isBlank()
                ? SpeakingCefrSupport.clampBand(session.getCefrLevel())
                : "A1";
        AiChatCompletionResult result = openAiChatClient.chatCompletion(
                List.of(new ChatMessage("system", buildInstruction(level)),
                        new ChatMessage("user", lastAiQuestion)),
                null, 0.7, SUGGESTIONS_MAX_COMPLETION_TOKENS);
        recordUsage(userId, sessionId, result);
        return parseSuggestions(result.content());
    }

    private String buildInstruction(String level) {
        // Chữ "JSON" bắt buộc có mặt: GroqChatClient ép response_format=json_object và Groq từ chối
        // request json-mode mà messages không nhắc tới json.
        return """
                Du hilfst einem Deutschlernenden (Niveau %s), auf die LETZTE Frage des Tutors zu antworten.
                Erzeuge GENAU 2 Antwortvorschläge:
                - [0] KURZ + SICHER: 3-6 Wörter, leicht auszusprechen — eine direkte, klare Antwort auf die Frage.
                - [1] LÄNGER + REICHER: 8-14 Wörter — eine ehrlichere/detailliertere Antwort auf DIESELBE Frage.
                - BEIDE müssen die Frage konkret beantworten — keine generischen Satzanfänge wie 'Ich möchte sagen...'.
                - Grammatikalisch zu 100%% fehlerfrei (korrekte Wortstellung TeKaMoLo, Genus, Kasus).
                - Nicht über Niveau %s hinausgehen.
                Ausgabe: genau EIN JSON-Objekt (STRICT JSON, kein Markdown):
                {
                  "suggestions": [
                    {
                      "german_text": "",
                      "vietnamese_translation": "",
                      "level": "%s",
                      "why_to_use": "kurz Vietnamesisch",
                      "usage_context": "kurz Vietnamesisch",
                      "lego_structure": "z.B. S+V+O"
                    }
                  ]
                }
                """.formatted(level, level, level);
    }

    private List<SuggestionDto> parseSuggestions(String content) {
        try {
            JsonNode root = objectMapper.readTree(content);
            JsonNode arr = root.path("suggestions");
            List<SuggestionDto> out = new ArrayList<>();
            if (arr.isArray()) {
                for (JsonNode s : arr) {
                    String german = s.path("german_text").asText("").strip();
                    if (german.isEmpty()) {
                        continue;
                    }
                    out.add(new SuggestionDto(
                            german,
                            s.path("vietnamese_translation").asText(null),
                            s.path("level").asText(null),
                            s.path("why_to_use").asText(null),
                            s.path("usage_context").asText(null),
                            s.path("lego_structure").asText(null)));
                }
            }
            if (out.isEmpty()) {
                throw new IllegalStateException("no suggestions in payload");
            }
            return List.copyOf(out);
        } catch (Exception e) {
            // Chi tiết vào log; client nhận câu trung tính + mã retry-được (đặc tả §8.1 audit 24/07).
            log.warn("[SpeakingSuggestions] parse fail: {} — content: {}", e.getMessage(), content);
            throw new AiServiceException(AiErrorCode.AI_UPSTREAM_UNAVAILABLE,
                    "Chưa tạo được gợi ý, bạn thử lại nhé.", null, e);
        }
    }

    private void recordUsage(long userId, long sessionId, AiChatCompletionResult result) {
        try {
            if (result.usage() != null) {
                ledgerService.record(userId, result.provider(), result.model(),
                        result.usage(), "SPEAKING_SUGGESTIONS",
                        RequestContext.requestIdOrNull(), sessionId);
            }
        } catch (Exception e) {
            log.warn("Skip token usage ledger due to error: {}", e.getMessage());
        }
    }
}
