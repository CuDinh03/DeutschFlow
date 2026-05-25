package com.deutschflow.teacher.dto;

public record TeacherSessionEvaluationRequest(
        Integer teacherScore,
        String teacherFeedback
) {}
