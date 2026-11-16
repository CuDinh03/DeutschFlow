package com.deutschflow.feedback.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Lời trả lời của đội ngũ cho một góp ý (V389). Người gửi góp ý đọc được. */
@Entity
@Table(name = "feedback_replies")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FeedbackReply {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "feedback_id", nullable = false)
    private Long feedbackId;

    @Column(nullable = false, length = 1000)
    private String body;

    @Column(name = "author_id")
    private Long authorId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
