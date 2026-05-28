package com.deutschflow.grammar.controller;

import com.deutschflow.grammar.dto.GrammarArticleDto;
import com.deutschflow.grammar.dto.GrammarCaseDto;
import com.deutschflow.grammar.dto.GrammarCaseExampleDto;
import com.deutschflow.grammar.dto.GrammarCaseExerciseDto;
import com.deutschflow.grammar.service.GrammarCaseService;
import com.deutschflow.unittest.support.MockMvcWithValidation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class GrammarCasesControllerUnitTest {

    private MockMvc mvc;

    @Mock
    private GrammarCaseService grammarCaseService;

    @InjectMocks
    private GrammarCasesController controller;

    private GrammarCaseDto nominative;

    @BeforeEach
    void setUp() {
        mvc = MockMvcWithValidation.standaloneWithAdvice(controller);
        nominative = GrammarCaseDto.builder()
                .id(1L).caseName("nominative").caseLabel("Nominativ (Subject)")
                .englishDescription("Subject of the sentence").germanDescription("Das Subjekt")
                .questionWords("Wer? Was?").examples(List.of()).exercises(List.of())
                .build();
    }

    @Test
    void getAllCases_returnsOkWithList() throws Exception {
        var dative = GrammarCaseDto.builder().id(2L).caseName("dative").caseLabel("Dativ (Indirect Object)")
                .examples(List.of()).exercises(List.of()).build();
        when(grammarCaseService.getAllCases()).thenReturn(List.of(nominative, dative));

        mvc.perform(get("/api/v1/grammar/cases"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].caseName").value("nominative"));
    }

    @Test
    void getCaseByName_returnsOkWithCase() throws Exception {
        when(grammarCaseService.getCaseByName("nominative")).thenReturn(nominative);

        mvc.perform(get("/api/v1/grammar/cases/nominative"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.caseName").value("nominative"))
                .andExpect(jsonPath("$.caseLabel").value("Nominativ (Subject)"));
    }

    @Test
    void getExamples_returnsOkWithExamples() throws Exception {
        var ex = GrammarCaseExampleDto.builder()
                .id(1L).caseId(1L).germanSentence("Der Mann schläft.")
                .englishTranslation("The man sleeps.").wordInFocus("Mann").caseRole("subject").build();
        when(grammarCaseService.getExamplesByCase(1L)).thenReturn(List.of(ex));

        mvc.perform(get("/api/v1/grammar/cases/1/examples"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].germanSentence").value("Der Mann schläft."));
    }

    @Test
    void getExercises_returnsOkWithExercises() throws Exception {
        var exercise = GrammarCaseExerciseDto.builder()
                .id(1L).caseId(1L).difficultyLevel(1).exerciseType("article_selection")
                .question("___ Mann liest.").correctAnswer("Der").explanation("Nominativ maskulin → der").build();
        when(grammarCaseService.getExercisesByCase(1L)).thenReturn(List.of(exercise));

        mvc.perform(get("/api/v1/grammar/cases/1/exercises"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].correctAnswer").value("Der"));
    }

    @Test
    void getExercisesByDifficulty_returnsOkFiltered() throws Exception {
        var exercise = GrammarCaseExerciseDto.builder()
                .id(2L).caseId(1L).difficultyLevel(2).exerciseType("sentence_fill")
                .question("Ich sehe ___ Mann.").correctAnswer("den").explanation("Akkusativ maskulin → den").build();
        when(grammarCaseService.getExercisesByCaseAndDifficulty(1L, 2)).thenReturn(List.of(exercise));

        mvc.perform(get("/api/v1/grammar/cases/1/exercises/difficulty/2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].difficultyLevel").value(2));
    }

    @Test
    void getArticle_returnsOkWithArticle() throws Exception {
        var article = GrammarArticleDto.builder().id(1L).gender("m").kasus("nominative").article("der").build();
        when(grammarCaseService.getArticle("m", "nominative")).thenReturn(article);

        mvc.perform(get("/api/v1/grammar/cases/articles").param("gender", "m").param("kasus", "nominative"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.article").value("der"))
                .andExpect(jsonPath("$.gender").value("m"));
    }
}
