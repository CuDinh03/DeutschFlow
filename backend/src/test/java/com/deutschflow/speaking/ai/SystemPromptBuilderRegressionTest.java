package com.deutschflow.speaking.ai;

import com.deutschflow.speaking.contract.SpeakingResponseSchema;
import com.deutschflow.speaking.contract.SpeakingSessionMode;
import com.deutschflow.speaking.interview.PersonaInterviewRegistry;
import com.deutschflow.speaking.persona.SpeakingPersona;
import com.deutschflow.system.service.SystemConfigService;
import com.deutschflow.user.entity.UserLearningProfile;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;

class SystemPromptBuilderRegressionTest {

    @Mock
    private SystemConfigService systemConfigService;

    private SystemPromptBuilder builder;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        lenient().when(systemConfigService.getString(anyString(), anyString()))
                .thenAnswer(inv -> inv.getArgument(1));
        builder = new SystemPromptBuilder(systemConfigService, new PersonaInterviewRegistry());
    }

    private static UserLearningProfile profile() {
        return UserLearningProfile.builder()
                .targetLevel(UserLearningProfile.TargetLevel.B1)
                .goalType(UserLearningProfile.GoalType.CERT)
                .currentLevel(UserLearningProfile.CurrentLevel.B1)
                .industry("IT")
                .build();
    }

    @Test
    void communicationPrompt_includesTopicAndPersonaAnchors() {
        String prompt = builder.buildSystemPrompt(
                profile(), List.of("coding", "debugging"), "DevOps", List.of(), "B1", SpeakingPersona.LUKAS);

        assertThat(prompt).contains("Target_Topic: DevOps");
        assertThat(prompt).contains("PERSONA (Lukas");
        assertThat(prompt).contains("AI TASKS & LOGIC");
    }

    @Test
    void interviewPrompt_includesTurnDirectiveAndClosingRules() {
        String prompt = builder.buildSystemPrompt(
                profile(), List.of("architecture"), "Interview", List.of(), "B2",
                null, SpeakingPersona.LUKAS, SpeakingResponseSchema.V1, SpeakingSessionMode.INTERVIEW,
                "Senior Backend Developer", "5Y", 3);

        assertThat(prompt).contains("TURN_DIRECTIVE");
        assertThat(prompt).contains("CHALLENGE-PFLICHT");
        assertThat(prompt).contains("SUGGESTIONS");
        assertThat(prompt).contains("Pflichtfrage");
    }

    @Test
    void interviewPromptForVietnamesePersona_keepsVietnameseInterviewInstructions() {
        String prompt = builder.buildSystemPrompt(
                profile(), List.of("architecture"), "Interview", List.of(), "B2",
                null, SpeakingPersona.TUAN, SpeakingResponseSchema.V1, SpeakingSessionMode.INTERVIEW,
                "Kỹ sư backend", "5Y", 3);

        assertThat(prompt).contains("TURN_DIRECTIVE");
        assertThat(prompt).contains("tiếng VIỆT");
        assertThat(prompt).contains("ai_speech_de");
    }

    @Test
    void lessonPromptForVietnamesePersona_keepsVietnameseInstructions() {
        String prompt = builder.buildSystemPrompt(
                profile(), List.of(), "Alphabet", List.of(), "A1", SpeakingPersona.TUAN);

        assertThat(prompt).contains("CHẾ ĐỘ GIAO TIẾP");
        assertThat(prompt).contains("tiếng VIỆT");
        assertThat(prompt).contains("Priorität: Target_Topic");
    }
}
