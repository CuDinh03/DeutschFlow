package com.deutschflow.curriculum.dto;

/**
 * A single node in the personalized learning roadmap.
 */
public record RoadmapNodeDto(
        int id,
        String title,
        String subtitle,
        String emoji,
        /** "completed" | "current" | "locked" */
        String state,
        int xpReward,
        int lessonsTotal,
        int lessonsCompleted,
        String category,
        String description
) {}
