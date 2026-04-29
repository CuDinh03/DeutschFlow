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

import java.util.List;

/**
 * Calls the Groq API using its OpenAI-compatible Chat Completions endpoint.
 *
 * <p>Endpoint: POST https://api.groq.com/openai/v1/chat/completions
 *
 * <p>Default model: {@code meta-llama/llama-4-scout-17b-16e-instruct} (Llama 4 Scout).
 * Free tier: 30 RPM, 6000 RPD — suitable for DeutschFlow Beta.
 *
 * <p>Retry policy: up to 3 attempts with exponential backoff (1s, 2s, 4s).
 *
 * <p>Note: Bean selection is managed by {@link AiChatClientFactory}.
 */
@Component
@Slf4j
public class GroqChatClient implements OpenAiChatClient {

    private static final String GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions";
    private static final int MAX_RETRIES = 3;
    private static final long[] BACKOFF_MILLIS = {1_000L, 2_000L, 4_000L};

    private final RestClient restClient;
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
        factory.setReadTimeout(30_000);

        this.restClient = RestClient.builder()
                .baseUrl(GROQ_BASE_URL)
                .requestFactory(factory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
        log.info("GroqChatClient initialized — model: {}, readTimeout: 30s", model);
    }

    @Override
    public String chatCompletion(List<ChatMessage> messages, String model, double temperature) {
        String resolvedModel = defaultModel; // always use configured Groq model
        String requestBody = buildRequestBody(messages, resolvedModel, temperature);

        log.debug("Calling Groq API: model={}", resolvedModel);

        Exception lastException = null;
        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                String responseBody = restClient.post()
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                        .body(requestBody)
                        .retrieve()
                        .body(String.class);

                return extractContent(responseBody);

            } catch (RestClientResponseException e) {
                int statusCode = e.getStatusCode().value();
                if (statusCode == 429 || statusCode >= 500) {
                    log.warn("[Groq] API returned {} on attempt {}/{}", statusCode, attempt, MAX_RETRIES);
                    lastException = e;
                    sleepBackoff(attempt);
                } else {
                    log.error("[Groq] API error {}: {}", statusCode, e.getResponseBodyAsString());
                    throw new AiServiceException(
                            "Groq API error " + statusCode + ": " + e.getMessage(), e);
                }
            } catch (ResourceAccessException e) {
                log.warn("[Groq] timeout/connection error on attempt {}/{}: {}", attempt, MAX_RETRIES, e.getMessage());
                lastException = e;
                sleepBackoff(attempt);
            }
        }

        throw new AiServiceException(
                "Groq AI service is temporarily unavailable. Please try again.", lastException);
    }

    // --- Private helpers ---

    private String buildRequestBody(List<ChatMessage> messages, String model, double temperature) {
        try {
            ObjectNode root = objectMapper.createObjectNode();
            root.put("model", model);
            root.put("temperature", temperature);

            // Ask Groq to return JSON — works with Llama 4 Scout
            ObjectNode responseFormat = root.putObject("response_format");
            responseFormat.put("type", "json_object");

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

    private String extractContent(String responseBody) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode usage = root.get("usage");
            if (usage != null) {
                log.debug("[Groq] token usage — prompt: {}, completion: {}, total: {}",
                        usage.path("prompt_tokens").asInt(),
                        usage.path("completion_tokens").asInt(),
                        usage.path("total_tokens").asInt());
            }
            return root.path("choices").get(0).path("message").path("content").asText();
        } catch (Exception e) {
            throw new AiServiceException("Failed to parse Groq response", e);
        }
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
