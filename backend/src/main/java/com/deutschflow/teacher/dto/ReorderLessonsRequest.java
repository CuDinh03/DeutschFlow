package com.deutschflow.teacher.dto;

import java.util.List;

public record ReorderLessonsRequest(List<Long> orderedLessonIds) {}
