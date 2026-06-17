package com.deutschflow.curriculum.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A CEFR level (A0…C2) — one rung of the learning tree's trunk. Data-driven (a row per level)
 * instead of a hard enum so the curriculum team can re-label milestones without code changes.
 * See {@code docs/UI_2.0_LEARNING_TREE_DESIGN.md} §2.
 */
@Entity
@Table(name = "tree_levels")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TreeLevel {

    @Id
    @Column(length = 4)
    private String code;

    @Column(name = "order_index", nullable = false)
    private int orderIndex;

    @Column(name = "label_vi", nullable = false, length = 80)
    private String labelVi;

    @Column(name = "milestone_title", nullable = false, length = 160)
    private String milestoneTitle;

    @Column(name = "unlock_rule", nullable = false, length = 120)
    private String unlockRule;
}
