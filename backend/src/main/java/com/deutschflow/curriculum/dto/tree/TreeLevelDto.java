package com.deutschflow.curriculum.dto.tree;

import java.util.List;

/**
 * One CEFR level in the path. {@code status} is {@code completed} | {@code current} | {@code locked}.
 * Locked levels carry an empty {@code branches} list (nothing to render yet).
 */
public record TreeLevelDto(
        String level,
        String status,
        TreeMilestoneDto milestone,
        List<TreeBranchDto> branches
) {}
