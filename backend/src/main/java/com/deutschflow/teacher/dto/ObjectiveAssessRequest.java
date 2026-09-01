package com.deutschflow.teacher.dto;

/** Đánh giá một (học viên, mục tiêu) — PR-9. Đánh giá lại supersede bản cũ, lịch sử giữ nguyên. */
public record ObjectiveAssessRequest(Long studentId, Long objectiveId, String status, String evidence) {}
