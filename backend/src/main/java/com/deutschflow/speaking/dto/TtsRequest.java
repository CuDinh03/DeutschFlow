package com.deutschflow.speaking.dto;

/**
 * Request body for {@code POST /api/ai-speaking/tts}. Both fields are optional on the wire — the
 * controller defaults a blank {@code text} to a 400 and a null {@code persona} to {@code "DEFAULT"},
 * matching the legacy {@code Map<String,String>} handling.
 */
public record TtsRequest(String text, String persona) {}
