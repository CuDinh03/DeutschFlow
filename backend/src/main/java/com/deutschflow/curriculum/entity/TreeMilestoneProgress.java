package com.deutschflow.curriculum.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Records that a learner has passed a level's milestone (the level-up exam). Only the {@code passed}
 * state is stored; {@code ready}/{@code in_progress}/{@code locked} are derived at read time (§1).
 */
@Entity
@Table(name = "tree_milestone_progress")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TreeMilestoneProgress {

    public static final String PASSED = "passed";

    @EmbeddedId
    private TreeMilestoneProgressId id;

    /** Currently always {@code passed}; other states are derived, not stored. */
    @Column(nullable = false, length = 16)
    private String state;

    @Column(name = "passed_at")
    private LocalDateTime passedAt;
}
