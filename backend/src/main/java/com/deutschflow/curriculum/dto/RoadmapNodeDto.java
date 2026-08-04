package com.deutschflow.curriculum.dto;

import java.util.Map;

/**
 * A single node in the personalized learning roadmap.
 */
public record RoadmapNodeDto(
        int id,
        String code,
        String title,
        String subtitle,
        String emoji,
        /** "completed" | "current" | "locked" */
        String state,
        int xpReward,
        int lessonsTotal,
        int lessonsCompleted,
        String category,
        String description,
        String cefrLevel,
        String prerequisiteCode,
        Integer orderIndex,
        /** Curriculum day, 1-based (A1 runs 1..30). Null for nodes outside the dated spine. */
        Integer dayNumber,
        /** Curriculum week, 1-based. Null for nodes outside the dated spine. */
        Integer weekNumber,
        /**
         * "COMPLETED" | "IN_PROGRESS" | "AVAILABLE" | "LOCKED" — a refinement of {@link #state}, which
         * collapses "offered but not started" and "being worked on" into a single "current". A tree UI
         * needs them apart (bud vs flower); a list UI does not. Already normalized: the DB's
         * {@code UNLOCKED} is reported as {@code AVAILABLE}, so clients need no status aliasing.
         */
        String progressStatus,
        /**
         * Authored exercise count per skill, e.g. {@code {"HOEREN":3,"LESEN":2}}. Empty — never null —
         * for nodes with no authored 4-skill set. Keys follow the German skill names used throughout
         * the practice runner.
         */
        Map<String, Integer> skillCounts
) {}
