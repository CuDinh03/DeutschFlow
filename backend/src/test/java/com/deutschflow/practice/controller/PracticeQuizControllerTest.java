package com.deutschflow.practice.controller;

import com.deutschflow.common.exception.GlobalExceptionHandler;
import com.deutschflow.practice.entity.PracticeExercise;
import com.deutschflow.practice.repository.PracticeExerciseRepository;
import com.deutschflow.practice.service.PracticeQuizService;
import com.deutschflow.practice.service.PracticeService;
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

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** A3: HTTP contract of the answer-free practice library (JSON keys asserted by name). */
@ExtendWith(MockitoExtension.class)
class PracticeQuizControllerTest {

    private static final List<String> ANSWER_KEYS = List.of(
            "correctAnswer", "correct_answer", "correct_index", "answer", "isCorrect", "explanation", "contentJson");

    @Mock PracticeExerciseRepository exerciseRepository;
    @Mock PracticeService practiceService;
    @Mock org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    private MockMvc mvc;

    private static PracticeExercise gradable() {
        return PracticeExercise.builder().id(10L).cefrLevel("A1").skillType("READING").xpReward(100)
                .contentJson("""
                        {"questions": [
                          {"id": "q1", "question": "___ Haus", "options": ["der", "die", "das"],
                           "correctAnswer": "das", "explanation": "Haus ist neutral."},
                          {"id": "q2", "question": "Ist das ein Haus?", "correctAnswer": "ja"}
                        ]}
                        """).build();
    }

    @BeforeEach
    void setUp() {
        PracticeQuizService service = new PracticeQuizService(exerciseRepository, practiceService, new ObjectMapper(), jdbcTemplate);
        mvc = MockMvcWithValidation.standalone(new PracticeQuizController(service), new GlobalExceptionHandler(),
                User.builder().id(5L).build());
    }

    @Test
    void quizJsonCarriesNoAnswerField() throws Exception {
        when(exerciseRepository.findById(10L)).thenReturn(Optional.of(gradable()));

        String body = mvc.perform(get("/api/practice/catalog/10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions[0].question").value("___ Haus"))
                .andExpect(jsonPath("$.questions[0].gradable").value(true))
                .andReturn().getResponse().getContentAsString();

        for (String key : ANSWER_KEYS) {
            assertThat(body).as("quiz JSON must not contain key %s", key).doesNotContain("\"" + key + "\"");
        }
    }

    @Test
    void gradeReturnsCorrectAnswerAndExplanationAfterSubmit() throws Exception {
        when(exerciseRepository.findById(10L)).thenReturn(Optional.of(gradable()));

        mvc.perform(post("/api/practice/catalog/10/grade")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"answers\": {\"q1\": \"das\", \"q2\": \"nein\"}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.graded").value(true))
                .andExpect(jsonPath("$.scorePercent").value(50))
                .andExpect(jsonPath("$.questions[0].correct").value(true))
                .andExpect(jsonPath("$.questions[0].correctAnswer").value("das"))
                .andExpect(jsonPath("$.questions[0].explanation").value("Haus ist neutral."))
                .andExpect(jsonPath("$.questions[1].correct").value(false));

        verify(practiceService).submitPracticeResult(eq(5L), any());
    }

    @Test
    void outOfRangeSelfScoreIs400() throws Exception {
        mvc.perform(post("/api/practice/catalog/10/grade")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"answers\": {}, \"scorePercent\": 1000}"))
                .andExpect(status().isBadRequest());

        verify(practiceService, never()).submitPracticeResult(any(), any());
    }

    @Test
    void unknownExerciseIs404() throws Exception {
        when(exerciseRepository.findById(404L)).thenReturn(Optional.empty());

        mvc.perform(get("/api/practice/catalog/404")).andExpect(status().isNotFound());
    }
}
