package com.deutschflow.speaking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "error_review_tasks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ErrorReviewTask {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "error_code", nullable = false, length = 80)
    private String errorCode;

    @Column(name = "task_type", nullable = false, length = 32)
    private String taskType;

    @Column(name = "due_at", nullable = false)
    private LocalDateTime dueAt;

    @Column(name = "interval_days", nullable = false)
    private int intervalDays;

    @Column(name = "status", nullable = false, length = 16)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;
}
