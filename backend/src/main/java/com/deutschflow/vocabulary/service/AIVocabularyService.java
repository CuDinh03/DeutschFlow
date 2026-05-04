package com.deutschflow.vocabulary.service;

import com.deutschflow.ai.AIModelService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Service for AI-powered vocabulary features
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AIVocabularyService {
    
    private final AIModelService aiModelService;
    
    /**
     * Generate example sentences for a German word
     */
    public List<String> generateExamples(String germanWord, int count) {
        log.info("Generating {} examples for word: {}", count, germanWord);
        
        try {
            String instruction = String.format(
                "Generate %d example sentences in German using the word '%s'. " +
                "Each sentence should demonstrate a different usage or context. " +
                "Number each sentence (1., 2., etc.).",
                count, germanWord
            );
            
            String response = aiModelService.generate(instruction, "", 512, 0.8);
            
            // Parse numbered sentences
            return parseNumberedSentences(response);
            
        } catch (Exception e) {
            log.error("Error generating examples", e);
            throw new RuntimeException("Example generation failed: " + e.getMessage(), e);
        }
    }
    
    /**
     * Explain word usage and context
     */
    public String explainUsage(String germanWord) {
        log.info("Explaining usage for word: {}", germanWord);
        
        try {
            String instruction = String.format(
                "Explain how to use the German word '%s'. " +
                "Include: meaning, common contexts, grammar notes, and any special usage rules.",
                germanWord
            );
            
            return aiModelService.generate(instruction, "", 512, 0.7);
            
        } catch (Exception e) {
            log.error("Error explaining usage", e);
            throw new RuntimeException("Usage explanation failed: " + e.getMessage(), e);
        }
    }
    
    /**
     * Generate mnemonic device for remembering a word
     */
    public String generateMnemonic(String germanWord, String meaning) {
        log.info("Generating mnemonic for: {} ({})", germanWord, meaning);
        
        try {
            String instruction = String.format(
                "Create a creative mnemonic device to help remember that the German word '%s' means '%s'. " +
                "Make it memorable and fun.",
                germanWord, meaning
            );
            
            return aiModelService.generate(instruction, "", 256, 0.9);
            
        } catch (Exception e) {
            log.error("Error generating mnemonic", e);
            throw new RuntimeException("Mnemonic generation failed: " + e.getMessage(), e);
        }
    }
    
    /**
     * Find similar or related words
     */
    public List<String> findSimilarWords(String germanWord) {
        log.info("Finding similar words for: {}", germanWord);
        
        try {
            String instruction = String.format(
                "List 5 German words that are similar to or related to '%s'. " +
                "Include synonyms, antonyms, or words from the same word family. " +
                "Format: one word per line.",
                germanWord
            );
            
            String response = aiModelService.generate(instruction, "", 256, 0.7);
            
            // Parse line-separated words
            return parseLines(response);
            
        } catch (Exception e) {
            log.error("Error finding similar words", e);
            throw new RuntimeException("Similar word search failed: " + e.getMessage(), e);
        }
    }
    
    /**
     * Generate a story using multiple vocabulary words
     */
    public String generateStory(List<String> words) {
        log.info("Generating story with {} words", words.size());
        
        try {
            String wordList = String.join(", ", words);
            String instruction = String.format(
                "Write a short story in German (5-7 sentences) that naturally uses these words: %s. " +
                "Make it interesting and appropriate for German learners.",
                wordList
            );
            
            return aiModelService.generate(instruction, "", 512, 0.8);
            
        } catch (Exception e) {
            log.error("Error generating story", e);
            throw new RuntimeException("Story generation failed: " + e.getMessage(), e);
        }
    }
    
    /**
     * Explain word etymology
     */
    public String explainEtymology(String germanWord) {
        log.info("Explaining etymology for: {}", germanWord);
        
        try {
            String instruction = String.format(
                "Explain the etymology and origin of the German word '%s'. " +
                "Include historical development and related words in other languages if relevant.",
                germanWord
            );
            
            return aiModelService.generate(instruction, "", 512, 0.7);
            
        } catch (Exception e) {
            log.error("Error explaining etymology", e);
            throw new RuntimeException("Etymology explanation failed: " + e.getMessage(), e);
        }
    }
    
    /**
     * Generate quiz questions for vocabulary
     */
    public List<QuizQuestion> generateQuiz(List<String> words, int questionsPerWord) {
        log.info("Generating quiz for {} words", words.size());
        
        List<QuizQuestion> questions = new ArrayList<>();
        
        for (String word : words) {
            try {
                String instruction = String.format(
                    "Create %d multiple-choice quiz questions to test knowledge of the German word '%s'. " +
                    "Format each question as: Q: [question] A) [option] B) [option] C) [option] D) [option] Correct: [letter]",
                    questionsPerWord, word
                );
                
                String response = aiModelService.generate(instruction, "", 512, 0.7);
                
                // Parse quiz questions (simplified - would need better parsing in production)
                QuizQuestion question = new QuizQuestion();
                question.setWord(word);
                question.setContent(response);
                questions.add(question);
                
            } catch (Exception e) {
                log.error("Error generating quiz for word: {}", word, e);
            }
        }
        
        return questions;
    }
    
    // Helper methods
    
    private List<String> parseNumberedSentences(String text) {
        List<String> sentences = new ArrayList<>();
        String[] lines = text.split("\\n");
        
        for (String line : lines) {
            line = line.trim();
            // Match patterns like "1.", "1)", "1 -", etc.
            if (line.matches("^\\d+[.)\\-].*")) {
                // Remove the number prefix
                String sentence = line.replaceFirst("^\\d+[.)\\-]\\s*", "").trim();
                if (!sentence.isEmpty()) {
                    sentences.add(sentence);
                }
            }
        }
        
        return sentences;
    }
    
    private List<String> parseLines(String text) {
        List<String> lines = new ArrayList<>();
        String[] parts = text.split("\\n");
        
        for (String part : parts) {
            part = part.trim();
            // Remove bullet points, numbers, etc.
            part = part.replaceFirst("^[\\-\\*\\d+[.)\\]]\\s*", "").trim();
            if (!part.isEmpty() && part.length() < 50) { // Reasonable word length
                lines.add(part);
            }
        }
        
        return lines;
    }
    
    // DTOs
    
    @lombok.Data
    public static class QuizQuestion {
        private String word;
        private String content;
    }
}
