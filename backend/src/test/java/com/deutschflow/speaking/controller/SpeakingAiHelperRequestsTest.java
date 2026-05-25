package com.deutschflow.speaking.controller;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SpeakingAiHelperRequestsTest {

    @Test
    void conversationRequestNormalizesContextAndLevel() {
        var request = new SpeakingAiHelperRequests.ConversationRequest("Hallo", "  Alltag  ", " b1 ");

        assertEquals("Alltag", request.normalizedContext());
        assertEquals("b1", request.normalizedLevel());
    }

    @Test
    void feedbackRequestNormalizesTopic() {
        var request = new SpeakingAiHelperRequests.FeedbackRequest("Text", "  Arbeit  ");

        assertEquals("Arbeit", request.normalizedTopic());
    }

    @Test
    void scenarioRequestDefaultsLevelWhenBlank() {
        var request = new SpeakingAiHelperRequests.ScenarioRequest("Einkaufen", "   ");

        assertEquals("A2", request.normalizedLevel());
    }

    @Test
    void errorPracticeRequestDefaultsExerciseCountWhenNull() {
        var request = new SpeakingAiHelperRequests.ErrorPracticeRequest("word order", null);

        assertEquals(3, request.normalizedExerciseCount());
    }

    @Test
    void rolePlayRequestDefaultsRolesWhenBlank() {
        var request = new SpeakingAiHelperRequests.RolePlayRequest("Im Café", "", null);

        assertEquals("customer", request.normalizedUserRole());
        assertEquals("shopkeeper", request.normalizedAiRole());
    }
}
