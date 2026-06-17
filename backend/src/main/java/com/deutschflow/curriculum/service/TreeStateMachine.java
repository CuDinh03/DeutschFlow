package com.deutschflow.curriculum.service;

import java.util.ArrayList;
import java.util.List;

/**
 * The learning-tree state machine — pure, dependency-free derivation of node → branch → level →
 * milestone states from stored progress, per {@code docs/UI_2.0_LEARNING_TREE_DESIGN.md} §1.
 *
 * <p>Only {@code completed}/{@code in_progress} are ever stored per node; {@code available} and
 * {@code locked} are derived here. Keeping this logic free of JPA/Spring makes the rules trivially
 * unit-testable and gives a single place to change the curriculum gating.
 */
public final class TreeStateMachine {

    private TreeStateMachine() {}

    // Node states
    public static final String COMPLETED = "completed";
    public static final String IN_PROGRESS = "in_progress";
    public static final String AVAILABLE = "available";
    public static final String LOCKED = "locked";

    // Branch states
    public static final String MATURED = "matured";
    public static final String GROWING = "growing";

    // Level states
    public static final String CURRENT = "current";

    // Milestone states
    public static final String PASSED = "passed";
    public static final String READY = "ready";

    /** The four skills must all be matured for a milestone to become {@code ready}. */
    public static final int SKILLS_PER_LEVEL = 4;

    /**
     * Derives the display state of each node in a shoot, in order. {@code storedStates[i]} is the
     * persisted state for node {@code i} ({@link #COMPLETED}, {@link #IN_PROGRESS}, or {@code null}
     * when untouched). The first node of an open shoot is {@link #AVAILABLE}; a node becomes
     * available only once the preceding node is {@link #COMPLETED} (an {@code in_progress} node does
     * not yet unlock its successor).
     */
    public static List<String> nodeStates(List<String> storedStates) {
        List<String> out = new ArrayList<>(storedStates.size());
        boolean unlockNext = true; // shoot is open → first node is available
        for (String stored : storedStates) {
            if (COMPLETED.equals(stored)) {
                out.add(COMPLETED);
                unlockNext = true;
            } else if (IN_PROGRESS.equals(stored)) {
                out.add(IN_PROGRESS);
                unlockNext = false;
            } else {
                out.add(unlockNext ? AVAILABLE : LOCKED);
                unlockNext = false;
            }
        }
        return out;
    }

    /**
     * Derives a branch's status from the display states of all its nodes (across every shoot):
     * {@link #MATURED} when every node is completed, {@link #LOCKED} when nothing is open or started,
     * otherwise {@link #GROWING}.
     */
    public static String branchStatus(List<String> nodeStates) {
        if (nodeStates.isEmpty()) {
            return LOCKED;
        }
        boolean allCompleted = true;
        boolean anyActive = false; // completed, in_progress, or available
        for (String s : nodeStates) {
            if (!COMPLETED.equals(s)) {
                allCompleted = false;
            }
            if (COMPLETED.equals(s) || IN_PROGRESS.equals(s) || AVAILABLE.equals(s)) {
                anyActive = true;
            }
        }
        if (allCompleted) {
            return MATURED;
        }
        return anyActive ? GROWING : LOCKED;
    }

    /**
     * Derives a level's status. A level is {@link #COMPLETED} once its milestone is passed or it
     * sits below the learner's current level, {@link #CURRENT} at the learner's current level, and
     * {@link #LOCKED} above it.
     */
    public static String levelStatus(int levelOrder, int currentOrder, boolean milestonePassed) {
        if (milestonePassed || levelOrder < currentOrder) {
            return COMPLETED;
        }
        return levelOrder == currentOrder ? CURRENT : LOCKED;
    }

    /**
     * Derives a milestone's state from its level's status and whether all four branches are matured:
     * {@link #PASSED} for a completed level, {@link #READY}/{@link #IN_PROGRESS} for the current
     * level (depending on whether the four-matured gate is met), {@link #LOCKED} otherwise.
     */
    public static String milestoneState(String levelStatus, boolean allFourMatured) {
        if (COMPLETED.equals(levelStatus)) {
            return PASSED;
        }
        if (CURRENT.equals(levelStatus)) {
            return allFourMatured ? READY : IN_PROGRESS;
        }
        return LOCKED;
    }
}
