package com.deutschflow.speaking.ai;

import com.deutschflow.speaking.exception.AiServiceException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

/**
 * Calls the Groq API using its OpenAI-compatible Chat Completions endpoint.
 * Supports both blocking and SSE-streaming modes.
 *
 * <p>Endpoint: POST https://api.groq.com/openai/v1/chat/completions
 * <p>Default model: {@code meta-llama/llama-4-scout-17b-16e-instruct}
 */
@Component
@Slf4j
public class GroqChatClient implements OpenAiChatClient {

    private static final String GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions";
    private static final int MAX_RETRIES = 5;
    private static final long[] BACKOFF_MILLIS = {2_000L, 4_000L, 8_000L, 16_000L, 32_000L};

    /**
     * Limits concurrent Groq API calls to avoid bursting past the 30 RPM free-tier limit.
     * With 3 permits, at most 3 LLM requests run simultaneously; additional callers queue.
     */
    private static final Semaphore GROQ_SEMAPHORE = new Semaphore(3);

    private final RestClient restClient;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String defaultModel;

    public GroqChatClient(
            @Value("${app.ai.groq.api-key:}") String apiKey,
            @Value("${app.ai.groq.model:meta-llama/llama-4-scout-17b-16e-instruct}") String model,
            ObjectMapper objectMapper) {
        this.apiKey = apiKey;
        this.defaultModel = model;
        this.objectMapper = objectMapper;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(60_000);

        this.restClient = RestClient.builder()
                .baseUrl(GROQ_BASE_URL)
                .requestFactory(factory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();

        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(java.time.Duration.ofSeconds(10))
                .build();

        log.info("GroqChatClient initialized — model: {}", model);
    }

    // -----------------------------------------------------------------------
    // Blocking chat completion
    // -----------------------------------------------------------------------

    @Override
    public AiChatCompletionResult chatCompletion(List<ChatMessage> messages, String model, double temperature, Integer maxTokens) {
        String effectiveModel = (model == null || model.isBlank()) ? defaultModel : model.trim();
        String requestBody = buildRequestBody(messages, effectiveModel, temperature, maxTokens, false);
        log.debug("Calling Groq API (blocking): model={}", defaultModel);

        boolean acquired = false;
        try {
            acquired = GROQ_SEMAPHORE.tryAcquire(60, TimeUnit.SECONDS);
            if (!acquired) {
                log.warn("[Groq] Semaphore timeout — too many concurrent AI requests");
                throw new AiServiceException("AI service is busy. Please try again shortly.");
            }
            return chatCompletionWithRetry(requestBody, effectiveModel);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new AiServiceException("AI request interrupted.", ie);
        } finally {
            if (acquired) GROQ_SEMAPHORE.release();
        }
    }

    private AiChatCompletionResult chatCompletionWithRetry(String requestBody, String effectiveModel) {
        Exception lastException = null;
        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                String responseBody = restClient.post()
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                        .body(requestBody)
                        .retrieve()
                        .body(String.class);
                return extractResult(responseBody, effectiveModel);
            } catch (RestClientResponseException e) {
                int statusCode = e.getStatusCode().value();
                if (statusCode == 429 || statusCode >= 500) {
                    log.warn("[Groq] {} on attempt {}/{}", statusCode, attempt, MAX_RETRIES);
                    lastException = e;
                    sleepBackoff(attempt);
                } else {
                    log.error("[Groq] API error {}: {}", statusCode, e.getResponseBodyAsString());
                    throw new AiServiceException("Groq API error " + statusCode + ": " + e.getMessage(), e);
                }
            } catch (ResourceAccessException e) {
                log.warn("[Groq] timeout on attempt {}/{}: {}", attempt, MAX_RETRIES, e.getMessage());
                lastException = e;
                sleepBackoff(attempt);
            }
        }
        throw new AiServiceException("Groq AI service is temporarily unavailable.", lastException);
    }

    // -----------------------------------------------------------------------
    // Streaming chat completion (SSE)
    // -----------------------------------------------------------------------

    @Override
    public boolean chatCompletionStream(List<ChatMessage> messages, String model, double temperature,
                                        Integer maxTokens, Consumer<String> onToken,
                                        Consumer<AiChatCompletionResult> onComplete,
                                        AtomicBoolean cancelled) {
        String effectiveModel = (model == null || model.isBlank()) ? defaultModel : model.trim();
        String requestBody = buildRequestBody(messages, effectiveModel, temperature, maxTokens, true);
        log.debug("Calling Groq API (stream): model={}", defaultModel);

        boolean acquired = false;
        try {
            acquired = GROQ_SEMAPHORE.tryAcquire(60, TimeUnit.SECONDS);
            if (!acquired) {
                log.warn("[Groq] Semaphore timeout (stream) — too many concurrent AI requests");
                throw new AiServiceException("AI service is busy. Please try again shortly.");
            }
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new AiServiceException("AI stream request interrupted.", ie);
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(GROQ_BASE_URL))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .header(HttpHeaders.ACCEPT, "text/event-stream")
                .timeout(java.time.Duration.ofSeconds(90))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                .build();

        try {
            HttpResponse<java.io.InputStream> response = httpClient.send(
                    request, HttpResponse.BodyHandlers.ofInputStream());

            if (response.statusCode() != 200) {
                try (java.io.InputStream errBody = response.body()) {
                    String body = new String(errBody.readAllBytes(), StandardCharsets.UTF_8);
                    throw new AiServiceException("Groq stream error " + response.statusCode() + ": " + body);
                }
            }

            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
                if (cancelled != null && cancelled.get()) {
                    return false;
                }
                StringBuilder full = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    if (cancelled != null && cancelled.get()) {
                        log.debug("[Groq-stream] aborted by cancel flag");
                        return false;
                    }
                    if (!line.startsWith("data:")) {
                        continue;
                    }
                    String data = line.substring(5).trim();
                    if ("[DONE]".equals(data)) {
                        break;
                    }
                    try {
                        JsonNode node = objectMapper.readTree(data);
                        String delta = node.path("choices").path(0)
                                .path("delta").path("content").asText(null);
                        if (delta != null && !delta.isEmpty()) {
                            full.append(delta);
                            onToken.accept(delta);
                        }
                    } catch (Exception parseEx) {
                        log.trace("[Groq-stream] skipping unparseable chunk: {}", data);
                    }
                }
                // Groq streaming doesn't provide usage reliably; estimate for ledger.
                TokenUsage usage = estimateUsage(messages, full.toString());
                onComplete.accept(new AiChatCompletionResult(full.toString(), usage, "GROQ", effectiveModel));
            }
            return true;
        } catch (AiServiceException e) {
            throw e;
        } catch (Exception e) {
            throw new AiServiceException("Groq streaming failed: " + e.getMessage(), e);
        } finally {
            GROQ_SEMAPHORE.release();
        }
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private String buildRequestBody(List<ChatMessage> messages, String model,
                                    double temperature, Integer maxTokens, boolean stream) {
        try {
            ObjectNode root = objectMapper.createObjectNode();
            root.put("model", model);
            root.put("temperature", temperature);
            if (maxTokens != null && maxTokens > 0) {
                root.put("max_tokens", maxTokens);
            } else {
                root.put("max_tokens", 600);
            }
            // Force JSON output in both blocking and streaming modes
            ObjectNode responseFormat = root.putObject("response_format");
            responseFormat.put("type", "json_object");
            if (stream) {
                root.put("stream", true);
            }

            ArrayNode messagesArray = root.putArray("messages");
            for (ChatMessage msg : messages) {
                ObjectNode msgNode = messagesArray.addObject();
                msgNode.put("role", msg.role());
                msgNode.put("content", msg.content());
            }

            return objectMapper.writeValueAsString(root);
        } catch (Exception e) {
            throw new AiServiceException("Failed to build Groq request body", e);
        }
    }

    private AiChatCompletionResult extractResult(String responseBody, String effectiveModel) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode usage = root.get("usage");
            TokenUsage parsedUsage = null;
            if (usage != null) {
                log.debug("[Groq] tokens — prompt: {}, completion: {}, total: {}",
                        usage.path("prompt_tokens").asInt(),
                        usage.path("completion_tokens").asInt(),
                        usage.path("total_tokens").asInt());
                parsedUsage = TokenUsage.exact(
                        usage.path("prompt_tokens").asInt(0),
                        usage.path("completion_tokens").asInt(0),
                        usage.path("total_tokens").asInt(0)
                );
            }
            String content = root.path("choices").get(0).path("message").path("content").asText();
            return new AiChatCompletionResult(content, parsedUsage, "GROQ", effectiveModel);
        } catch (Exception e) {
            throw new AiServiceException("Failed to parse Groq response", e);
        }
    }

    private TokenUsage estimateUsage(List<ChatMessage> messages, String completionText) {
        int promptChars = 0;
        if (messages != null) {
            for (ChatMessage m : messages) {
                if (m != null && m.content() != null) promptChars += m.content().length();
            }
        }
        int completionChars = completionText == null ? 0 : completionText.length();
        // Very rough heuristic: ~4 chars/token for Latin text.
        int promptTokens = Math.max(1, (int) Math.ceil(promptChars / 4.0));
        int completionTokens = Math.max(1, (int) Math.ceil(completionChars / 4.0));
        return TokenUsage.estimated(promptTokens, completionTokens, promptTokens + completionTokens);
    }

    private void sleepBackoff(int attempt) {
        long delay = BACKOFF_MILLIS[Math.min(attempt - 1, BACKOFF_MILLIS.length - 1)];
        try {
            Thread.sleep(delay);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }
}
