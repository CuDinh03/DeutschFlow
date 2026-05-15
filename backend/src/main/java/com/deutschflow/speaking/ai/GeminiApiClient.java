package com.deutschflow.speaking.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class GeminiApiClient {

    private final String apiKey;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private static final String GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=";

    public GeminiApiClient(@Value("${app.ai.gemini.api-key:}") String apiKey, ObjectMapper objectMapper) {
        this.apiKey = apiKey;
        this.objectMapper = objectMapper;
        
        // Cấu hình Timeout nghiêm ngặt (10s Connect, 60s Read)
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10000);
        factory.setReadTimeout(60000);
        this.restTemplate = new RestTemplate(factory);
    }

    /**
     * Gọi Gemini API để sinh nội dung JSON.
     * @param systemPrompt Lời nhắc hệ thống hướng dẫn cấu trúc trả về
     * @param base64Document (Tùy chọn) Nội dung file PDF/Word dạng Base64
     * @param mimeType (Tùy chọn) MimeType của file (ví dụ: application/pdf)
     * @return Chuỗi JSON trả về từ mô hình
     */
    public String generateJsonFromDocument(String systemPrompt, String base64Document, String mimeType) throws JsonProcessingException {
        if (apiKey == null || apiKey.isEmpty()) {
            throw new IllegalStateException("GEMINI_API_KEY is not configured.");
        }

        String url = GEMINI_API_URL + apiKey;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        // Xây dựng Payload
        Map<String, Object> payload = new HashMap<>();
        List<Map<String, Object>> contents = new ArrayList<>();
        Map<String, Object> contentMap = new HashMap<>();
        List<Map<String, Object>> parts = new ArrayList<>();

        // Part 1: Text prompt
        Map<String, Object> textPart = new HashMap<>();
        textPart.put("text", systemPrompt);
        parts.add(textPart);

        // Part 2: Document (if provided)
        if (base64Document != null && mimeType != null) {
            Map<String, Object> inlineData = new HashMap<>();
            inlineData.put("mimeType", mimeType);
            inlineData.put("data", base64Document);

            Map<String, Object> inlineDataPart = new HashMap<>();
            inlineDataPart.put("inlineData", inlineData);
            parts.add(inlineDataPart);
        }

        contentMap.put("parts", parts);
        contents.add(contentMap);
        payload.put("contents", contents);

        // Ép cấu trúc trả về là JSON để chống Hallucination
        Map<String, Object> generationConfig = new HashMap<>();
        generationConfig.put("responseMimeType", "application/json");
        generationConfig.put("temperature", 0.2); // Giảm tính sáng tạo khi xuất JSON
        payload.put("generationConfig", generationConfig);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);

        try {
            log.info("[GeminiApiClient] Sending request to Gemini 1.5 Flash. Document included: {}", (base64Document != null));
            String responseStr = restTemplate.postForObject(url, request, String.class);
            
            // Parse response
            JsonNode root = objectMapper.readTree(responseStr);
            if (root.has("candidates") && root.get("candidates").isArray() && root.get("candidates").size() > 0) {
                JsonNode candidate = root.get("candidates").get(0);
                if (candidate.has("content") && candidate.get("content").has("parts")) {
                    return candidate.get("content").get("parts").get(0).get("text").asText();
                }
            }
            throw new RuntimeException("Unexpected response structure from Gemini API.");
        } catch (Exception e) {
            log.error("[GeminiApiClient] Error calling Gemini API: {}", e.getMessage(), e);
            throw e;
        }
    }
}
