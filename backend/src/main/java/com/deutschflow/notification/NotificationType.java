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

    // ── v1.4 — Gamification & engagement notifications ──────────────────

    /** Student unlocked a new achievement/badge. */
    ACHIEVEMENT_UNLOCKED,
    /** Student leveled up (XP milestone). */
    LEVEL_UP,
    /** Daily reminder: student has review cards due today. */
    REVIEW_DUE,
    /** Daily reminder: student hasn't studied today — streak at risk. */
    STREAK_REMINDER
}
