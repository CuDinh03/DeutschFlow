package com.deutschflow.vocabulary.dto;

/** Response of {@code POST /api/vocabulary/ai/mnemonic} — mirrors the legacy {@code {word, mnemonic}} map. */
public record VocabMnemonicDto(String word, String mnemonic) {}
