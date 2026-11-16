package com.deutschflow.feedback.entity;

import com.deutschflow.feedback.FeedbackEnums.Area;
import com.deutschflow.feedback.FeedbackEnums.Source;
import com.deutschflow.feedback.FeedbackEnums.Status;
import com.deutschflow.feedback.FeedbackEnums.Type;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

/** Một góp ý về phần mềm (V389). Nội dung là chữ thuần, không bao giờ hiển thị như HTML (BR-31). */
@Entity
@Table(name = "feedback_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FeedbackItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "role_at_submit", nullable = false, length = 16)
    private String roleAtSubmit;

    @Column(name = "org_id_at_submit")
    private Long orgIdAtSubmit;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private Source source = Source.IN_APP;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Type type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Area area;

    @Column(name = "satisfaction")
    private Short satisfaction;

    @Column(nullable = false, length = 2000)
    private String content;

    @Column(nullable = false, length = 100)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private Status status = Status.NEW;

    @Column(name = "allow_contact", nullable = false)
    private boolean allowContact;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tech_info", columnDefinition = "jsonb")
    private Map<String, Object> techInfo;

    @Column(name = "client_request_id", length = 64)
    private String clientRequestId;

    @Column(name = "internal_note", length = 2000)
    private String internalNote;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "read_at")
    private Instant readAt;

    @Column(name = "status_changed_at")
    private Instant statusChangedAt;

    @Column(name = "tech_purged_at")
    private Instant techPurgedAt;
}
