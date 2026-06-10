package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "class_attendance")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassAttendance {

    @EmbeddedId
    private ClassAttendanceId id;

    /** PRESENT | ABSENT | LATE */
    @Column(nullable = false, length = 10)
    private String status;

    @Column(columnDefinition = "TEXT")
    private String note;
}
