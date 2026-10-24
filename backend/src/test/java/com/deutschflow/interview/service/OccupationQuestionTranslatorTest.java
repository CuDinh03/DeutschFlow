package com.deutschflow.interview.service;

import com.deutschflow.interview.entity.OccupationContentStatus;
import com.deutschflow.interview.entity.OccupationQuestion;
import com.deutschflow.interview.repository.OccupationQuestionRepository;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** K4: dịch bù câu lớp nghề sinh trước V339. */
@ExtendWith(MockitoExtension.class)
class OccupationQuestionTranslatorTest {

    @Mock OpenAiChatClient chatClient;
    @Mock OccupationQuestionRepository questionRepository;

    private OccupationQuestionTranslator translator;

    @BeforeEach
    void setUp() {
        translator = new OccupationQuestionTranslator(chatClient, new ObjectMapper(), questionRepository);
        lenient().when(questionRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));
    }

    private static OccupationQuestion q(String id, String code, String vi, String en) {
        return OccupationQuestion.builder().id(id).occupationCode(code).topicKey("k")
                .questionDe("Frage " + id + "?").questionVi(vi).questionEn(en).build();
    }

    @Test
    void applyFillsOnlyEmptySlots_neverOverwritesReviewerText() throws Exception {
        OccupationQuestion fresh = q("a", "maurer", null, null);
        OccupationQuestion reviewed = q("b", "maurer", "Bản người duyệt sửa", null);
        String json = """
                {"translations":[
                  {"id":"a","questionVi":"Câu a?","questionEn":"Question a?"},
                  {"id":"b","questionVi":"AI ghi đè?","questionEn":"Question b?"},
                  {"id":"lạ","questionVi":"x","questionEn":"y"}]}
                """;

        int changed = translator.apply(json, List.of(fresh, reviewed));

        assertThat(changed).isEqualTo(2);
        assertThat(fresh.getQuestionVi()).isEqualTo("Câu a?");
        assertThat(fresh.getQuestionEn()).isEqualTo("Question a?");
        assertThat(reviewed.getQuestionVi()).isEqualTo("Bản người duyệt sửa");
        assertThat(reviewed.getQuestionEn()).isEqualTo("Question b?");
    }

    @Test
    void backfillCallsAiOncePerOccupation_respectsLimit_andReportsRemaining() {
        List<OccupationQuestion> pending = new ArrayList<>(List.of(
                q("m1", "maurer", null, null), q("m2", "maurer", null, null),
                q("f1", "florist", null, null), q("k1", "koch", null, null)));
        when(questionRepository.findUntranslated(OccupationContentStatus.REJECTED))
                .thenReturn(pending, List.of(pending.get(3)));
        when(chatClient.chatCompletion(anyList(), isNull(), anyDouble(), anyInt()))
                .thenReturn(new AiChatCompletionResult("""
                        {"translations":[{"id":"m1","questionVi":"v1","questionEn":"e1"},
                                         {"id":"m2","questionVi":"v2","questionEn":"e2"}]}""", null, "groq", "m"))
                .thenReturn(new AiChatCompletionResult("not json", null, "groq", "m"));

        OccupationQuestionTranslator.BackfillResult r = translator.backfill(2);

        assertThat(r.occupations()).isEqualTo(2);
        assertThat(r.translated()).isEqualTo(2);
        assertThat(r.remaining()).isEqualTo(1);
        verify(chatClient, times(2)).chatCompletion(anyList(), isNull(), anyDouble(), anyInt());
        assertThat(pending.get(0).getQuestionVi()).isEqualTo("v1");
        // Lỗi AI ở nghề thứ hai không ném, câu vẫn chờ lượt sau.
        assertThat(pending.get(2).getQuestionVi()).isNull();
    }

    @Test
    void backfillLimitIsCappedPerRun() {
        when(questionRepository.findUntranslated(OccupationContentStatus.REJECTED)).thenReturn(List.of());

        assertThat(translator.backfill(500).occupations()).isZero();
        assertThat(OccupationQuestionTranslator.MAX_OCCUPATIONS_PER_RUN).isEqualTo(10);
    }
}
