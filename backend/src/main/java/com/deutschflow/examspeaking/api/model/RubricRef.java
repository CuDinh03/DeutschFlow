package com.deutschflow.examspeaking.api.model;

/** Tham chiếu bộ quy điểm: hệ × cấp × phiên bản blueprint. Kết quả lưu kèm phiên bản để tái chấm được. */
public record RubricRef(ExamProvider provider, String level, int version) {}
