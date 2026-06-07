package com.deutschflow.user.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_learning_profiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserLearningProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "goal_type", nullable = false)
    private GoalType goalType;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_level", nullable = false)
    private TargetLevel targetLevel;

    @Enumerated(EnumType.STRING)
    @Column(name = "current_level", nullable = false)
    @Builder.Default
    private CurrentLevel currentLevel = CurrentLevel.A0;

    @Enumerated(EnumType.STRING)
    @Column(name = "age_range")
    private AgeRange ageRange;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "interests_json")
    private String interestsJson;

    @Column(name = "industry", length = 100)
    private String industry;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "work_use_cases_json")
    private String workUseCasesJson;

    @Column(name = "exam_type", length = 50)
    private String examType;

    @Column(name = "sessions_per_week", nullable = false)
    private int sessionsPerWeek;

    @Column(name = "minutes_per_session", nullable = false)
    private int minutesPerSession;

    @Enumerated(EnumType.STRING)
    @Column(name = "learning_speed", nullable = false)
    @Builder.Default
    private LearningSpeed learningSpeed = LearningSpeed.NORMAL;

    /**
     * Default Speaking/Interview mentor (a {@code SpeakingPersona} code, e.g. {@code "ANNA"}),
     * derived deterministically at onboarding by
     * {@link com.deutschflow.user.mentor.FixedMentorResolver}. Nullable for profiles created
     * before the fixed-mentor feature; consumers fall back to the default mentor.
     */
    @Column(name = "assigned_persona_code", length = 32)
    private String assignedPersonaCode;

    /**
     * How {@link #currentLevel} was established: {@code "SELF"} (self-declared during onboarding)
     * or {@code "PLACEMENT"} (validated by the placement test). Lets adaptive logic weight the
     * confidence of {@code currentLevel}.
     */
    @Column(name = "level_source", length = 20)
    @Builder.Default
    private String levelSource = "SELF";

    /**
     * Which onboarding archetype (O1–O5) the learner was routed through, as an
     * {@link com.deutschflow.user.onboarding.OnboardingType} name. Derived from
     * platform × current_level at onboarding by
     * {@link com.deutschflow.user.onboarding.OnboardingTypeResolver}. Nullable for
     * older profiles and clients that don't send a platform.
     */
    @Column(name = "onboarding_type", length = 32)
    private String onboardingType;

    /**
     * When the learner opted in (in-app) to receive PRO-upgrade information by email.
     * Powers the iOS "reader app" web-upsell handoff (Apple 3.1.1: no in-app pricing).
     * {@code null} = not opted in. The email send itself is handled out-of-band.
     */
    @Column(name = "upsell_opt_in_at")
    private LocalDateTime upsellOptInAt;

    /**
     * Why the learner is studying German — the onboarding "motivation" question, a richer
     * signal than {@link #goalType} (which the client derives: {@code EXAM → CERT}, else
     * {@code WORK}). Powers emotional framing + marketing segmentation. Nullable for
     * profiles created before this field existed.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "motivation", length = 20)
    private LearningMotivation motivation;

    /**
     * Daily study-time commitment in minutes (e.g. 5/10/15/20), chosen during onboarding —
     * the Duolingo-style daily goal that anchors the streak loop. Nullable; the learning
     * plan still derives weekly volume from {@link #sessionsPerWeek} × {@link #minutesPerSession}.
     */
    @Column(name = "daily_goal_minutes")
    private Integer dailyGoalMinutes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        var now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum GoalType { WORK, CERT }
    /** Onboarding "why are you learning German?" — the client derives {@link GoalType} from this. */
    public enum LearningMotivation { JOB, AUSBILDUNG, STUDY, IMMIGRATION, EXAM, HOBBY }
    public enum TargetLevel { A1, A2, B1, B2, C1, C2 }
    public enum CurrentLevel { A0, A1, A2, B1, B2, C1, C2 }
    public enum AgeRange { UNDER_18, AGE_18_24, AGE_25_34, AGE_35_44, AGE_45_PLUS }
    public enum LearningSpeed { SLOW, NORMAL, FAST }
}

