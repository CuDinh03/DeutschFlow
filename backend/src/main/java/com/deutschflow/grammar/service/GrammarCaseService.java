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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class GrammarCaseService {
    public GrammarCaseService(GrammarCaseRepository grammarCaseRepository, GrammarArticleRepository grammarArticleRepository, GrammarCaseExampleRepository grammarCaseExampleRepository, GrammarCaseExerciseRepository grammarCaseExerciseRepository) {
        this.grammarCaseRepository = grammarCaseRepository;
        this.grammarArticleRepository = grammarArticleRepository;
        this.grammarCaseExampleRepository = grammarCaseExampleRepository;
        this.grammarCaseExerciseRepository = grammarCaseExerciseRepository;
    }


    private final GrammarCaseRepository grammarCaseRepository;
    private final GrammarArticleRepository grammarArticleRepository;
    private final GrammarCaseExampleRepository grammarCaseExampleRepository;
    private final GrammarCaseExerciseRepository grammarCaseExerciseRepository;

    @Transactional(readOnly = true)
    public List<GrammarCaseDto> getAllCases() {
        return grammarCaseRepository.findAll()
            .stream()
            .map(this::mapToDto)
            .toList();
    }

    @Transactional(readOnly = true)
    public GrammarCaseDto getCaseByName(String caseName) {
        return grammarCaseRepository.findByCaseName(caseName)
            .map(this::mapToDto)
            .orElseThrow(() -> new NotFoundException("Grammar case not found: " + caseName));
    }

    @Transactional(readOnly = true)
    public GrammarCaseDto getCaseById(Long caseId) {
        return grammarCaseRepository.findById(caseId)
            .map(this::mapToDto)
            .orElseThrow(() -> new NotFoundException("Grammar case not found: id=" + caseId));
    }

    @Transactional(readOnly = true)
    public GrammarArticleDto getArticle(String gender, String kasus) {
        return grammarArticleRepository.findByGenderAndKasus(gender, kasus)
            .map(this::mapArticleToDto)
            .orElseThrow(() -> new NotFoundException(
                "Article not found for gender=" + gender + ", kasus=" + kasus));
    }

    @Transactional(readOnly = true)
    public List<GrammarCaseExerciseDto> getExercisesByCase(Long caseId) {
        return grammarCaseExerciseRepository.findByGrammarCaseId(caseId)
            .stream()
            .map(this::mapExerciseToDto)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<GrammarCaseExerciseDto> getExercisesByCaseAndDifficulty(Long caseId, Integer difficultyLevel) {
        return grammarCaseExerciseRepository.findByGrammarCaseIdAndDifficultyLevel(caseId, difficultyLevel)
            .stream()
            .map(this::mapExerciseToDto)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<GrammarCaseExampleDto> getExamplesByCase(Long caseId) {
        return grammarCaseExampleRepository.findByGrammarCaseId(caseId)
            .stream()
            .map(this::mapExampleToDto)
            .toList();
    }

    private GrammarCaseDto mapToDto(GrammarCase grammarCase) {
        List<GrammarCaseExampleDto> examples = grammarCaseExampleRepository
            .findByGrammarCaseId(grammarCase.getId())
            .stream()
            .map(this::mapExampleToDto)
            .toList();

        List<GrammarCaseExerciseDto> exercises = grammarCaseExerciseRepository
            .findByGrammarCaseId(grammarCase.getId())
            .stream()
            .map(this::mapExerciseToDto)
            .toList();

        return GrammarCaseDto.builder()
            .id(grammarCase.getId())
            .caseName(grammarCase.getCaseName())
            .caseLabel(grammarCase.getCaseLabel())
            .englishDescription(grammarCase.getEnglishDescription())
            .germanDescription(grammarCase.getGermanDescription())
            .questionWords(grammarCase.getQuestionWords())
            .examples(examples)
            .exercises(exercises)
            .build();
    }

    private GrammarArticleDto mapArticleToDto(GrammarArticle article) {
        return GrammarArticleDto.builder()
            .id(article.getId())
            .gender(article.getGender())
            .kasus(article.getKasus())
            .article(article.getArticle())
            .build();
    }

    private GrammarCaseExampleDto mapExampleToDto(GrammarCaseExample example) {
        return GrammarCaseExampleDto.builder()
            .id(example.getId())
            .caseId(example.getGrammarCase().getId())
            .germanSentence(example.getGermanSentence())
            .englishTranslation(example.getEnglishTranslation())
            .wordInFocus(example.getWordInFocus())
            .caseRole(example.getCaseRole())
            .build();
    }

    private GrammarCaseExerciseDto mapExerciseToDto(GrammarCaseExercise exercise) {
        return GrammarCaseExerciseDto.builder()
            .id(exercise.getId())
            .caseId(exercise.getGrammarCase().getId())
            .difficultyLevel(exercise.getDifficultyLevel())
            .exerciseType(exercise.getExerciseType())
            .question(exercise.getQuestion())
            .correctAnswer(exercise.getCorrectAnswer())
            .explanation(exercise.getExplanation())
            .build();
    }
}
