package com.deutschflow.speaking.service;

import com.deutschflow.speaking.dto.BeginnerSpeakingResponse;
import com.deutschflow.speaking.entity.DialogueTemplate;
import com.deutschflow.speaking.repository.DialogueTemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class BeginnerSpeakingService {

    private final DialogueTemplateRepository dialogueTemplateRepository;

    // Day-1 prompt for learners who have no prior German
    private static final List<String> DAY1_SAMPLE_RESPONSES = List.of(
            "Hallo!",
            "Ich heiße [dein Name].",
            "Guten Morgen!",
            "Danke."
    );

    @Transactional(readOnly = true)
    public BeginnerSpeakingResponse getDay1SpeakingPrompt() {
        DialogueTemplate template = dialogueTemplateRepository
                .findByTemplateName("beginner_greeting_day1")
                .orElseGet(() -> buildFallbackTemplate());

        return new BeginnerSpeakingResponse(
                template.getId(),
                template.getTemplateName(),
                template.getUserPromptTemplate(),
                template.getAiSystemPrompt(),
                "Đừng lo lắng về lỗi! Cứ thử nói và AI sẽ giúp bạn.",
                DAY1_SAMPLE_RESPONSES
        );
    }

    @Transactional(readOnly = true)
    public List<BeginnerSpeakingResponse> getAllBeginnerTemplates() {
        return dialogueTemplateRepository.findByDifficultyLevel(1).stream()
                .map(t -> new BeginnerSpeakingResponse(
                        t.getId(),
                        t.getTemplateName(),
                        t.getUserPromptTemplate(),
                        t.getAiSystemPrompt(),
                        "Hãy thử nói tiếng Đức! Mọi nỗ lực đều được khen ngợi.",
                        DAY1_SAMPLE_RESPONSES
                ))
                .toList();
    }

    private DialogueTemplate buildFallbackTemplate() {
        return DialogueTemplate.builder()
                .templateName("fallback_beginner")
                .difficultyLevel(1)
                .userPromptTemplate("Nói xin chào bằng tiếng Đức: Hallo!")
                .aiSystemPrompt("Bạn là giáo viên tiếng Đức thân thiện. Chào hỏi học viên và hướng dẫn họ nói 'Hallo' và giới thiệu tên mình.")
                .build();
    }
}
