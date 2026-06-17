package com.deutschflow.curriculum.dto.tree;

import java.util.List;

/**
 * A skill branch on a level. {@code status} is {@code matured} (all nodes completed) |
 * {@code growing} (some progress / open) | {@code locked} (nothing available). {@code nodeCap} is
 * the FE soft cap on drawn leaves per branch.
 */
public record TreeBranchDto(
        String skill,
        String label,
        String status,
        int nodeCap,
        List<TreeShootDto> shoots
) {}
