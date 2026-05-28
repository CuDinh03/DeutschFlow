package com.deutschflow.beginner.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "beginner_journey_items")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BeginnerJourneyItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sequence_order", nullable = false, unique = true)
    private int sequenceOrder;

    @Column(name = "item_type", nullable = false, length = 30)
    private String itemType;

    @Column(name = "title_de", nullable = false, length = 200)
    private String titleDe;

    @Column(name = "title_vi", length = 200)
    private String titleVi;

    @Column(name = "example_de", length = 500)
    private String exampleDe;

    @Column(name = "example_vi", length = 500)
    private String exampleVi;

    @Column(name = "audio_hint", length = 200)
    private String audioHint;

    @Column(name = "phase", nullable = false, length = 20)
    private String phase;

    @Column(name = "week_number", nullable = false)
    private int weekNumber;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
