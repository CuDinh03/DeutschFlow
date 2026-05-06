package com.deutschflow.speaking.dto;

/** Lightweight quota snapshot for “start session” pre-checks (VN-calendar quota on server). */
public record AiSpeakingQuotaDto(boolean canStartSession, long remainingSpendable, String planCode) {}
