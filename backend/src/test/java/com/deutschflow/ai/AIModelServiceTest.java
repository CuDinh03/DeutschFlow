package com.deutschflow.ai;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Disabled;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for AI Model Service
 * 
 * Note: These tests require the AI server to be running at http://localhost:8000
 * Run: ./scripts/start-ai-server.sh before running these tests
 */
@SpringBootTest
@ActiveProfiles("test")
@Disabled("Requires AI server to be running - enable manually for integration testing")
class AIModelServiceTest {
    
    @Autowired
    private AIModelService aiModelService;
    
    @BeforeEach
    void setUp() {
        // Verify AI server is healthy
        assertTrue(aiModelService.isHealthy(), "AI server must be running for these tests");
    }
    
    @Test
    void testHealthCheck() {
        var health = aiModelService.getHealthStatus();
        assertNotNull(health);
        assertEquals("healthy", health.get("status"));
        assertTrue((Boolean) health.get("model_loaded"));
    }
    
    @Test
    void testTranslateToEnglish() {
        String germanText = "Guten Morgen";
        String translation = aiModelService.translateToEnglish(germanText);
        
        assertNotNull(translation);
        assertFalse(translation.isEmpty());
        assertTrue(translation.toLowerCase().contains("good") || 
                   translation.toLowerCase().contains("morning"));
    }
    
    @Test
    void testTranslateToGerman() {
        String englishText = "Good morning";
        String translation = aiModelService.translateToGerman(englishText);
        
        assertNotNull(translation);
        assertFalse(translation.isEmpty());
        assertTrue(translation.toLowerCase().contains("guten") || 
                   translation.toLowerCase().contains("morgen"));
    }
    
    @Test
    void testCorrectGrammar() {
        String incorrectText = "Ich bin gehen zur Schule";
        String corrected = aiModelService.correctGrammar(incorrectText);
        
        assertNotNull(corrected);
        assertFalse(corrected.isEmpty());
        // Should correct "bin gehen" to "gehe"
        assertTrue(corrected.contains("gehe") || corrected.contains("Ich gehe"));
    }
    
    @Test
    void testExplainGrammar() {
        String germanText = "Ich gehe zur Schule";
        String explanation = aiModelService.explainGrammar(germanText);
        
        assertNotNull(explanation);
        assertFalse(explanation.isEmpty());
        assertTrue(explanation.length() > 50); // Should be a detailed explanation
    }
    
    @Test
    void testGenerateConversationResponse() {
        String userMessage = "Hallo! Wie geht es dir?";
        String context = "greeting";
        String response = aiModelService.generateConversationResponse(userMessage, context);
        
        assertNotNull(response);
        assertFalse(response.isEmpty());
        // Response should be in German
        assertTrue(response.length() > 10);
    }
    
    @Test
    void testCustomGeneration() {
        String instruction = "Explain the meaning of this German word in English";
        String input = "Schadenfreude";
        String response = aiModelService.generate(instruction, input, 256, 0.7);
        
        assertNotNull(response);
        assertFalse(response.isEmpty());
        assertTrue(response.toLowerCase().contains("pleasure") || 
                   response.toLowerCase().contains("misfortune"));
    }
    
    @Test
    void testGenerationWithDifferentTemperatures() {
        String instruction = "Translate to English";
        String input = "Danke schön";
        
        // Low temperature (more deterministic)
        String response1 = aiModelService.generate(instruction, input, 128, 0.3);
        String response2 = aiModelService.generate(instruction, input, 128, 0.3);
        
        assertNotNull(response1);
        assertNotNull(response2);
        // With low temperature, responses should be similar
        
        // High temperature (more creative)
        String response3 = aiModelService.generate(instruction, input, 128, 0.9);
        assertNotNull(response3);
    }
    
    @Test
    void testLongTextTranslation() {
        String longText = "Ich lerne seit drei Monaten Deutsch. " +
                         "Es ist eine schwierige Sprache, aber ich mache Fortschritte. " +
                         "Jeden Tag übe ich Vokabeln und Grammatik.";
        
        String translation = aiModelService.translateToEnglish(longText);
        
        assertNotNull(translation);
        assertFalse(translation.isEmpty());
        assertTrue(translation.length() > 50);
    }
    
    @Test
    void testEmptyInputHandling() {
        assertThrows(RuntimeException.class, () -> {
            aiModelService.translateToEnglish("");
        });
    }
}
