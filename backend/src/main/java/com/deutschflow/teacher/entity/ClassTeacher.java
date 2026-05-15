package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "class_teachers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassTeacher {

    @EmbeddedId
    private ClassTeacherId id;

    @Column(length = 50, nullable = false)
    @Builder.Default
    private String role = "PRIMARY"; // PRIMARY, ASSISTANT

    @Column(name = "joined_at", nullable = false, updatable = false)
    private LocalDateTime joinedAt;

    @PrePersist
    protected void onCreate() {
        if (joinedAt == null) joinedAt = LocalDateTime.now();
    }
}
