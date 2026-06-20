package com.deutschflow.vocabulary.dto;

import java.util.List;

/** Response of {@code POST /api/vocabulary/ai/story} — mirrors the legacy {@code {words, story}} map. */
public record VocabStoryDto(List<String> words, String story) {}
