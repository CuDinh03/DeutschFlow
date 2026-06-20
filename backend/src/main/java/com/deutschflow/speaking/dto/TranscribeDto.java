package com.deutschflow.speaking.dto;

/** Response of {@code POST /api/ai-speaking/transcribe} — mirrors the legacy {@code {transcript}} map. */
public record TranscribeDto(String transcript) {}
