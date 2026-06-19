package com.deutschflow.speaking.service;

import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.GroqChatClient;
import com.deutschflow.speaking.exception.AiServiceException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class GroqApiService {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(GroqApiService.class);

    public GroqApiService(GroqChatClient groqChatClient) {
        this.groqChatClient = groqChatClient;
    }


    private final GroqChatClient groqChatClient;

    public AiChatCompletionResult generateDialogueResponse(String userMessage, String conversationHistory,
                                                            String topicContext, String learningLevel) {
        try {
            List<ChatMessage> messages = buildMessageHistory(userMessage, conversationHistory, topicContext, learningLevel);
            return groqChatClient.chatCompletion(messages, null, 0.7, 200);
        } catch (Exception e) {
            log.error("Error generating dialogue response from Groq API", e);
            throw new AiServiceException("Failed to generate dialogue response: " + e.getMessage(), e);
        }
    }

    public AiChatCompletionResult evaluateAndFeedback(String userResponse, String expectedResponse,
                                                       String learningLevel, String topicContext) {
        try {
            List<ChatMessage> messages = buildEvaluationMessages(userResponse, expectedResponse, learningLevel, topicContext);
            return groqChatClient.chatCompletion(messages, null, 0.5, 300);
        } catch (Exception e) {
            log.error("Error evaluating user response from Groq API", e);
            throw new AiServiceException("Failed to evaluate response: " + e.getMessage(), e);
        }
    }

    private List<ChatMessage> buildMessageHistory(String userMessage, String conversationHistory,
                                                  String topicContext, String learningLevel) {
        List<ChatMessage> messages = new ArrayList<>();

        String systemPrompt = String.format(
                "You are a friendly German language teacher. " +
                "Respond to the user in German at learning level %s. " +
                "Topic context: %s. " +
                "Keep responses short (1-2 sentences) and encouraging. " +
                "Use simple vocabulary appropriate for %s level.",
                learningLevel, topicContext, learningLevel
        );

        messages.add(new ChatMessage("system", systemPrompt));

        if (conversationHistory != null && !conversationHistory.isBlank()) {
            messages.add(new ChatMessage("assistant", conversationHistory));
        }

        messages.add(new ChatMessage("user", userMessage));
        return messages;
    }

    private List<ChatMessage> buildEvaluationMessages(String userResponse, String expectedResponse,
                                                      String learningLevel, String topicContext) {
        List<ChatMessage> messages = new ArrayList<>();

        String systemPrompt = String.format(
                "You are a German language instructor evaluating student responses. " +
                "Learning level: %s. Topic: %s. " +
                "Evaluate the user's response and provide constructive feedback in German. " +
                "Be encouraging. Point out what was correct and suggest improvements. " +
                "Keep feedback short (2-3 sentences).",
                learningLevel, topicContext
        );

        messages.add(new ChatMessage("system", systemPrompt));

        String evaluationPrompt = String.format(
                "User said: \"%s\"\nExpected/Model answer: \"%s\"\n\nProvide feedback:",
                userResponse, expectedResponse
        );

        messages.add(new ChatMessage("user", evaluationPrompt));
        return messages;
    }
}
