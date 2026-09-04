package com.deutschflow.speaking.ai;

import com.deutschflow.interview.prompt.InterviewPromptBuilder;
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
import com.deutschflow.speaking.contract.SpeakingResponseSchema;
import com.deutschflow.speaking.contract.SpeakingSessionMode;
import com.deutschflow.speaking.dto.SpeakingPromptRequest;

class SystemPromptBuilderPersonaTest {

    @Mock
    private SystemConfigService systemConfigService;

    @Mock
    private InterviewPromptBuilder interviewPromptBuilder;

    private SystemPromptBuilder builder;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        // Return default base prompt for any getString() call
        lenient().when(systemConfigService.getString(anyString(), anyString()))
                .thenAnswer(inv -> inv.getArgument(1));
        lenient().when(interviewPromptBuilder.build(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn("TURN_DIRECTIVE: TEST\nVerbotene Phrasen: keine\nPflichtfrage: Wie heißen Sie?\n");
        builder = new SystemPromptBuilder(systemConfigService, new PersonaInterviewRegistry(), interviewPromptBuilder);
    }

    private static UserLearningProfile minimalProfile() {
        return UserLearningProfile.builder()
                .targetLevel(UserLearningProfile.TargetLevel.A1)
                .goalType(UserLearningProfile.GoalType.CERT)
                .currentLevel(UserLearningProfile.CurrentLevel.A1)
                .build();
    }

    private static SpeakingPromptRequest.SpeakingPromptRequestBuilder request(String topic, String level, SpeakingPersona persona) {
        return SpeakingPromptRequest.builder()
                .profile(minimalProfile()).topic(topic).sessionCefrLevel(level).persona(persona);
    }

    @Test
    void lukasPrompt_containsAnchors() {
        String p = builder.buildSystemPrompt(request("Beruf", "B1", SpeakingPersona.LUKAS).build());
        assertThat(p).contains("PERSONA (Lukas");
        assertThat(p).contains("Berlin");
        assertThat(p).contains("Priorität: Target_Topic");
    }

    @Test
    void emmaPrompt_containsAnchors() {
        String p = builder.buildSystemPrompt(request("Alltag", "A2", SpeakingPersona.EMMA).build());
        assertThat(p).contains("PERSONA (Emma");
        assertThat(p).contains("Flohmarkt");
    }

    @Test
    void klausPrompt_containsAnchors() {
        String p = builder.buildSystemPrompt(request("Familie", "B2", SpeakingPersona.KLAUS).build());
        assertThat(p).contains("PERSONA (Klaus");
        assertThat(p).contains("Küchenchef");
    }

    @Test
    void defaultPrompt_hasNoPersonaBlock() {
        String p = builder.buildSystemPrompt(request("Thema", "A1", SpeakingPersona.DEFAULT).build());
        assertThat(p).doesNotContain("PERSONA (Lukas");
        assertThat(p).contains("AI TASKS & LOGIC");
    }

    private static UserLearningProfile technicianProfile() {
        return UserLearningProfile.builder()
                .targetLevel(UserLearningProfile.TargetLevel.B1)
                .goalType(UserLearningProfile.GoalType.CERT)
                .currentLevel(UserLearningProfile.CurrentLevel.A2)
                .industry("Kỹ thuật viên điện tử")
                .build();
    }

    @Test
    void communicationPrompt_identityBlockPinsPersonaJob() {
        String p = builder.buildSystemPrompt(SpeakingPromptRequest.builder()
                .profile(technicianProfile()).topic("Täglicher Alltag")
                .sessionCefrLevel("A2").persona(SpeakingPersona.NIKLAS).build());
        assertThat(p).contains("DEINE IDENTITÄT");
        assertThat(p).contains("Du bist Niklas, Kellner");
        assertThat(p).contains("NIEMALS dein eigener");
        // Danh tính phải đứng TRƯỚC khối PERSONA chi tiết (primacy)
        assertThat(p.indexOf("DEINE IDENTITÄT")).isLessThan(p.indexOf("PERSONA ("));
        // Chủ đề nhìn qua lăng kính persona
        assertThat(p).contains("aus DEINER Perspektive");
    }

    @Test
    void communicationPrompt_defaultTutorNeverInventsJob() {
        String p = builder.buildSystemPrompt(SpeakingPromptRequest.builder()
                .profile(technicianProfile()).topic("Thema")
                .sessionCefrLevel("A1").persona(SpeakingPersona.DEFAULT).build());
        assertThat(p).contains("DEINE IDENTITÄT");
        assertThat(p).contains("Sprachtutor");
        assertThat(p).contains("NIEMALS dein eigener");
    }

    @Test
    void communicationPrompt_answersDirectQuestionsFirst() {
        String p = builder.buildSystemPrompt(request("Alltag", "A2", SpeakingPersona.NIKLAS).build());
        assertThat(p).contains("DIREKTE FRAGEN");
    }

    @Test
    void priorityLine_keepsTopicPriorityButNotIdentityDemotion() {
        String p = builder.buildSystemPrompt(request("Alltag", "A2", SpeakingPersona.NIKLAS).build());
        assertThat(p).contains("Priorität: Target_Topic");
        assertThat(p).doesNotContain("nur Register/Stimmung");
        assertThat(p).contains("IDENTITÄT");
    }

    @Test
    void interviewPrompt_hasNoCommunicationIdentityBlock() {
        String p = builder.buildSystemPrompt(SpeakingPromptRequest.builder()
                .profile(technicianProfile()).topic("Beruf").sessionCefrLevel("B1")
                .persona(SpeakingPersona.NIKLAS)
                .sessionMode(SpeakingSessionMode.INTERVIEW)
                .interviewPosition("Kellner").experienceLevel("3Y").build());
        // INTERVIEW đã có "== ROLE ==" riêng — không chèn thêm khối DEINE IDENTITÄT
        assertThat(p).doesNotContain("DEINE IDENTITÄT");
    }

    @Test
    void communicationRole_coversAllGermanPersonas() {
        for (SpeakingPersona p : SpeakingPersona.values()) {
            switch (p) {
                case DEFAULT, TUAN, LAN, MINH -> assertThat(p.communicationRole()).isNull();
                default -> assertThat(p.communicationRole()).as(p.name()).isNotBlank();
            }
        }
        assertThat(SpeakingPersona.NIKLAS.communicationRole()).isEqualTo("Kellner");
    }

    @Test
    void vietnamesePersonaPrompt_unchangedNoIdentityBlock() {
        String p = builder.buildSystemPrompt(request("Alltag", "A1", SpeakingPersona.TUAN).build());
        assertThat(p).doesNotContain("DEINE IDENTITÄT");
    }

    @Test
    void greetingInstruction_lukasGerman() {
        String g = SpeakingPersona.LUKAS.buildGreetingInstruction("Beruf", "IT", "Genus");
        assertThat(g).contains("Lukas");
        assertThat(g).contains("JSON");
    }

    @Test
    void personaEnum_roundTripUnknownToDefault() {
        assertThat(SpeakingPersona.fromApi(null)).isEqualTo(SpeakingPersona.DEFAULT);
        assertThat(SpeakingPersona.fromApi("")).isEqualTo(SpeakingPersona.DEFAULT);
        assertThat(SpeakingPersona.fromApi("nope")).isEqualTo(SpeakingPersona.DEFAULT);
        assertThat(SpeakingPersona.fromApi("emma")).isEqualTo(SpeakingPersona.EMMA);
    }

    @Test
    void interviewPrompt_containsTurnDirective() {
        var ctx = com.deutschflow.speaking.interview.InterviewPromptContext.fallback(
                SpeakingPersona.WEBER, "MTA Dermatologie", 4, new PersonaInterviewRegistry());
        String p = builder.buildSystemPrompt(request("Interview", "B1", SpeakingPersona.WEBER)
                .responseSchema(SpeakingResponseSchema.V1).sessionMode(SpeakingSessionMode.INTERVIEW)
                .interviewPosition("MTA Dermatologie").experienceLevel("1-2Y").turnCount(4)
                .interviewContext(ctx)
                .build());
        assertThat(p).contains("TURN_DIRECTIVE");
        assertThat(p).contains("Verbotene Phrasen");
        assertThat(p).contains("Pflichtfrage");
    }

}
