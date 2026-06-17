package com.deutschflow.curriculum.dto.tree;

/**
 * A leaf (lesson) in the tree. {@code title} is the German lesson title; {@code state} is
 * {@code completed} | {@code in_progress} | {@code available} | {@code locked} (derived per §1).
 */
public record TreeNodeDto(
        String id,
        String title,
        String state
) {}
