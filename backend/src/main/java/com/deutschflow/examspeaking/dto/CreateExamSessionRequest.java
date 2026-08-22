package com.deutschflow.examspeaking.dto;

/** @param mode DRILL | MOCK · @param teil chỉ dùng cho DRILL (luyện một Teil). */
public record CreateExamSessionRequest(String provider, String level, String mode, Integer teil) {}
