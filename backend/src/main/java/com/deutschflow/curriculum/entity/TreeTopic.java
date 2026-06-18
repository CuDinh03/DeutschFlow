package com.deutschflow.curriculum.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A topic taught for a given (level, skill) — i.e. a "shoot" growing off a skill branch. The same
 * logical {@link #topicId} (e.g. {@code "nursing_care"}) may recur across skills/levels as separate
 * rows. {@link #track} ties a topic to a learner track ({@code "nursing"}, {@code "it"}…); a null
 * track means the topic is general. See {@code docs/UI_2.0_LEARNING_TREE_DESIGN.md} §1–§2.
 */
@Entity
@Table(name = "tree_topics")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TreeTopic {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "level_code", nullable = false, length = 4)
    private String levelCode;

    @Column(name = "skill_code", nullable = false, length = 16)
    private String skillCode;

    @Column(name = "topic_id", nullable = false, length = 64)
    private String topicId;

    @Column(name = "topic_label", nullable = false, length = 160)
    private String topicLabel;

    @Column(name = "group_code", nullable = false, length = 16)
    private String groupCode;

    @Column(name = "unlock_order", nullable = false)
    @Builder.Default
    private int unlockOrder = 1;

    /** Learner track this topic is tailored to; {@code null} = general (shown to everyone). */
    @Column(length = 40)
    private String track;
}
