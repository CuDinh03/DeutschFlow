package com.deutschflow.speaking.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.netty.channel.ChannelOption;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Service
@Slf4j
public class GeminiApiClient {

    private final String apiKey;
    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private static final String GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=";

    public GeminiApiClient(
            @Value("${app.ai.gemini.api-key:}") String apiKey, 
            ObjectMapper objectMapper,
            WebClient.Builder webClientBuilder) {
        this.apiKey = apiKey;
        this.objectMapper = objectMapper;
        
        // Cấu hình Timeout nghiêm ngặt (10s Connect, 60s Read)
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 10000)
                .responseTimeout(Duration.ofSeconds(60));
                
        this.webClient = webClientBuilder
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
    }

    /**
     * Gọi Gemini API để sinh nội dung JSON.
     * @param systemPrompt Lời nhắc hệ thống hướng dẫn cấu trúc trả về
     * @param base64Document (Tùy chọn) Nội dung file PDF/Word dạng Base64
     * @param mimeType (Tùy chọn) MimeType của file (ví dụ: application/pdf)
     * @return Chuỗi JSON trả về từ mô hình dưới dạng CompletableFuture
     */
    @Async("aiExecutor")
    public CompletableFuture<String> generateJsonFromDocument(String systemPrompt, String base64Document, String mimeType) {
        if (apiKey == null || apiKey.isEmpty()) {
            return CompletableFuture.failedFuture(new IllegalStateException("GEMINI_API_KEY is not configured."));
        }

        String url = GEMINI_API_URL + apiKey;

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

        Map<String, Object> generationConfig = new HashMap<>();
        generationConfig.put("responseMimeType", "application/json");
        generationConfig.put("temperature", 0.2); // Giảm tính sáng tạo khi xuất JSON
        payload.put("generationConfig", generationConfig);

        log.info("[GeminiApiClient] Sending async request to Gemini 1.5 Flash. Document included: {}", (base64Document != null));

        return webClient.post()
                .uri(url)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(String.class)
                .map(responseStr -> {
                    try {
                        JsonNode root = objectMapper.readTree(responseStr);
                        if (root.has("candidates") && root.get("candidates").isArray() && root.get("candidates").size() > 0) {
                            JsonNode candidate = root.get("candidates").get(0);
                            if (candidate.has("content") && candidate.get("content").has("parts")) {
                                JsonNode responseParts = candidate.get("content").get("parts");
                                if (responseParts.isArray() && responseParts.size() > 0) {
                                    return responseParts.get(0).get("text").asText();
                                }
                            }
                        }
                        log.error("[GeminiApiClient] Unexpected response structure: {}", responseStr);
                        throw new RuntimeException("Unexpected response structure from Gemini API");
                    } catch (JsonProcessingException e) {
                        throw new RuntimeException("Failed to parse Gemini API response", e);
                    }
                })
                .toFuture();
    }
}
