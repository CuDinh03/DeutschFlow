package com.deutschflow.ai;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;
import lombok.extern.slf4j.Slf4j;

import java.util.Map;

@Slf4j
@Service
public class AIModelService {
    
    private final RestTemplate restTemplate;
    private final String aiServerUrl;
    
    public AIModelService(@Value("${app.ai.server-url:http://localhost:8000}") String aiServerUrl) {
        this.restTemplate = new RestTemplate();
        this.aiServerUrl = aiServerUrl;
        log.info("AI Model Service initialized with URL: {}", aiServerUrl);
    }
    
    /**
     * Generate response từ AI model
     */
    public String generate(String instruction, String input) {
        return generate(instruction, input, 256, 0.7);
    }
    
    /**
     * Generate với custom parameters
     */
    public String generate(String instruction, String input, int maxTokens, double temperature) {
        try {
            String url = aiServerUrl + "/generate";
            
            // Request body
            Map<String, Object> requestBody = Map.of(
                "instruction", instruction,
                "input", input,
                "max_tokens", maxTokens,
                "temperature", temperature
            );
            
            // Headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
            
            // Call API
            ResponseEntity<AIResponse> response = restTemplate.postForEntity(
                url,
                entity,
                AIResponse.class
            );
            
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                log.info("AI generated response: {} tokens", response.getBody().getTokensUsed());
                return response.getBody().getResponse();
            }
            
            throw new RuntimeException("AI server returned error");
            
        } catch (Exception e) {
            log.error("Error calling AI server", e);
            throw new RuntimeException("Failed to generate AI response: " + e.getMessage(), e);
        }
    }
    
    /**
     * Translate German to English
     */
    public String translateToEnglish(String germanText) {
        try {
            String url = aiServerUrl + "/translate/to-english?text=" + 
                        java.net.URLEncoder.encode(germanText, "UTF-8");
            
            ResponseEntity<AIResponse> response = restTemplate.postForEntity(
                url,
                null,
                AIResponse.class
            );
            
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return response.getBody().getResponse();
            }
            
            throw new RuntimeException("Translation failed");
            
        } catch (Exception e) {
            log.error("Error translating to English", e);
            throw new RuntimeException("Translation failed: " + e.getMessage(), e);
        }
    }
    
    /**
     * Translate English to German
     */
    public String translateToGerman(String englishText) {
        try {
            String url = aiServerUrl + "/translate/to-german?text=" + 
                        java.net.URLEncoder.encode(englishText, "UTF-8");
            
            ResponseEntity<AIResponse> response = restTemplate.postForEntity(
                url,
                null,
                AIResponse.class
            );
            
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return response.getBody().getResponse();
            }
            
            throw new RuntimeException("Translation failed");
            
        } catch (Exception e) {
            log.error("Error translating to German", e);
            throw new RuntimeException("Translation failed: " + e.getMessage(), e);
        }
    }
    
    /**
     * Correct German grammar
     */
    public String correctGrammar(String germanText) {
        try {
            String url = aiServerUrl + "/grammar/correct?text=" + 
                        java.net.URLEncoder.encode(germanText, "UTF-8");
            
            ResponseEntity<AIResponse> response = restTemplate.postForEntity(
                url,
                null,
                AIResponse.class
            );
            
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return response.getBody().getResponse();
            }
            
            throw new RuntimeException("Grammar correction failed");
            
        } catch (Exception e) {
            log.error("Error correcting grammar", e);
            throw new RuntimeException("Grammar correction failed: " + e.getMessage(), e);
        }
    }
    
    /**
     * Explain German grammar
     */
    public String explainGrammar(String germanText) {
        try {
            String url = aiServerUrl + "/grammar/explain?text=" + 
                        java.net.URLEncoder.encode(germanText, "UTF-8");
            
            ResponseEntity<AIResponse> response = restTemplate.postForEntity(
                url,
                null,
                AIResponse.class
            );
            
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return response.getBody().getResponse();
            }
            
            throw new RuntimeException("Grammar explanation failed");
            
        } catch (Exception e) {
            log.error("Error explaining grammar", e);
            throw new RuntimeException("Grammar explanation failed: " + e.getMessage(), e);
        }
    }
    
    /**
     * Generate conversation response
     */
    public String generateConversationResponse(String userMessage, String context) {
        try {
            String url = aiServerUrl + "/conversation/respond?user_message=" + 
                        java.net.URLEncoder.encode(userMessage, "UTF-8");
            
            if (context != null && !context.isEmpty()) {
                url += "&context=" + java.net.URLEncoder.encode(context, "UTF-8");
            }
            
            ResponseEntity<AIResponse> response = restTemplate.postForEntity(
                url,
                null,
                AIResponse.class
            );
            
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return response.getBody().getResponse();
            }
            
            throw new RuntimeException("Conversation generation failed");
            
        } catch (Exception e) {
            log.error("Error generating conversation response", e);
            throw new RuntimeException("Conversation generation failed: " + e.getMessage(), e);
        }
    }
    
    /**
     * Health check
     */
    public boolean isHealthy() {
        try {
            String url = aiServerUrl + "/health";
            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);
            return response.getStatusCode() == HttpStatus.OK;
        } catch (Exception e) {
            log.error("AI server health check failed", e);
            return false;
        }
    }
    
    /**
     * Get health status
     */
    public Map<String, Object> getHealthStatus() {
        try {
            String url = aiServerUrl + "/health";
            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);
            return response.getBody();
        } catch (Exception e) {
            log.error("AI server health check failed", e);
            return Map.of(
                "status", "unhealthy",
                "error", e.getMessage()
            );
        }
    }
}
