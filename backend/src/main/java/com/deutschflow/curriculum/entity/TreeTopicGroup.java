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
 * A topic group (daily/work/travel/medical/culture/exam) — drives the leaf colour family in the
 * FE renderer. Stored for the Vietnamese label only; the colour mapping is FE config.
 */
@Entity
@Table(name = "tree_topic_groups")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TreeTopicGroup {

    @Id
    @Column(length = 16)
    private String code;

    @Column(name = "name_vi", nullable = false, length = 60)
    private String nameVi;
}
