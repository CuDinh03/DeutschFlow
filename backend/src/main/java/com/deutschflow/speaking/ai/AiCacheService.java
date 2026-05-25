package com.deutschflow.speaking.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiCacheService {

    private final OpenAiChatClient openAiChatClient;

    /**
     * Cache the response from AI for identical inputs to save costs and reduce latency.
     * The key is a SHA-256 hash of the messages to avoid too long Redis keys.
     */
    @Cacheable(value = "aiResponses", key = "#root.target.generateKey(#messages, #model, #temperature)")
    public AiChatCompletionResult getCachedChatCompletion(List<ChatMessage> messages, String model, double temperature, Integer maxTokens) {
        log.info("Cache miss for AI prompt. Calling external AI API...");
        return openAiChatClient.chatCompletion(messages, model, temperature, maxTokens);
    }

    /**
     * Helper to generate a unique SHA-256 hash key for caching.
     */
    public String generateKey(List<ChatMessage> messages, String model, double temperature) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            StringBuilder sb = new StringBuilder();
            sb.append(model).append("-").append(temperature).append("-");
            for (ChatMessage msg : messages) {
                sb.append(msg.role()).append(":").append(msg.content()).append("|");
            }
            byte[] hash = digest.digest(sb.toString().getBytes());
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not found", e);
        }
    }
}
