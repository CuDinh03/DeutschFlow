package com.deutschflow.vocabulary.controller;

import com.deutschflow.vocabulary.service.AIVocabularyService;
import com.deutschflow.vocabulary.service.AIVocabularyService.QuizQuestion;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

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
    
    private final AIVocabularyService aiVocabularyService;
    
    /**
     * Generate example sentences for a word
     * POST /api/vocabulary/ai/examples
     */
    @PostMapping("/examples")
    public ResponseEntity<Map<String, Object>> generateExamples(@RequestBody Map<String, Object> request) {
        String word = (String) request.get("word");
        Integer count = request.containsKey("count") ? (Integer) request.get("count") : 3;
        
        if (word == null || word.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        
        List<String> examples = aiVocabularyService.generateExamples(word, count);
        return ResponseEntity.ok(Map.of(
            "word", word,
            "examples", examples
        ));
    }
    
    /**
     * Explain word usage
     * POST /api/vocabulary/ai/usage
     */
    @PostMapping("/usage")
    public ResponseEntity<Map<String, String>> explainUsage(@RequestBody Map<String, String> request) {
        String word = request.get("word");
        
        if (word == null || word.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        
        String usage = aiVocabularyService.explainUsage(word);
        return ResponseEntity.ok(Map.of(
            "word", word,
            "usage", usage
        ));
    }
    
    /**
     * Generate mnemonic device
     * POST /api/vocabulary/ai/mnemonic
     */
    @PostMapping("/mnemonic")
    public ResponseEntity<Map<String, String>> generateMnemonic(@RequestBody Map<String, String> request) {
        String word = request.get("word");
        String meaning = request.get("meaning");
        
        if (word == null || word.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        
        String mnemonic = aiVocabularyService.generateMnemonic(word, meaning != null ? meaning : "");
        return ResponseEntity.ok(Map.of(
            "word", word,
            "mnemonic", mnemonic
        ));
    }
    
    /**
     * Find similar words
     * POST /api/vocabulary/ai/similar
     */
    @PostMapping("/similar")
    public ResponseEntity<Map<String, Object>> findSimilarWords(@RequestBody Map<String, String> request) {
        String word = request.get("word");
        
        if (word == null || word.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        
        List<String> similarWords = aiVocabularyService.findSimilarWords(word);
        return ResponseEntity.ok(Map.of(
            "word", word,
            "similarWords", similarWords
        ));
    }
    
    /**
     * Generate story using words
     * POST /api/vocabulary/ai/story
     */
    @PostMapping("/story")
    public ResponseEntity<Map<String, Object>> generateStory(@RequestBody Map<String, List<String>> request) {
        List<String> words = request.get("words");
        
        if (words == null || words.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        
        String story = aiVocabularyService.generateStory(words);
        return ResponseEntity.ok(Map.of(
            "words", words,
            "story", story
        ));
    }
    
    /**
     * Explain etymology
     * POST /api/vocabulary/ai/etymology
     */
    @PostMapping("/etymology")
    public ResponseEntity<Map<String, String>> explainEtymology(@RequestBody Map<String, String> request) {
        String word = request.get("word");
        
        if (word == null || word.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        
        String etymology = aiVocabularyService.explainEtymology(word);
        return ResponseEntity.ok(Map.of(
            "word", word,
            "etymology", etymology
        ));
    }
    
    /**
     * Generate quiz questions
     * POST /api/vocabulary/ai/quiz
     */
    @PostMapping("/quiz")
    public ResponseEntity<Map<String, Object>> generateQuiz(@RequestBody Map<String, Object> request) {
        @SuppressWarnings("unchecked")
        List<String> words = (List<String>) request.get("words");
        Integer questionsPerWord = request.containsKey("questionsPerWord") ? 
                                   (Integer) request.get("questionsPerWord") : 2;
        
        if (words == null || words.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        
        List<QuizQuestion> quiz = aiVocabularyService.generateQuiz(words, questionsPerWord);
        return ResponseEntity.ok(Map.of(
            "words", words,
            "questions", quiz
        ));
    }
}
