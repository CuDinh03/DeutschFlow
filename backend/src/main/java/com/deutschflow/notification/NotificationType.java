package com.deutschflow.notification;

/**
 * In-app notification discriminator. Payload shape is type-specific (see API docs / OpenAPI).
 */
public enum NotificationType {
    /** New student account — materialized for each active admin. */
    USER_REGISTERED,
    /** Learner's subscription/plan was updated (e.g. admin patch) — recipient is the learner. */
    LEARNER_PLAN_UPDATED,
    /** Admin audit: a learner's plan was changed — materialized for each active admin. */
    ADMIN_LEARNER_PLAN_CHANGED,
    /** Admin audit: a learner purchased a subscription via payment gateway. */
    ADMIN_LEARNER_SUBSCRIBED,

    // ── v1.4 — Gamification & engagement notifications ──────────────────

    /** Student unlocked a new achievement/badge. */
    ACHIEVEMENT_UNLOCKED,
    /** Student leveled up (XP milestone). */
    LEVEL_UP,
    /** Daily reminder: student has review cards due today. */
    REVIEW_DUE,
    /** Daily reminder: student hasn't studied today — streak at risk. */
    STREAK_REMINDER,
    /** Teacher assigned a new homework/quiz to the classroom. */
    NEW_ASSIGNMENT,

    // ── v1.5 — Classroom notifications ──────────────────────────────────

    /** Teacher approved a student's join request. Recipient: student. */
    JOIN_REQUEST_APPROVED,
    /** Teacher rejected a student's join request. Recipient: student. */
    JOIN_REQUEST_REJECTED,
    /** Teacher added student directly to a class (no invite flow). Recipient: student. */
    ADDED_TO_CLASS,
    /** Teacher graded a speaking session or class assignment. Recipient: student. */
    ASSIGNMENT_GRADED,
    /** Teacher created a new ClassAssignment (non-quiz). Recipient: all students in class. */
    NEW_CLASS_ASSIGNMENT,
    /** Teacher added a student to a class. Recipient: the teacher. */
    CLASS_STUDENT_ADDED,
    /** Teacher removed a student from a class. Recipient: the teacher. */
    CLASS_STUDENT_REMOVED,
    /** A student requested to join a class. Recipient: the teacher. */
    CLASS_JOIN_REQUEST_CREATED,
    /** A student submitted a quiz or speaking result that needs teacher attention. */
    QUIZ_SUBMISSION_RECEIVED,

    // ── v1.6 — Broadcast & teacher announcements ─────────────────────────

    /** Admin broadcast: a message sent to a targeted audience (all, tier, role, or single user). */
    ADMIN_BROADCAST,
    /** Teacher announcement: a message sent by a teacher to all students in a class. */
    TEACHER_ANNOUNCEMENT
}
