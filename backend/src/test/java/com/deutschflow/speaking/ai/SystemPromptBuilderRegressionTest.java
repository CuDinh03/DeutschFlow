package com.deutschflow.speaking.ai;

import com.deutschflow.interview.prompt.InterviewPromptBuilder;
import com.deutschflow.speaking.contract.SpeakingResponseSchema;
import com.deutschflow.speaking.contract.SpeakingSessionMode;
import com.deutschflow.speaking.dto.SpeakingPromptRequest;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;

class SystemPromptBuilderRegressionTest {

    @Mock
    private SystemConfigService systemConfigService;

    @Mock
    private InterviewPromptBuilder interviewPromptBuilder;

    private SystemPromptBuilder builder;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        lenient().when(systemConfigService.getString(anyString(), anyString()))
                .thenAnswer(inv -> inv.getArgument(1));
        lenient().when(interviewPromptBuilder.build(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn("TURN_DIRECTIVE: TEST\nCHALLENGE-PFLICHT: ja\nSUGGESTIONS: keine\nPflichtfrage: ...\n"
                        + "tiếng VIỆT\nai_speech_de\n");
        builder = new SystemPromptBuilder(systemConfigService, new PersonaInterviewRegistry(), interviewPromptBuilder);
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
        String prompt = builder.buildSystemPrompt(SpeakingPromptRequest.builder()
                .profile(profile()).knownInterests(List.of("coding", "debugging"))
                .topic("DevOps").sessionCefrLevel("B1").persona(SpeakingPersona.LUKAS)
                .build());

        assertThat(prompt).contains("Target_Topic: DevOps");
        assertThat(prompt).contains("PERSONA (Lukas");
        assertThat(prompt).contains("AI TASKS & LOGIC");
    }

    @Test
    void interviewPrompt_includesTurnDirectiveAndClosingRules() {
        String prompt = builder.buildSystemPrompt(SpeakingPromptRequest.builder()
                .profile(profile()).knownInterests(List.of("architecture"))
                .topic("Interview").sessionCefrLevel("B2")
                .persona(SpeakingPersona.LUKAS).responseSchema(SpeakingResponseSchema.V1)
                .sessionMode(SpeakingSessionMode.INTERVIEW)
                .interviewPosition("Senior Backend Developer").experienceLevel("5Y").turnCount(3)
                .build());

        assertThat(prompt).contains("TURN_DIRECTIVE");
        assertThat(prompt).contains("CHALLENGE-PFLICHT");
        assertThat(prompt).contains("SUGGESTIONS");
        assertThat(prompt).contains("Pflichtfrage");
    }

    @Test
    void interviewPromptForVietnamesePersona_keepsVietnameseInterviewInstructions() {
        String prompt = builder.buildSystemPrompt(SpeakingPromptRequest.builder()
                .profile(profile()).knownInterests(List.of("architecture"))
                .topic("Interview").sessionCefrLevel("B2")
                .persona(SpeakingPersona.TUAN).responseSchema(SpeakingResponseSchema.V1)
                .sessionMode(SpeakingSessionMode.INTERVIEW)
                .interviewPosition("Kỹ sư backend").experienceLevel("5Y").turnCount(3)
                .build());

        assertThat(prompt).contains("TURN_DIRECTIVE");
        assertThat(prompt).contains("tiếng VIỆT");
        assertThat(prompt).contains("ai_speech_de");
    }

    @Test
    void lessonPromptForVietnamesePersona_keepsVietnameseInstructions() {
        String prompt = builder.buildSystemPrompt(SpeakingPromptRequest.builder()
                .profile(profile()).topic("Alphabet").sessionCefrLevel("A1")
                .persona(SpeakingPersona.TUAN)
                .build());

        assertThat(prompt).contains("CHẾ ĐỘ GIAO TIẾP");
        assertThat(prompt).contains("tiếng VIỆT");
        assertThat(prompt).contains("Priorität: Target_Topic");
    }
}
