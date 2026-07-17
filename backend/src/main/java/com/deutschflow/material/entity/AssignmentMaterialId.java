package com.deutschflow.material.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class AssignmentMaterialId implements Serializable {

    @Column(name = "assignment_id")
    private Long assignmentId;

    @Column(name = "material_id")
    private Long materialId;
}
