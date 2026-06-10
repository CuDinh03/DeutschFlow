package com.deutschflow.teacher.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

import java.io.Serializable;
import java.util.Objects;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ClassAttendanceId implements Serializable {

    @Column(name = "lesson_log_id")
    private Long lessonLogId;

    @Column(name = "student_id")
    private Long studentId;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ClassAttendanceId that = (ClassAttendanceId) o;
        return Objects.equals(lessonLogId, that.lessonLogId) && Objects.equals(studentId, that.studentId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(lessonLogId, studentId);
    }
}
