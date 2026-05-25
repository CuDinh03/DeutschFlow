package com.deutschflow.notification.events;

public record QuizAssignedEvent(
        Long classroomId,
        Long quizId,
        String quizTitle,
        String teacherName,
        String classroomName
) {
}
