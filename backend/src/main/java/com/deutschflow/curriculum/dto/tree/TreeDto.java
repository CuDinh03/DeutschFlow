package com.deutschflow.curriculum.dto.tree;

import java.util.List;

/**
 * The whole learning tree for one learner. Shape matches the FE manifest 1:1
 * (see {@code docs/UI_2.0_LEARNING_TREE_DESIGN.md} §1) so the SVG renderer consumes it directly.
 */
public record TreeDto(
        TreeUserDto user,
        List<TreeLevelDto> path
) {
    /** Learner header — display only; identity/track/goal come from the user + learning profile. */
    public record TreeUserDto(
            String id,
            String displayName,
            String track,
            String goal,
            String currentLevel,
            String startedAt
    ) {}
}
