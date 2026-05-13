package com.deutschflow.ai.rag.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Component
public class EmbeddingClient {

    @Value("${openai.api-key:}")
    private String openAiKey;

    @Value("${openai.whisper-base-url:https://api.openai.com/v1}")
    private String openAiBaseUrl;

    private final RestTemplate restTemplate;

    public EmbeddingClient() {
        this.restTemplate = new RestTemplate();
    }

    public float[] getEmbedding(String text) {
        if (openAiKey == null || openAiKey.isBlank()) {
            throw new IllegalStateException("OpenAI API Key is missing. Cannot generate embeddings.");
        }

        String url = openAiBaseUrl.replaceFirst("/$", "") + "/embeddings";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(openAiKey);

        Map<String, Object> body = new HashMap<>();
        body.put("input", text);
        body.put("model", "text-embedding-3-small");

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        JsonNode response = restTemplate.postForObject(url, request, JsonNode.class);

        if (response != null && response.has("data") && response.get("data").isArray()) {
            JsonNode embeddingNode = response.get("data").get(0).get("embedding");
            float[] result = new float[embeddingNode.size()];
            for (int i = 0; i < embeddingNode.size(); i++) {
                result[i] = (float) embeddingNode.get(i).asDouble();
            }
            return result;
        }

        throw new RuntimeException("Failed to generate embedding from OpenAI");
    }
}
