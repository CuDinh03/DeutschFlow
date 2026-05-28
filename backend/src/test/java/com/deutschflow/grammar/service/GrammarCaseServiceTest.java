package com.deutschflow.grammar.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.grammar.dto.GrammarArticleDto;
import com.deutschflow.grammar.dto.GrammarCaseDto;
import com.deutschflow.grammar.dto.GrammarCaseExampleDto;
import com.deutschflow.grammar.dto.GrammarCaseExerciseDto;
import com.deutschflow.grammar.entity.GrammarArticle;
import com.deutschflow.grammar.entity.GrammarCase;
import com.deutschflow.grammar.entity.GrammarCaseExample;
import com.deutschflow.grammar.entity.GrammarCaseExercise;
import com.deutschflow.grammar.repository.GrammarArticleRepository;
import com.deutschflow.grammar.repository.GrammarCaseExampleRepository;
import com.deutschflow.grammar.repository.GrammarCaseExerciseRepository;
import com.deutschflow.grammar.repository.GrammarCaseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("GrammarCaseService Unit Tests")
class GrammarCaseServiceTest {

    @Mock
    private GrammarCaseRepository grammarCaseRepository;

    @Mock
    private GrammarArticleRepository grammarArticleRepository;

    @Mock
    private GrammarCaseExampleRepository grammarCaseExampleRepository;

    @Mock
    private GrammarCaseExerciseRepository grammarCaseExerciseRepository;

    private GrammarCaseService service;

    @BeforeEach
    void setUp() {
        service = new GrammarCaseService(
                grammarCaseRepository,
                grammarArticleRepository,
                grammarCaseExampleRepository,
                grammarCaseExerciseRepository
        );
    }

    @Test
    @DisplayName("getAllCases returns all grammar cases")
    void getAllCases_returnsCasesList() {
        GrammarCase nominative = createGrammarCase(1L, "nominative", "Nominativ (Subject)");
        GrammarCase accusative = createGrammarCase(2L, "accusative", "Akkusativ (Direct Object)");

        when(grammarCaseRepository.findAll()).thenReturn(List.of(nominative, accusative));

        List<GrammarCaseDto> result = service.getAllCases();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getCaseName()).isEqualTo("nominative");
        assertThat(result.get(1).getCaseName()).isEqualTo("accusative");
    }

    @Test
    @DisplayName("getCaseByName returns case for valid name")
    void getCaseByName_validName_returnsCase() {
        GrammarCase nominative = createGrammarCase(1L, "nominative", "Nominativ (Subject)");

        when(grammarCaseRepository.findByCaseName("nominative")).thenReturn(Optional.of(nominative));

        GrammarCaseDto result = service.getCaseByName("nominative");

        assertThat(result.getCaseName()).isEqualTo("nominative");
        assertThat(result.getCaseLabel()).isEqualTo("Nominativ (Subject)");
    }

    @Test
    @DisplayName("getCaseByName throws NotFoundException for non-existent case")
    void getCaseByName_invalidName_throwsNotFoundException() {
        when(grammarCaseRepository.findByCaseName("invalid")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getCaseByName("invalid"))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("Grammar case not found");
    }

    @Test
    @DisplayName("getCaseById returns case for valid id")
    void getCaseById_validId_returnsCase() {
        GrammarCase dative = createGrammarCase(3L, "dative", "Dativ (Indirect Object)");

        when(grammarCaseRepository.findById(3L)).thenReturn(Optional.of(dative));

        GrammarCaseDto result = service.getCaseById(3L);

        assertThat(result.getId()).isEqualTo(3L);
        assertThat(result.getCaseName()).isEqualTo("dative");
    }

    @Test
    @DisplayName("getCaseById throws NotFoundException for non-existent id")
    void getCaseById_invalidId_throwsNotFoundException() {
        when(grammarCaseRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getCaseById(999L))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("getArticle returns correct article for gender and case")
    void getArticle_validGenderAndCase_returnsArticle() {
        GrammarArticle article = new GrammarArticle();
        article.setId(1L);
        article.setGender("m");
        article.setKasus("nominative");
        article.setArticle("der");

        when(grammarArticleRepository.findByGenderAndKasus("m", "nominative"))
                .thenReturn(Optional.of(article));

        GrammarArticleDto result = service.getArticle("m", "nominative");

        assertThat(result.getArticle()).isEqualTo("der");
    }

    @Test
    @DisplayName("getExercisesByCase returns exercises for case")
    void getExercisesByCase_validCaseId_returnsExercises() {
        GrammarCase grammarCase = createGrammarCase(1L, "nominative", "Nominativ (Subject)");
        GrammarCaseExercise exercise = new GrammarCaseExercise();
        exercise.setId(1L);
        exercise.setGrammarCase(grammarCase);
        exercise.setDifficultyLevel(1);
        exercise.setExerciseType("article_selection");
        exercise.setQuestion("Der ___ Mann");
        exercise.setCorrectAnswer("gute");
        exercise.setExplanation("Nominative case");

        when(grammarCaseExerciseRepository.findByGrammarCaseId(1L))
                .thenReturn(List.of(exercise));

        List<GrammarCaseExerciseDto> result = service.getExercisesByCase(1L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getExerciseType()).isEqualTo("article_selection");
    }

    @Test
    @DisplayName("getExamplesByCase returns examples for case")
    void getExamplesByCase_validCaseId_returnsExamples() {
        GrammarCase grammarCase = createGrammarCase(1L, "nominative", "Nominativ (Subject)");
        GrammarCaseExample example = new GrammarCaseExample();
        example.setId(1L);
        example.setGrammarCase(grammarCase);
        example.setGermanSentence("Der Mann ist alt");
        example.setEnglishTranslation("The man is old");
        example.setWordInFocus("Mann");
        example.setCaseRole("subject");

        when(grammarCaseExampleRepository.findByGrammarCaseId(1L))
                .thenReturn(List.of(example));

        List<GrammarCaseExampleDto> result = service.getExamplesByCase(1L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getWordInFocus()).isEqualTo("Mann");
    }

    private GrammarCase createGrammarCase(Long id, String caseName, String caseLabel) {
        GrammarCase grammarCase = new GrammarCase();
        grammarCase.setId(id);
        grammarCase.setCaseName(caseName);
        grammarCase.setCaseLabel(caseLabel);
        grammarCase.setEnglishDescription("English description");
        grammarCase.setGermanDescription("German description");
        grammarCase.setQuestionWords("Question words");
        grammarCase.setCreatedAt(LocalDateTime.now());
        return grammarCase;
    }
}
