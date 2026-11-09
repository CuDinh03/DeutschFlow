package com.deutschflow.curriculum.controller;

import com.deutschflow.common.exception.GlobalExceptionHandler;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.curriculum.service.PracticeNodeService;
import com.deutschflow.curriculum.service.PracticeSessionQuizService;
import com.deutschflow.unittest.support.MockMvcWithValidation;
import com.deutschflow.user.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** A3: HTTP contract of the answer-free skill-practice endpoints (JSON keys asserted by name). */
@ExtendWith(MockitoExtension.class)
class PracticeSessionQuizControllerTest {

    private static final List<String> ANSWER_KEYS = List.of(
            "correctAnswer", "correct_answer", "correct_index", "correctIndex", "answer", "isCorrect",
            "is_correct", "accept_also", "correct_order", "expected_answer", "example_answer",
            "explanation_vi", "explanation_en", "explanation_de", "grammar_rule_vi");

    @Mock
    PracticeNodeService practiceNodeService;

    private MockMvc mvc;

    @BeforeEach
    void setUp() throws Exception {
        PracticeSessionQuizController controller =
                new PracticeSessionQuizController(new PracticeSessionQuizService(practiceNodeService));
        mvc = MockMvcWithValidation.standalone(controller, new GlobalExceptionHandler(),
                User.builder().id(7L).build());
    }

    private Map<String, Object> detail(String status) throws Exception {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("sessionId", 42L);
        d.put("skillType", "HOEREN");
        d.put("generation", 1);
        d.put("status", status);
        d.put("scorePercent", 0);
        d.put("exercises", new ObjectMapper().readValue("""
                [{"type": "LISTEN_AND_CHOOSE", "instruction_de": "Höre zu.", "audio_transcript": "Um 14 Uhr.",
                  "question_de": "Wann?", "options": ["13", "14", "15"], "correct_index": 1,
                  "explanation_vi": "lúc 14 giờ"},
                 {"type": "LISTEN_AND_FILL", "sentence_with_blank": "Guten ___!", "correct_answer": "Morgen",
                  "accept_also": ["morgen"], "explanation_de": "Guten Morgen."}]
                """, Object.class));
        d.put("sourceNodeTitle", "Zeit");
        d.put("sourceNodeTitleVi", "Thời gian");
        return d;
    }

    @Test
    void quizJsonCarriesNoAnswerField() throws Exception {
        when(practiceNodeService.getSessionDetail(7L, 42L)).thenReturn(detail("ACTIVE"));

        String body = mvc.perform(get("/api/skill-tree/practice/42/quiz"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").value(42))
                .andExpect(jsonPath("$.exercises[0].answer_mode").value("choice"))
                .andExpect(jsonPath("$.exercises[1].answer_mode").value("text"))
                .andReturn().getResponse().getContentAsString();

        for (String key : ANSWER_KEYS) {
            assertThat(body).as("quiz JSON must not contain key %s", key).doesNotContain("\"" + key + "\"");
        }
    }

    @Test
    void checkReturnsVerdictAfterAnswering() throws Exception {
        when(practiceNodeService.getSessionDetail(7L, 42L)).thenReturn(detail("ACTIVE"));

        mvc.perform(post("/api/skill-tree/practice/42/check")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"answers\": {\"0\": 0, \"1\": \"morgen\"}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results['0'].correct").value(false))
                .andExpect(jsonPath("$.results['0'].correctIndex").value(1))
                .andExpect(jsonPath("$.results['1'].correct").value(true))
                .andExpect(jsonPath("$.results['1'].correctAnswer").doesNotExist());
    }

    @Test
    void reviewIs409BeforeSubmitAnd200After() throws Exception {
        when(practiceNodeService.getSessionDetail(7L, 42L)).thenReturn(detail("ACTIVE"));
        mvc.perform(get("/api/skill-tree/practice/42/review")).andExpect(status().isConflict());

        when(practiceNodeService.getSessionDetail(7L, 42L)).thenReturn(detail("COMPLETED"));
        mvc.perform(get("/api/skill-tree/practice/42/review"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.exercises[0].correct_index").value(1))
                .andExpect(jsonPath("$.exercises[0].explanation_vi").value("lúc 14 giờ"))
                .andExpect(jsonPath("$.exercises[1].correct_answer").value("Morgen"));
    }

    @Test
    void someoneElsesSessionIs404() throws Exception {
        when(practiceNodeService.getSessionDetail(7L, 99L)).thenThrow(new NotFoundException("Practice session not found: 99"));

        mvc.perform(get("/api/skill-tree/practice/99/quiz")).andExpect(status().isNotFound());
        mvc.perform(post("/api/skill-tree/practice/99/check")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"answers\": {\"0\": 1}}"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/skill-tree/practice/99/review")).andExpect(status().isNotFound());
    }
}
