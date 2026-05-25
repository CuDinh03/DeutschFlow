package com.deutschflow.speaking.controller;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SpeakingAiHelperRequestsValidationTest {

    private static Validator validator;

    @BeforeAll
    static void setupValidator() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void conversationRequestRejectsBlankMessage() {
        var violations = validator.validate(new SpeakingAiHelperRequests.ConversationRequest("   ", null, null));
        assertThat(violations).isNotEmpty();
        assertThat(violations.iterator().next().getMessage()).isNotBlank();
    }

    @Test
    void scenarioRequestRejectsBlankTopic() {
        var violations = validator.validate(new SpeakingAiHelperRequests.ScenarioRequest("", null));
        assertThat(violations).isNotEmpty();
    }

    @Test
    void culturalContextRequestRejectsBlankTopic() {
        var violations = validator.validate(new SpeakingAiHelperRequests.CulturalContextRequest(" "));
        assertThat(violations).isNotEmpty();
    }
}
