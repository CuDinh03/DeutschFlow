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
 * A learner's progress on a single node. Only touched nodes are stored — {@code available} and
 * {@code locked} states are derived at read time by the state machine (§1), so this table holds
 * just {@code in_progress} and {@code completed}.
 */
@Entity
@Table(name = "tree_node_progress")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TreeNodeProgress {

    public static final String IN_PROGRESS = "in_progress";
    public static final String COMPLETED = "completed";

    @EmbeddedId
    private TreeNodeProgressId id;

    /** {@code in_progress} | {@code completed}. */
    @Column(nullable = false, length = 16)
    private String state;

    private Integer score;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;
}
