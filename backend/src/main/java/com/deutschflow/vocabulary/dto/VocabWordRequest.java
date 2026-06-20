package com.deutschflow.vocabulary.dto;

/** Request body for the single-word AI vocabulary endpoints: {@code /usage}, {@code /similar}, {@code /etymology}. */
public record VocabWordRequest(String word) {}
