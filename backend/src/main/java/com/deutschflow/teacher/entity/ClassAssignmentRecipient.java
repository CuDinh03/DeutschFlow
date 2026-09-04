package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * Người nhận của một bài tập (V297, AC14). KHÔNG có dòng nào cho một bài = giao CẢ LỚP (tương
 * thích dữ liệu cũ); có dòng = chỉ những học viên này nhận StudentAssignment + notification.
 */
@Entity
@Table(name = "class_assignment_recipients")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassAssignmentRecipient {

    @EmbeddedId
    private Id id;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    @Embeddable
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Id implements Serializable {
        @Column(name = "assignment_id")
        private Long assignmentId;

        @Column(name = "student_id")
        private Long studentId;
    }
}
