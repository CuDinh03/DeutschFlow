package com.deutschflow.curriculum.controller;

import com.deutschflow.curriculum.dto.tree.TreeDto;
import com.deutschflow.curriculum.dto.tree.TreeNodeLessonDto;
import com.deutschflow.curriculum.service.RoadmapTreeService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The learning tree ("Cây học tập") for the authenticated learner — the manifest tree of
 * level → branch[skill] → shoot[topic] → leaf[lesson] consumed by the v2 SVG renderer. Distinct
 * from the legacy week/day roadmap on {@link RoadmapController} ({@code /api/roadmap/me}).
 *
 * <p>See {@code docs/UI_2.0_LEARNING_TREE_DESIGN.md} §3.
 */
@RestController
@RequestMapping("/api/roadmap/tree")
@RequiredArgsConstructor
public class RoadmapTreeController {

    private final RoadmapTreeService roadmapTreeService;

    /** Full tree (user header + path of levels with derived states) for the current learner. */
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public TreeDto getTree(@AuthenticationPrincipal User user) {
        return roadmapTreeService.getTree(user.getId());
    }

    /** Lesson descriptor for a single leaf — the context the FE lesson player loads on tap. */
    @GetMapping("/node/{id}")
    @PreAuthorize("isAuthenticated()")
    public TreeNodeLessonDto getNode(@PathVariable("id") String id) {
        return roadmapTreeService.getNodeLesson(id);
    }

    /** Marks a leaf completed for the current learner; returns the recomputed tree (the tree "grows"). */
    @PostMapping("/node/{id}/complete")
    @PreAuthorize("isAuthenticated()")
    public TreeDto completeNode(@AuthenticationPrincipal User user, @PathVariable("id") String id) {
        return roadmapTreeService.completeNode(user.getId(), id);
    }
}
