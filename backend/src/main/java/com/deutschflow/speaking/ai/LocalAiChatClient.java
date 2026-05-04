package com.deutschflow.speaking.ai;

import com.deutschflow.ai.AIModelService;
import com.deutschflow.speaking.exception.AiServiceException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

/**
 * Chat/completions backed by the on-device {@code deutschflow_model} served by {@link AIModelService}
 * (Python FastAPI Alpaca prompts). Mirrors the structured JSON expectations of {@link SystemPromptBuilder}.
 */
@Component
@Slf4j
public class LocalAiChatClient implements OpenAiChatClient {

    public static final String PROVIDER_LOCAL = "LOCAL";

    private final AIModelService aiModelService;
    private final String modelId;

    public LocalAiChatClient(
            AIModelService aiModelService,
            @Value("${app.ai.local-model-id:deutschflow_model}") String modelId) {
        this.aiModelService = aiModelService;
        this.modelId = modelId;
        log.info("LocalAiChatClient initialized — model id: {}", modelId);
    }

    @Override
    public AiChatCompletionResult chatCompletion(
            List<ChatMessage> messages, String model, double temperature, Integer maxTokens) {
        String effectiveModel = (model == null || model.isBlank()) ? modelId : model.trim();
        String instruction;
        String input;
        try {
            PromptParts parts = toAlpacaParts(messages);
            instruction = parts.instruction();
            input = parts.input();
        } catch (Exception e) {
            throw new AiServiceException("Failed to build local AI prompt", e);
        }

        int mt = maxTokens != null && maxTokens > 0 ? maxTokens : 600;

        log.debug("Calling local AI server (blocking): effectiveModel={}, maxTokens={}", effectiveModel, mt);
        try {
            String content = aiModelService.generate(instruction, input, mt, temperature);
            TokenUsage usage = estimateUsage(messages, content);
            return new AiChatCompletionResult(content, usage, PROVIDER_LOCAL, effectiveModel);
        } catch (RuntimeException e) {
            throw new AiServiceException("Local AI service failed: " + e.getMessage(), e);
        }
    }

    @Override
    public boolean chatCompletionStream(
            List<ChatMessage> messages,
            String model,
            double temperature,
            Integer maxTokens,
            Consumer<String> onToken,
            Consumer<AiChatCompletionResult> onComplete,
            AtomicBoolean cancelled) {
        if (cancelled != null && cancelled.get()) {
            return false;
        }
        AiChatCompletionResult r = chatCompletion(messages, model, temperature, maxTokens);
        if (cancelled != null && cancelled.get()) {
            return false;
        }
        onToken.accept(r.content());
        onComplete.accept(r);
        return true;
    }

    private record PromptParts(String instruction, String input) {}

    private static PromptParts toAlpacaParts(List<ChatMessage> messages) {
        if (messages == null || messages.isEmpty()) {
            return new PromptParts("Du bist ein hilfreicher Assistent.", "");
        }

        StringBuilder systems = new StringBuilder();
        StringBuilder dialog = new StringBuilder();

        for (ChatMessage m : messages) {
            if (m == null) {
                continue;
            }
            String role = m.role() == null ? "user" : m.role().trim().toLowerCase(Locale.ROOT);
            String body = m.content() == null ? "" : m.content();

            if ("system".equals(role)) {
                if (systems.length() > 0) {
                    systems.append("\n\n");
                }
                systems.append(body);
            } else {
                dialog.append(role).append(": ").append(body).append("\n");
            }
        }

        String instruction =
                systems.length() > 0 ? systems.toString() : "Du bist ein hilfreicher deutschsprachiger Tutor.";
        String input = dialog.toString().trim();
        return new PromptParts(instruction, input);
    }

    private static TokenUsage estimateUsage(List<ChatMessage> messages, String completionText) {
        int promptChars = 0;
        if (messages != null) {
            for (ChatMessage m : messages) {
                if (m != null && m.content() != null) {
                    promptChars += m.content().length();
                }
            }
        }
        int completionChars = completionText == null ? 0 : completionText.length();
        int promptTokens = Math.max(1, (int) Math.ceil(promptChars / 4.0));
        int completionTokens = Math.max(1, (int) Math.ceil(completionChars / 4.0));
        return TokenUsage.estimated(promptTokens, completionTokens, promptTokens + completionTokens);
    }
}
