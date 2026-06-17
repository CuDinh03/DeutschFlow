package com.deutschflow.curriculum.dto.tree;

/**
 * The level-up gate. {@code state} is {@code passed} | {@code ready} (4 branches matured → invite
 * to test) | {@code in_progress} | {@code locked}. {@code passedAt} is non-null only when passed;
 * {@code unlocksWhen} describes the gate for not-yet-passed milestones.
 */
public record TreeMilestoneDto(
        String id,
        String title,
        String state,
        String passedAt,
        String unlocksWhen
) {}
