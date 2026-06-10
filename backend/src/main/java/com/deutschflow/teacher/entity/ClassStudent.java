package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "class_students")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassStudent {

    @EmbeddedId
    private ClassStudentId id;

    @Column(name = "joined_at", nullable = false, updatable = false)
    private LocalDateTime joinedAt;

    @Column(name = "teacher_comment", columnDefinition = "TEXT")
    private String teacherComment;

    @Column(name = "skill_horen", precision = 4, scale = 1)
    private BigDecimal skillHoren;

    @Column(name = "skill_lesen", precision = 4, scale = 1)
    private BigDecimal skillLesen;

    @Column(name = "skill_schreiben", precision = 4, scale = 1)
    private BigDecimal skillSchreiben;

    @Column(name = "skill_sprechen", precision = 4, scale = 1)
    private BigDecimal skillSprechen;

    @Column(name = "evaluated_at")
    private LocalDateTime evaluatedAt;

    @PrePersist
    protected void onCreate() {
        joinedAt = LocalDateTime.now();
    }
}
