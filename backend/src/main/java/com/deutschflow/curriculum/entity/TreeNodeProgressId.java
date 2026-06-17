package com.deutschflow.curriculum.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;

/** Composite key for {@link TreeNodeProgress}: one row per (user, node). */
@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class TreeNodeProgressId implements Serializable {

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "node_id", length = 64)
    private String nodeId;
}
