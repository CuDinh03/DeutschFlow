package com.deutschflow.curriculum.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for the learning-tree state machine (§1). Pure — no Spring, no DB. Covers the
 * derivation at every level: node → branch → level → milestone.
 */
@DisplayName("TreeStateMachine")
class TreeStateMachineTest {

    /** Helper: a list of stored states with nulls (an untouched node). */
    private static List<String> stored(String... states) {
        return Arrays.asList(states);
    }

    @Nested
    @DisplayName("nodeStates: sequential unlock within a shoot")
    class NodeStates {

        @Test
        @DisplayName("first untouched node of an open shoot is available, the rest locked")
        void firstAvailableRestLocked() {
            assertThat(TreeStateMachine.nodeStates(stored(null, null, null)))
                    .containsExactly("available", "locked", "locked");
        }

        @Test
        @DisplayName("a completed node unlocks the next (which becomes available)")
        void completedUnlocksNext() {
            assertThat(TreeStateMachine.nodeStates(stored("completed", null, null)))
                    .containsExactly("completed", "available", "locked");
        }

        @Test
        @DisplayName("an in_progress node does NOT unlock its successor")
        void inProgressDoesNotUnlock() {
            assertThat(TreeStateMachine.nodeStates(stored("in_progress", null)))
                    .containsExactly("in_progress", "locked");
        }

        @Test
        @DisplayName("completed → in_progress → locked chain")
        void completedThenInProgress() {
            assertThat(TreeStateMachine.nodeStates(stored("completed", "in_progress", null)))
                    .containsExactly("completed", "in_progress", "locked");
        }

        @Test
        @DisplayName("all completed stays completed")
        void allCompleted() {
            assertThat(TreeStateMachine.nodeStates(stored("completed", "completed")))
                    .containsExactly("completed", "completed");
        }

        @Test
        @DisplayName("empty shoot yields no node states")
        void empty() {
            assertThat(TreeStateMachine.nodeStates(List.of())).isEmpty();
        }
    }

    @Nested
    @DisplayName("branchStatus")
    class BranchStatus {

        @Test
        @DisplayName("no nodes → locked")
        void noNodes() {
            assertThat(TreeStateMachine.branchStatus(List.of())).isEqualTo("locked");
        }

        @Test
        @DisplayName("every node completed → matured")
        void allCompleted() {
            assertThat(TreeStateMachine.branchStatus(List.of("completed", "completed"))).isEqualTo("matured");
        }

        @Test
        @DisplayName("open but unstarted (only available/locked) → growing")
        void openUnstarted() {
            assertThat(TreeStateMachine.branchStatus(List.of("available", "locked"))).isEqualTo("growing");
        }

        @Test
        @DisplayName("some completed, some not → growing")
        void partial() {
            assertThat(TreeStateMachine.branchStatus(List.of("completed", "in_progress", "locked")))
                    .isEqualTo("growing");
        }

        @Test
        @DisplayName("nothing available or started → locked")
        void nothingActive() {
            assertThat(TreeStateMachine.branchStatus(List.of("locked", "locked"))).isEqualTo("locked");
        }
    }

    @Nested
    @DisplayName("levelStatus")
    class LevelStatus {

        @Test
        @DisplayName("below current level → completed")
        void below() {
            assertThat(TreeStateMachine.levelStatus(1, 3, false)).isEqualTo("completed");
        }

        @Test
        @DisplayName("at current level → current")
        void atCurrent() {
            assertThat(TreeStateMachine.levelStatus(3, 3, false)).isEqualTo("current");
        }

        @Test
        @DisplayName("above current level → locked")
        void above() {
            assertThat(TreeStateMachine.levelStatus(4, 3, false)).isEqualTo("locked");
        }

        @Test
        @DisplayName("a passed milestone forces completed even at/above current")
        void passedOverride() {
            assertThat(TreeStateMachine.levelStatus(3, 3, true)).isEqualTo("completed");
            assertThat(TreeStateMachine.levelStatus(5, 3, true)).isEqualTo("completed");
        }
    }

    @Nested
    @DisplayName("milestoneState")
    class MilestoneState {

        @Test
        @DisplayName("completed level → passed")
        void completedPassed() {
            assertThat(TreeStateMachine.milestoneState("completed", false)).isEqualTo("passed");
        }

        @Test
        @DisplayName("current level with 4 branches matured → ready")
        void currentReady() {
            assertThat(TreeStateMachine.milestoneState("current", true)).isEqualTo("ready");
        }

        @Test
        @DisplayName("current level not yet 4 matured → in_progress")
        void currentInProgress() {
            assertThat(TreeStateMachine.milestoneState("current", false)).isEqualTo("in_progress");
        }

        @Test
        @DisplayName("locked level → locked")
        void lockedLevel() {
            assertThat(TreeStateMachine.milestoneState("locked", false)).isEqualTo("locked");
        }
    }
}
