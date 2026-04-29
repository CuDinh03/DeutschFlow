package com.deutschflow.speaking.dto;

/**
 * Aggregated grammar weak point: how many times the user made this error.
 */
public record WeakPoint(String grammarPoint, long count) {}
