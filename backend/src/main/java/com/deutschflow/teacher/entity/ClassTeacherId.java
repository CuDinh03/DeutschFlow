package com.deutschflow.teacher.entity;

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
public class ClassTeacherId implements Serializable {

    @Column(name = "class_id")
    private Long classId;

    @Column(name = "teacher_id")
    private Long teacherId;
}
