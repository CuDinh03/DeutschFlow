package com.deutschflow.grammar.service;

import com.deutschflow.ai.AiTextService;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.grammar.dto.GrammarExerciseDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * QA F-10: the exercises endpoint must not leak the answer key before submission, and submitting an
 * unknown exercise id must 404 (NotFoundException) instead of throwing a raw 500.
 */
@ExtendWith(MockitoExtension.class)
class GrammarSyllabusServiceUnitTest {

    @Mock JdbcTemplate jdbcTemplate;
    @Mock AiTextService aiTextService;

    private GrammarSyllabusService service() {
        return new GrammarSyllabusService(jdbcTemplate, aiTextService, new ObjectMapper());
    }

    @Test
    void getApprovedExercises_stripsAnswerKeyFromPayload() {
        String withKey = "{\"prompt\":\"___ Tisch\",\"options\":[\"Der\",\"Die\"]," +
                "\"correct_answer\":\"Der\",\"explanation_vi\":\"giống đực\",\"explanation_de\":\"maskulin\"}";
        when(jdbcTemplate.queryForList(any(String.class), eq(1L), anyInt())).thenReturn(List.of(
                Map.of("id", 5L, "exercise_type", "MULTIPLE_CHOICE", "difficulty", 1, "question_json", withKey)));

        List<GrammarExerciseDto> out = service().getApprovedExercises(1L, 10);

        assertThat(out).hasSize(1);
        String payload = out.get(0).questionJson();
        assertThat(payload).contains("prompt").contains("options");
        assertThat(payload).doesNotContain("correct_answer");
        assertThat(payload).doesNotContain("explanation_vi");
        assertThat(payload).doesNotContain("explanation_de");
    }

    @Test
    void submitAnswer_unknownExerciseId_throwsNotFound() {
        when(jdbcTemplate.queryForList(any(String.class), eq(999999L))).thenReturn(List.of());

        assertThatThrownBy(() -> service().submitAnswer(1L, 999999L, "Der"))
                .isInstanceOf(NotFoundException.class);
    }
}
