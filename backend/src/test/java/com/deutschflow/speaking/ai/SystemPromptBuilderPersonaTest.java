package com.deutschflow.speaking.ai;

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

class SystemPromptBuilderPersonaTest {

    @Mock
    private SystemConfigService systemConfigService;

    private SystemPromptBuilder builder;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        // Return default base prompt for any getString() call
        lenient().when(systemConfigService.getString(anyString(), anyString()))
                .thenAnswer(inv -> inv.getArgument(1));
        builder = new SystemPromptBuilder(systemConfigService);
    }

    private static UserLearningProfile minimalProfile() {
        return UserLearningProfile.builder()
                .targetLevel(UserLearningProfile.TargetLevel.A1)
                .goalType(UserLearningProfile.GoalType.CERT)
                .currentLevel(UserLearningProfile.CurrentLevel.A1)
                .build();
    }

    @Test
    void lukasPrompt_containsAnchors() {
        String p = builder.buildSystemPrompt(
                minimalProfile(), List.of(), "Beruf", List.of(), "B1", SpeakingPersona.LUKAS);
        assertThat(p).contains("PERSONA (Lukas");
        assertThat(p).contains("Berlin");
        assertThat(p).contains("Priorität: Target_Topic");
    }

    @Test
    void emmaPrompt_containsAnchors() {
        String p = builder.buildSystemPrompt(
                minimalProfile(), List.of(), "Alltag", List.of(), "A2", SpeakingPersona.EMMA);
        assertThat(p).contains("PERSONA (Emma");
        assertThat(p).contains("Flohmarkt");
    }

    @Test
    void klausPrompt_containsAnchors() {
        String p = builder.buildSystemPrompt(
                minimalProfile(), List.of(), "Familie", List.of(), "B2", SpeakingPersona.KLAUS);
        assertThat(p).contains("PERSONA (Klaus");
        assertThat(p).contains("Küchenchef");
    }

    @Test
    void defaultPrompt_hasNoPersonaBlock() {
        String p = builder.buildSystemPrompt(
                minimalProfile(), List.of(), "Thema", List.of(), "A1", SpeakingPersona.DEFAULT);
        assertThat(p).doesNotContain("PERSONA (Lukas");
        assertThat(p).contains("AI TASKS & LOGIC");
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
}
