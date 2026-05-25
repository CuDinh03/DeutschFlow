package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "class_assignment_scenarios")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssignmentScenario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "assignment_id", nullable = false)
    private Long assignmentId;

    @Column(nullable = false)
    private String topic;

    @Column(nullable = false, length = 20)
    private String level;

    @Column(name = "scenario_description", columnDefinition = "TEXT")
    private String scenarioDescription;

    @Column(name = "follow_up_questions", columnDefinition = "TEXT")
    private String followUpQuestions;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
