package com.deutschflow.vocabulary.dto;

import com.deutschflow.vocabulary.service.AIVocabularyService.QuizQuestion;

import java.util.List;

/**
 * Response of {@code POST /api/vocabulary/ai/quiz} — mirrors the legacy {@code {words, questions}} map.
 * Each {@link QuizQuestion} is the existing service type serializing to {@code {word, content}} (the raw
 * AI multiple-choice block lives in {@code content} — deliberately a free-form string, not parsed).
 */
public record VocabQuizDto(List<String> words, List<QuizQuestion> questions) {}
