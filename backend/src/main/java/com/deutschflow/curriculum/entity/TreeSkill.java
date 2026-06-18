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
 * One of the four fixed skills (hoeren/sprechen/lesen/schreiben) — a primary branch on every level.
 * Render geometry/colour for each skill lives in the FE config; only semantics are stored here.
 */
@Entity
@Table(name = "tree_skills")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TreeSkill {

    @Id
    @Column(length = 16)
    private String code;

    @Column(name = "label_vi", nullable = false, length = 40)
    private String labelVi;

    @Column(name = "order_index", nullable = false)
    private int orderIndex;
}
