package com.deutschflow.speaking.service;

import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Lightweight AI helpers mounted at {@code /api/speaking/ai/*} that proxy to {@link OpenAiChatClient}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SpeakingAiHelpersService {

    private final OpenAiChatClient openAiChatClient;

    private String generate(String instruction, String input, int maxTokens, double temperature) {
        List<ChatMessage> msgs = List.of(
                new ChatMessage("system", instruction),
                new ChatMessage("user", input != null ? input : "")
        );
        return openAiChatClient.chatCompletion(msgs, null, temperature, maxTokens).content();
    }

    public String generateConversationResponse(String userMessage, String context, String level) {
        log.info("Generating conversation response for level: {}", level);
        try {
            String instruction = buildConversationInstruction(context, level);
            return generate(instruction, userMessage, 256, 0.8);
        } catch (Exception e) {
            log.error("Error generating conversation response", e);
            throw new RuntimeException("Conversation generation failed: " + e.getMessage(), e);
        }
    }

    public SpeakingFeedback provideFeedback(String userText, String expectedTopic) {
        log.info("Providing feedback for topic: {}", expectedTopic);
        try {
            String correctGrammarInstruction = "Please correct the grammar of the following German text. Only output the corrected text without any explanations.";
            String corrected = generate(correctGrammarInstruction, userText, 256, 0.3).trim();

            String pronunciationInstruction = String.format(
                    "Analyze potential pronunciation issues in this German text: '%s'. "
                            + "List common pronunciation mistakes English speakers might make with these words.",
                    userText
            );
            String pronunciationTips = generate(pronunciationInstruction, "", 256, 0.7);

            String improvementInstruction = String.format(
                    "Suggest 3 ways to improve this German sentence: '%s'. "
                            + "Focus on making it more natural and fluent.",
                    userText
            );
            String improvements = generate(improvementInstruction, "", 512, 0.7);

            int fluencyScore = calculateFluencyScore(userText, corrected);

            return SpeakingFeedback.builder()
                    .originalText(userText)
                    .correctedText(corrected)
                    .pronunciationTips(pronunciationTips)
                    .improvements(improvements)
                    .fluencyScore(fluencyScore)
                    .hasErrors(!userText.trim().equals(corrected.trim()))
                    .build();

        } catch (Exception e) {
            log.error("Error providing feedback", e);
            throw new RuntimeException("Feedback generation failed: " + e.getMessage(), e);
        }
    }

    public PracticeScenario generateScenario(String topic, String level) {
        log.info("Generating scenario for topic: {}, level: {}", topic, level);
        try {
            String instruction = String.format(
                    "Create a German conversation practice scenario about '%s' for %s level learners. "
                            + "Include: 1) Situation description, 2) Your role, 3) 3 starter questions, 4) Key vocabulary",
                    topic, level
            );
            String scenarioText = generate(instruction, "", 512, 0.8);

            String followUpInstruction = String.format(
                    "Generate 5 follow-up questions in German for a conversation about '%s' at %s level.",
                    topic, level
            );
            String followUpQuestions = generate(followUpInstruction, "", 256, 0.7);

            return PracticeScenario.builder()
                    .topic(topic)
                    .level(level)
                    .scenarioDescription(scenarioText)
                    .followUpQuestions(followUpQuestions)
                    .build();

        } catch (Exception e) {
            log.error("Error generating scenario", e);
            throw new RuntimeException("Scenario generation failed: " + e.getMessage(), e);
        }
    }

    public String generateErrorPractice(String errorType, int exerciseCount) {
        log.info("Generating {} practice exercises for error: {}", exerciseCount, errorType);
        try {
            String instruction = String.format(
                    "Create %d practice exercises in German to help fix this grammar error: '%s'. "
                            + "For each exercise: 1) Show an incorrect sentence, 2) Ask user to correct it, 3) Provide the correct answer. "
                            + "Number each exercise.",
                    exerciseCount, errorType
            );
            return generate(instruction, "", 512, 0.7);
        } catch (Exception e) {
            log.error("Error generating error practice", e);
            throw new RuntimeException("Error practice generation failed: " + e.getMessage(), e);
        }
    }

    public String provideCulturalContext(String topic) {
        log.info("Providing cultural context for: {}", topic);
        try {
            String instruction = String.format(
                    "Explain important cultural context and etiquette for German conversations about '%s'. "
                            + "Include dos and don'ts, common phrases, and cultural nuances.",
                    topic
            );
            return generate(instruction, "", 512, 0.7);
        } catch (Exception e) {
            log.error("Error providing cultural context", e);
            throw new RuntimeException("Cultural context generation failed: " + e.getMessage(), e);
        }
    }

    public String generateRolePlay(String situation, String userRole, String aiRole) {
        log.info("Generating role-play: {} as {}", situation, userRole);
        try {
            String instruction = String.format(
                    "Create a German role-play scenario: Situation: '%s'. "
                            + "User plays: %s. AI plays: %s. "
                            + "Provide the opening line and 3 possible user responses.",
                    situation, userRole, aiRole
            );
            return generate(instruction, "", 512, 0.8);
        } catch (Exception e) {
            log.error("Error generating role-play", e);
            throw new RuntimeException("Role-play generation failed: " + e.getMessage(), e);
        }
    }

    private String buildConversationInstruction(String context, String level) {
        StringBuilder instruction = new StringBuilder();
        instruction.append("You are a German language tutor having a conversation with a student. ");

        switch (level.toUpperCase()) {
            case "A1":
                instruction.append("Use very simple German (A1 level). Use present tense and basic vocabulary. ");
                break;
            case "A2":
                instruction.append("Use simple German (A2 level). Use present and past tense. ");
                break;
            case "B1":
                instruction.append(
                        "Use intermediate German (B1 level). Use various tenses and more complex sentences. ");
                break;
            case "B2":
                instruction.append(
                        "Use upper-intermediate German (B2 level). Use complex grammar and idiomatic expressions. ");
                break;
            default:
                instruction.append("Use appropriate German for the student's level. ");
        }

        if (context != null && !context.isEmpty()) {
            instruction.append(String.format("Context: %s. ", context));
        }

        instruction.append("Respond naturally and encourage the student. Keep responses to 2-3 sentences.");

        return instruction.toString();
    }

    private int calculateFluencyScore(String original, String corrected) {
        if (original == null || corrected == null) return 0;
        if (original.trim().equals(corrected.trim())) {
            return 100;
        }

        int differences = countDifferences(original, corrected);
        int wordCount = original.split("\\s+").length;

        if (wordCount == 0) return 0;
        double errorRate = (double) differences / wordCount;
        int score = (int) Math.max(0, 100 - (errorRate * 100));

        return Math.min(100, Math.max(0, score));
    }

    private int countDifferences(String text1, String text2) {
        String[] words1 = text1.split("\\s+");
        String[] words2 = text2.split("\\s+");

        int differences = Math.abs(words1.length - words2.length);
        int minLength = Math.min(words1.length, words2.length);

        for (int i = 0; i < minLength; i++) {
            if (!words1[i].equals(words2[i])) {
                differences++;
            }
        }
        return differences;
    }

    @lombok.Data
    @lombok.Builder
    public static class SpeakingFeedback {
        private String originalText;
        private String correctedText;
        private String pronunciationTips;
        private String improvements;
        private int fluencyScore;
        private boolean hasErrors;
    }

    @lombok.Data
    @lombok.Builder
    public static class PracticeScenario {
        private String topic;
        private String level;
        private String scenarioDescription;
        private String followUpQuestions;
    }
}
