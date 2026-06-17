package com.deutschflow.curriculum.dto.tree;

/**
 * The lesson descriptor returned when a learner taps a leaf. Carries the semantic context the FE
 * lesson player needs plus the {@code contentKey} hook the content pipeline resolves to a lesson
 * body (full content-gen is wired in the FE lesson-player pass — §5). {@code title} is the German
 * lesson title; {@code skill}/{@code topic}/{@code group} are codes; {@code topicLabel} is the
 * Vietnamese topic label for display.
 */
public record TreeNodeLessonDto(
        String id,
        String title,
        String skill,
        String topic,
        String topicLabel,
        String group,
        String contentKey
) {}
