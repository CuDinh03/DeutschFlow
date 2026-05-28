package com.deutschflow.speaking.service;

import com.deutschflow.speaking.entity.DialogueTemplate;
import com.deutschflow.speaking.repository.DialogueTemplateRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BeginnerSpeakingServiceTest {

    @Mock
    DialogueTemplateRepository dialogueTemplateRepository;

    @InjectMocks
    BeginnerSpeakingService beginnerSpeakingService;

    private static DialogueTemplate greetingTemplate() {
        return DialogueTemplate.builder()
                .id(1L)
                .templateName("beginner_greeting_day1")
                .difficultyLevel(1)
                .userPromptTemplate("Nói xin chào bằng tiếng Đức!")
                .aiSystemPrompt("Bạn là giáo viên tiếng Đức. Hướng dẫn học viên chào hỏi.")
                .build();
    }

    @Test
    @DisplayName("day1 prompt returns the named template when found")
    void getDay1SpeakingPrompt_templateFound() {
        when(dialogueTemplateRepository.findByTemplateName("beginner_greeting_day1"))
                .thenReturn(Optional.of(greetingTemplate()));

        var result = beginnerSpeakingService.getDay1SpeakingPrompt();

        assertThat(result.templateName()).isEqualTo("beginner_greeting_day1");
        assertThat(result.templateId()).isEqualTo(1L);
        assertThat(result.userPrompt()).isEqualTo("Nói xin chào bằng tiếng Đức!");
        assertThat(result.sampleResponses()).isNotEmpty();
        assertThat(result.encouragement()).isNotBlank();
    }

    @Test
    @DisplayName("day1 prompt returns fallback when template not seeded yet")
    void getDay1SpeakingPrompt_fallbackWhenMissing() {
        when(dialogueTemplateRepository.findByTemplateName("beginner_greeting_day1"))
                .thenReturn(Optional.empty());

        var result = beginnerSpeakingService.getDay1SpeakingPrompt();

        assertThat(result.templateName()).isEqualTo("fallback_beginner");
        assertThat(result.userPrompt()).isNotBlank();
        assertThat(result.systemPrompt()).isNotBlank();
        assertThat(result.sampleResponses()).isNotEmpty();
    }

    @Test
    @DisplayName("getAllBeginnerTemplates maps all difficulty-1 templates")
    void getAllBeginnerTemplates_returnsAllLevel1() {
        var t1 = DialogueTemplate.builder().id(1L).templateName("beginner_greeting_day1")
                .difficultyLevel(1).userPromptTemplate("Hallo sagen").aiSystemPrompt("...").build();
        var t2 = DialogueTemplate.builder().id(2L).templateName("beginner_introduce_yourself_day1")
                .difficultyLevel(1).userPromptTemplate("Sich vorstellen").aiSystemPrompt("...").build();
        when(dialogueTemplateRepository.findByDifficultyLevel(1)).thenReturn(List.of(t1, t2));

        var results = beginnerSpeakingService.getAllBeginnerTemplates();

        assertThat(results).hasSize(2);
        assertThat(results).extracting("templateName")
                .containsExactly("beginner_greeting_day1", "beginner_introduce_yourself_day1");
    }

    @Test
    @DisplayName("getAllBeginnerTemplates returns empty list when no templates seeded")
    void getAllBeginnerTemplates_emptyWhenNoTemplates() {
        when(dialogueTemplateRepository.findByDifficultyLevel(1)).thenReturn(List.of());

        var results = beginnerSpeakingService.getAllBeginnerTemplates();

        assertThat(results).isEmpty();
    }
}
