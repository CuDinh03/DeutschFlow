package com.deutschflow.vocabulary.controller;

import com.deutschflow.vocabulary.dto.VocabEtymologyDto;
import com.deutschflow.vocabulary.dto.VocabExamplesDto;
import com.deutschflow.vocabulary.dto.VocabExamplesRequest;
import com.deutschflow.vocabulary.dto.VocabMnemonicDto;
import com.deutschflow.vocabulary.dto.VocabMnemonicRequest;
import com.deutschflow.vocabulary.dto.VocabQuizDto;
import com.deutschflow.vocabulary.dto.VocabQuizRequest;
import com.deutschflow.vocabulary.dto.VocabSimilarDto;
import com.deutschflow.vocabulary.dto.VocabStoryDto;
import com.deutschflow.vocabulary.dto.VocabStoryRequest;
import com.deutschflow.vocabulary.dto.VocabUsageDto;
import com.deutschflow.vocabulary.dto.VocabWordRequest;
import com.deutschflow.vocabulary.service.AIVocabularyService;
import com.deutschflow.vocabulary.service.AIVocabularyService.QuizQuestion;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST API for AI-powered vocabulary features.
 * All endpoints require authentication to prevent abuse of AI quota.
 * Responses are cached in AIVocabularyService via @Cacheable.
 */
@Slf4j
@RestController
@RequestMapping("/api/vocabulary/ai")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class AIVocabularyController {

    private static final int DEFAULT_EXAMPLE_COUNT = 3;
    private static final int DEFAULT_QUESTIONS_PER_WORD = 2;

    private final AIVocabularyService aiVocabularyService;

    /**
     * Generate example sentences for a word
     * POST /api/vocabulary/ai/examples
     */
    @PostMapping("/examples")
    public ResponseEntity<VocabExamplesDto> generateExamples(@RequestBody VocabExamplesRequest request) {
        String word = request.word();
        if (word == null || word.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        int count = request.count() != null ? request.count() : DEFAULT_EXAMPLE_COUNT;
        List<String> examples = aiVocabularyService.generateExamples(word, count);
        return ResponseEntity.ok(new VocabExamplesDto(word, examples));
    }

    /**
     * Explain word usage
     * POST /api/vocabulary/ai/usage
     */
    @PostMapping("/usage")
    public ResponseEntity<VocabUsageDto> explainUsage(@RequestBody VocabWordRequest request) {
        String word = request.word();
        if (word == null || word.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        String usage = aiVocabularyService.explainUsage(word);
        return ResponseEntity.ok(new VocabUsageDto(word, usage));
    }

    /**
     * Generate mnemonic device
     * POST /api/vocabulary/ai/mnemonic
     */
    @PostMapping("/mnemonic")
    public ResponseEntity<VocabMnemonicDto> generateMnemonic(@RequestBody VocabMnemonicRequest request) {
        String word = request.word();
        if (word == null || word.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        String meaning = request.meaning() != null ? request.meaning() : "";
        String mnemonic = aiVocabularyService.generateMnemonic(word, meaning);
        return ResponseEntity.ok(new VocabMnemonicDto(word, mnemonic));
    }

    /**
     * Find similar words
     * POST /api/vocabulary/ai/similar
     */
    @PostMapping("/similar")
    public ResponseEntity<VocabSimilarDto> findSimilarWords(@RequestBody VocabWordRequest request) {
        String word = request.word();
        if (word == null || word.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        List<String> similarWords = aiVocabularyService.findSimilarWords(word);
        return ResponseEntity.ok(new VocabSimilarDto(word, similarWords));
    }

    /**
     * Generate story using words
     * POST /api/vocabulary/ai/story
     */
    @PostMapping("/story")
    public ResponseEntity<VocabStoryDto> generateStory(@RequestBody VocabStoryRequest request) {
        List<String> words = request.words();
        if (words == null || words.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        String story = aiVocabularyService.generateStory(words);
        return ResponseEntity.ok(new VocabStoryDto(words, story));
    }

    /**
     * Explain etymology
     * POST /api/vocabulary/ai/etymology
     */
    @PostMapping("/etymology")
    public ResponseEntity<VocabEtymologyDto> explainEtymology(@RequestBody VocabWordRequest request) {
        String word = request.word();
        if (word == null || word.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        String etymology = aiVocabularyService.explainEtymology(word);
        return ResponseEntity.ok(new VocabEtymologyDto(word, etymology));
    }

    /**
     * Generate quiz questions
     * POST /api/vocabulary/ai/quiz
     */
    @PostMapping("/quiz")
    public ResponseEntity<VocabQuizDto> generateQuiz(@RequestBody VocabQuizRequest request) {
        List<String> words = request.words();
        if (words == null || words.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        int questionsPerWord = request.questionsPerWord() != null
                ? request.questionsPerWord()
                : DEFAULT_QUESTIONS_PER_WORD;
        List<QuizQuestion> quiz = aiVocabularyService.generateQuiz(words, questionsPerWord);
        return ResponseEntity.ok(new VocabQuizDto(words, quiz));
    }
}
