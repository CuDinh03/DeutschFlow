package com.deutschflow.speaking.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.common.quota.RequestContext;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.entity.AiSpeakingMessage;
import com.deutschflow.speaking.exception.AiErrorCode;
import com.deutschflow.speaking.exception.AiServiceException;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

/**
 * K4 (22/10/2026, A + B + E) — dịch câu của trợ lý trong phiên nói THEO YÊU CẦU: học viên bấm "Dịch"
 * dưới bong bóng người phỏng vấn / bạn đồng hành. Dịch một lần rồi lưu vào tin nhắn (V340); bấm lại
 * hay mở lại phiên trả bản đã lưu, không gọi AI, không tính lượt.
 *
 * <p>Không dịch sẵn trong lượt chat: prompt phỏng vấn giữ nguyên, người học tự nghe hiểu trước.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SpeakingMessageTranslationService {

    /** gpt-oss là reasoning model — câu dịch ~150 token nhưng phải chừa budget "nghĩ". */
    static final int TRANSLATION_MAX_COMPLETION_TOKENS = 800;
    static final int MAX_TRANSLATION_CHARS = 2000;

    private final AiSpeakingSessionRepository sessionRepository;
    private final AiSpeakingMessageRepository messageRepository;
    private final OpenAiChatClient openAiChatClient;
    private final QuotaService quotaService;
    private final AiUsageLedgerService ledgerService;
    private final ObjectMapper objectMapper;

    public record TranslationDto(Long messageId, String lang, String text) {}

    /**
     * @param beforeAiCall giới hạn lượt của controller — chỉ chạy khi thật sự gọi AI (bản đã lưu thì không)
     */
    public TranslationDto translate(long userId, long sessionId, long messageId, String lang, Runnable beforeAiCall) {
        String target = normaliseLang(lang);
        sessionRepository.findById(sessionId)
                .filter(s -> s.getUserId().equals(userId))
                .orElseThrow(() -> new NotFoundException("Session not found: " + sessionId));
        AiSpeakingMessage message = messageRepository.findById(messageId)
                .filter(m -> m.getSessionId().equals(sessionId))
                .filter(m -> m.getRole() == AiSpeakingMessage.MessageRole.ASSISTANT)
                .filter(m -> m.getAiSpeechDe() != null && !m.getAiSpeechDe().isBlank())
                .orElseThrow(() -> new NotFoundException("Message not found: " + messageId));

        String cached = "en".equals(target) ? message.getTranslationEn() : message.getTranslationVi();
        if (cached != null && !cached.isBlank()) {
            return new TranslationDto(messageId, target, cached);
        }

        beforeAiCall.run();
        quotaService.assertAllowed(userId, Instant.now(), 1L);
        AiChatCompletionResult result = openAiChatClient.chatCompletion(
                List.of(new ChatMessage("system", instruction(target)),
                        new ChatMessage("user", message.getAiSpeechDe())),
                null, 0.2, TRANSLATION_MAX_COMPLETION_TOKENS);
        recordUsage(userId, sessionId, result);
        String text = parse(result.content());

        if ("en".equals(target)) {
            message.setTranslationEn(text);
        } else {
            message.setTranslationVi(text);
        }
        messageRepository.save(message);
        return new TranslationDto(messageId, target, text);
    }

    static String normaliseLang(String lang) {
        String l = lang == null ? "" : lang.strip().toLowerCase(Locale.ROOT);
        if (!l.equals("vi") && !l.equals("en")) {
            throw new BadRequestException("lang must be vi or en.");
        }
        return l;
    }

    static String instruction(String target) {
        String language = "en".equals(target) ? "English" : "Vietnamese (polite \"bạn\")";
        // Chữ "JSON" bắt buộc có mặt: GroqChatClient ép response_format=json_object.
        return """
                Translate the German text from a job-interview / conversation practice app into natural %s.
                Keep the meaning, tone and question form; keep German job titles and names unchanged.
                Return ONLY one JSON object, no markdown: {"translation":"..."}
                """.formatted(language);
    }

    private String parse(String content) {
        try {
            String text = objectMapper.readTree(content).path("translation").asText("").strip()
                    .replaceAll("\\s+", " ");
            if (text.isEmpty() || text.length() > MAX_TRANSLATION_CHARS) {
                throw new IllegalStateException("empty or overlong translation");
            }
            return text;
        } catch (Exception e) {
            log.warn("[SpeakingTranslate] parse fail: {} — content: {}", e.getMessage(), content);
            throw new AiServiceException(AiErrorCode.AI_UPSTREAM_UNAVAILABLE,
                    "Chưa dịch được câu này, bạn thử lại nhé.", null, e);
        }
    }

    private void recordUsage(long userId, long sessionId, AiChatCompletionResult result) {
        try {
            if (result.usage() != null) {
                ledgerService.record(userId, result.provider(), result.model(),
                        result.usage(), "SPEAKING_TRANSLATION",
                        RequestContext.requestIdOrNull(), sessionId);
            }
        } catch (Exception e) {
            log.warn("Skip token usage ledger due to error: {}", e.getMessage());
        }
    }
}
