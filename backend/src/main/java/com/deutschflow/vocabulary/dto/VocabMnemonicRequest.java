package com.deutschflow.vocabulary.dto;

/** Request body for {@code POST /api/vocabulary/ai/mnemonic}. {@code meaning} is optional (defaults to ""). */
public record VocabMnemonicRequest(String word, String meaning) {}
