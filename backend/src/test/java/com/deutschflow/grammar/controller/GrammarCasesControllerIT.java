package com.deutschflow.grammar.controller;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("GrammarCasesController Integration Tests")
class GrammarCasesControllerIT extends AbstractPostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("getAllCases returns list of grammar cases")
    void getAllCases_returnsAllCases() throws Exception {
        mockMvc.perform(get("/api/v1/grammar/cases"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", isA(java.util.ArrayList.class)))
                .andExpect(jsonPath("$.length()", greaterThanOrEqualTo(4)))
                .andExpect(jsonPath("$[0].caseName", notNullValue()))
                .andExpect(jsonPath("$[0].caseLabel", notNullValue()));
    }

    @Test
    @DisplayName("getCaseByName returns case for valid name")
    void getCaseByName_validName_returnsCaseDto() throws Exception {
        mockMvc.perform(get("/api/v1/grammar/cases/nominative"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.caseName").value("nominative"))
                .andExpect(jsonPath("$.caseLabel").value("Nominativ (Subject)"))
                .andExpect(jsonPath("$.englishDescription", notNullValue()))
                .andExpect(jsonPath("$.germanDescription", notNullValue()));
    }

    @Test
    @DisplayName("getCaseByName returns 404 for non-existent case")
    void getCaseByName_invalidName_returns404() throws Exception {
        mockMvc.perform(get("/api/v1/grammar/cases/invalid_case"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("getExamples returns examples for valid case id")
    void getExamples_validCaseId_returnsExampleList() throws Exception {
        mockMvc.perform(get("/api/v1/grammar/cases/1/examples"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", isA(java.util.ArrayList.class)))
                .andExpect(jsonPath("$.length()", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$[0].germanSentence", notNullValue()))
                .andExpect(jsonPath("$[0].englishTranslation", notNullValue()))
                .andExpect(jsonPath("$[0].wordInFocus", notNullValue()));
    }

    @Test
    @DisplayName("getExamples returns empty list for non-existent case id")
    void getExamples_invalidCaseId_returnsEmptyList() throws Exception {
        mockMvc.perform(get("/api/v1/grammar/cases/999/examples"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", isA(java.util.ArrayList.class)))
                .andExpect(jsonPath("$.length()", equalTo(0)));
    }

    @Test
    @DisplayName("getExercises returns exercises for valid case id")
    void getExercises_validCaseId_returnsExerciseList() throws Exception {
        mockMvc.perform(get("/api/v1/grammar/cases/1/exercises"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", isA(java.util.ArrayList.class)))
                .andExpect(jsonPath("$.length()", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$[0].exerciseType", notNullValue()))
                .andExpect(jsonPath("$[0].question", notNullValue()))
                .andExpect(jsonPath("$[0].difficultyLevel", notNullValue()));
    }

    @Test
    @DisplayName("getExercises returns empty list for non-existent case id")
    void getExercises_invalidCaseId_returnsEmptyList() throws Exception {
        mockMvc.perform(get("/api/v1/grammar/cases/999/exercises"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", isA(java.util.ArrayList.class)))
                .andExpect(jsonPath("$.length()", equalTo(0)));
    }

    @Test
    @DisplayName("getExercisesByDifficulty returns exercises filtered by difficulty")
    void getExercisesByDifficulty_validCaseAndLevel_returnsFilteredList() throws Exception {
        mockMvc.perform(get("/api/v1/grammar/cases/1/exercises/difficulty/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", isA(java.util.ArrayList.class)))
                .andExpect(jsonPath("$[*].difficultyLevel", everyItem(equalTo(1))));
    }

    @Test
    @DisplayName("getExercisesByDifficulty returns empty list for non-matching difficulty")
    void getExercisesByDifficulty_invalidCaseId_returnsEmptyList() throws Exception {
        mockMvc.perform(get("/api/v1/grammar/cases/999/exercises/difficulty/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", isA(java.util.ArrayList.class)))
                .andExpect(jsonPath("$.length()", equalTo(0)));
    }

    @Test
    @DisplayName("getArticle returns article for valid gender and case")
    void getArticle_validGenderAndKasus_returnsArticleDto() throws Exception {
        mockMvc.perform(get("/api/v1/grammar/cases/articles")
                .param("gender", "m")
                .param("kasus", "nominative"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.article").value("der"))
                .andExpect(jsonPath("$.gender").value("m"))
                .andExpect(jsonPath("$.kasus").value("nominative"));
    }

    @Test
    @DisplayName("getArticle returns feminine article for dative case")
    void getArticle_feminineDative_returnsCorrectArticle() throws Exception {
        mockMvc.perform(get("/api/v1/grammar/cases/articles")
                .param("gender", "f")
                .param("kasus", "dative"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.article").value("der"))
                .andExpect(jsonPath("$.gender").value("f"));
    }

    @Test
    @DisplayName("getArticle returns 404 for non-existent gender and case combination")
    void getArticle_invalidGenderAndKasus_returns404() throws Exception {
        mockMvc.perform(get("/api/v1/grammar/cases/articles")
                .param("gender", "invalid")
                .param("kasus", "nominative"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("getArticle returns 400 when gender parameter is missing")
    void getArticle_missingGender_returns400() throws Exception {
        mockMvc.perform(get("/api/v1/grammar/cases/articles")
                .param("kasus", "nominative"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("getArticle returns 400 when kasus parameter is missing")
    void getArticle_missingKasus_returns400() throws Exception {
        mockMvc.perform(get("/api/v1/grammar/cases/articles")
                .param("gender", "m"))
                .andExpect(status().isBadRequest());
    }
}
