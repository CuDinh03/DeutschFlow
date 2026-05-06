package com.deutschflow.vocabulary.service;

import com.deutschflow.ai.AIModelService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Service for AI-powered vocabulary features.
 *
 * All deterministic methods are cached (Caffeine) to avoid redundant Groq API calls:
 *  - aiVocabCache (24h): examples, usage, mnemonic, similar, etymology
 *  - aiVocabShort (6h):  story (semi-deterministic, creative)
 *  - aiVocabQuiz  (1h):  quiz questions (keep variety by refreshing more often)
 *
 * Cache keys are word-based — same word always returns same cached result.
 * Contextual AI calls (chat turns, error corrections) are NOT cached here.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AIVocabularyService {

    private final AIModelService aiModelService;

    /**
     * Generate example sentences for a German word.
     * Cached 24h — same word/count always produces equivalent examples.
     */
    @Cacheable(value = "aiVocabCache", key = "'examples:' + #germanWord + ':' + #count")
    public List<String> generateExamples(String germanWord, int count) {
        log.info("[AIVocab] Generating {} examples for word: {} (cache miss)", count, germanWord);
        try {
            String instruction = String.format(
                "Generate %d example sentences in German using the word '%s'. " +
                "Each sentence should demonstrate a different usage or context. " +
                "Number each sentence (1., 2., etc.).",
                count, germanWord
            );
            String response = aiModelService.generate(instruction, "", 512, 0.8);
            return parseNumberedSentences(response);
        } catch (Exception e) {
            log.error("[AIVocab] Error generating examples for '{}'", germanWord, e);
            throw new RuntimeException("Example generation failed: " + e.getMessage(), e);
        }
    }

    /**
     * Explain word usage and context.
     * Cached 24h.
     */
    @Cacheable(value = "aiVocabCache", key = "'usage:' + #germanWord")
    public String explainUsage(String germanWord) {
        log.info("[AIVocab] Explaining usage for word: {} (cache miss)", germanWord);
        try {
            String instruction = String.format(
                "Explain how to use the German word '%s'. " +
                "Include: meaning, common contexts, grammar notes, and any special usage rules.",
                germanWord
            );
            return aiModelService.generate(instruction, "", 512, 0.7);
        } catch (Exception e) {
            log.error("[AIVocab] Error explaining usage for '{}'", germanWord, e);
            throw new RuntimeException("Usage explanation failed: " + e.getMessage(), e);
        }
    }

    /**
     * Generate mnemonic device for remembering a word.
     * Cached 24h — mnemonic is deterministic per word.
     */
    @Cacheable(value = "aiVocabCache", key = "'mnemonic:' + #germanWord")
    public String generateMnemonic(String germanWord, String meaning) {
        log.info("[AIVocab] Generating mnemonic for: {} (cache miss)", germanWord);
        try {
            String instruction = String.format(
                "Create a creative mnemonic device to help remember that the German word '%s' means '%s'. " +
                "Make it memorable and fun.",
                germanWord, meaning
            );
            return aiModelService.generate(instruction, "", 256, 0.9);
        } catch (Exception e) {
            log.error("[AIVocab] Error generating mnemonic for '{}'", germanWord, e);
            throw new RuntimeException("Mnemonic generation failed: " + e.getMessage(), e);
        }
    }

    /**
     * Find similar or related words.
     * Cached 24h.
     */
    @Cacheable(value = "aiVocabCache", key = "'similar:' + #germanWord")
    public List<String> findSimilarWords(String germanWord) {
        log.info("[AIVocab] Finding similar words for: {} (cache miss)", germanWord);
        try {
            String instruction = String.format(
                "List 5 German words that are similar to or related to '%s'. " +
                "Include synonyms, antonyms, or words from the same word family. " +
                "Format: one word per line.",
                germanWord
            );
            String response = aiModelService.generate(instruction, "", 256, 0.7);
            return parseLines(response);
        } catch (Exception e) {
            log.error("[AIVocab] Error finding similar words for '{}'", germanWord, e);
            throw new RuntimeException("Similar word search failed: " + e.getMessage(), e);
        }
    }

    /**
     * Generate a story using multiple vocabulary words.
     * Cached 6h (aiVocabShort) — story is creative, allow refresh more often.
     */
    @Cacheable(value = "aiVocabShort", key = "'story:' + T(String).join(',', #words)")
    public String generateStory(List<String> words) {
        log.info("[AIVocab] Generating story with {} words (cache miss)", words.size());
        try {
            String wordList = String.join(", ", words);
            String instruction = String.format(
                "Write a short story in German (5-7 sentences) that naturally uses these words: %s. " +
                "Make it interesting and appropriate for German learners.",
                wordList
            );
            return aiModelService.generate(instruction, "", 512, 0.8);
        } catch (Exception e) {
            log.error("[AIVocab] Error generating story", e);
            throw new RuntimeException("Story generation failed: " + e.getMessage(), e);
        }
    }

    /**
     * Explain word etymology.
     * Cached 24h — etymology is factual/deterministic.
     */
    @Cacheable(value = "aiVocabCache", key = "'etymology:' + #germanWord")
    public String explainEtymology(String germanWord) {
        log.info("[AIVocab] Explaining etymology for: {} (cache miss)", germanWord);
        try {
            String instruction = String.format(
                "Explain the etymology and origin of the German word '%s'. " +
                "Include historical development and related words in other languages if relevant.",
                germanWord
            );
            return aiModelService.generate(instruction, "", 512, 0.7);
        } catch (Exception e) {
            log.error("[AIVocab] Error explaining etymology for '{}'", germanWord, e);
            throw new RuntimeException("Etymology explanation failed: " + e.getMessage(), e);
        }
    }

    /**
     * Generate quiz questions for vocabulary.
     * Cached 1h (aiVocabQuiz) — refresh more often to keep variety.
     */
    @Cacheable(value = "aiVocabQuiz", key = "'quiz:' + T(String).join(',', #words) + ':' + #questionsPerWord")
    public List<QuizQuestion> generateQuiz(List<String> words, int questionsPerWord) {
        log.info("[AIVocab] Generating quiz for {} words (cache miss)", words.size());
        List<QuizQuestion> questions = new ArrayList<>();
        for (String word : words) {
            try {
                String instruction = String.format(
                    "Create %d multiple-choice quiz questions to test knowledge of the German word '%s'. " +
                    "Format each question as: Q: [question] A) [option] B) [option] C) [option] D) [option] Correct: [letter]",
                    questionsPerWord, word
                );
                String response = aiModelService.generate(instruction, "", 512, 0.7);
                QuizQuestion question = new QuizQuestion();
                question.setWord(word);
                question.setContent(response);
                questions.add(question);
            } catch (Exception e) {
                log.error("[AIVocab] Error generating quiz for word: {}", word, e);
            }
        }
        return questions;
    }

    // ── Helper methods ────────────────────────────────────────────────

    private List<String> parseNumberedSentences(String text) {
        List<String> sentences = new ArrayList<>();
        String[] lines = text.split("\\n");
        for (String line : lines) {
            line = line.trim();
            if (line.matches("^\\d+[.)\\-].*")) {
                String sentence = line.replaceFirst("^\\d+[.)\\-]\\s*", "").trim();
                if (!sentence.isEmpty()) sentences.add(sentence);
            }
        }
        return sentences;
    }

    private List<String> parseLines(String text) {
        List<String> lines = new ArrayList<>();
        String[] parts = text.split("\\n");
        for (String part : parts) {
            part = part.trim();
            part = part.replaceFirst("^[\\-\\*\\d+[.)\\]]\\s*", "").trim();
            if (!part.isEmpty() && part.length() < 50) lines.add(part);
        }
        return lines;
    }

    // ── DTOs ──────────────────────────────────────────────────────────

    @lombok.Data
    public static class QuizQuestion {
        private String word;
        private String content;
    }
}
