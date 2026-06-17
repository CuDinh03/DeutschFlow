package com.deutschflow.curriculum.dto.tree;

import java.util.List;

/**
 * A topic growing off a branch. {@code chosenByUser} is true when the topic's track matches the
 * learner's track (the FE highlights self-relevant shoots).
 */
public record TreeShootDto(
        String topicId,
        String topicLabel,
        String topicGroup,
        int unlockOrder,
        boolean chosenByUser,
        List<TreeNodeDto> nodes
) {}
