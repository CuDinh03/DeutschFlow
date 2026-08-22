package com.deutschflow.examspeaking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "speaking_exam_turns")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SpeakingExamTurn {

    public static final String ROLE_CANDIDATE = "CANDIDATE";
    public static final String ROLE_PRUEFER = "PRUEFER";
    public static final String ROLE_PARTNER = "PARTNER";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(name = "part_no", nullable = false)
    private int partNo;

    @Column(name = "seq", nullable = false)
    private int seq;

    @Column(name = "role", nullable = false, length = 12)
    private String role;

    @Column(name = "transcript", columnDefinition = "text")
    private String transcript;

    @Column(name = "audio_ref", length = 255)
    private String audioRef;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "stt_json", columnDefinition = "jsonb")
    private Map<String, Object> sttJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "turn_eval_json", columnDefinition = "jsonb")
    private Map<String, Object> turnEvalJson;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
