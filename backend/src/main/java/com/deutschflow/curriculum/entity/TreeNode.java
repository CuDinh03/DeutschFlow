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
 * A leaf — one lesson within a topic. {@link #id} is a stable string (e.g. {@code "b1_h_nc_1"}) used
 * directly as the node id the FE renderer draws and the lesson player loads. {@link #contentKey}
 * points at the lesson body that the content pipeline fills in later (kept out of the tree shape).
 */
@Entity
@Table(name = "tree_nodes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TreeNode {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "topic_pk", nullable = false)
    private Long topicPk;

    @Column(name = "order_index", nullable = false)
    private int orderIndex;

    @Column(name = "title_de", nullable = false, length = 160)
    private String titleDe;

    @Column(name = "content_key", length = 120)
    private String contentKey;
}
