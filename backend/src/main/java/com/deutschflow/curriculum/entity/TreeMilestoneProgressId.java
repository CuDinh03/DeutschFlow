package com.deutschflow.curriculum.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;

/** Composite key for {@link TreeMilestoneProgress}: one row per (user, level). */
@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class TreeMilestoneProgressId implements Serializable {

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "level_code", length = 4)
    private String levelCode;
}
