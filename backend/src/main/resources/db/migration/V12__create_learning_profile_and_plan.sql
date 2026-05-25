-- ============================================================
-- V12: USER LEARNING PROFILE + PERSONALIZED PLAN (MVP)
-- ============================================================

CREATE TABLE user_learning_profiles  (
    id                   BIGSERIAL PRIMARY KEY,
    user_id              BIGINT NOT NULL,

    goal_type            VARCHAR(64) NOT NULL,
    target_level         VARCHAR(64) NOT NULL,
    current_level        VARCHAR(64) NOT NULL DEFAULT 'A0',

    age_range            VARCHAR(64),
    interests_json       JSON,
    industry             VARCHAR(100),
    work_use_cases_json  JSON,
    exam_type            VARCHAR(50),

    sessions_per_week    INT NOT NULL,
    minutes_per_session  INT NOT NULL,
    learning_speed       VARCHAR(64) NOT NULL DEFAULT 'NORMAL',

    created_at           TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_profile_user UNIQUE (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE learning_plans  (
    id                   BIGSERIAL PRIMARY KEY,
    user_id              BIGINT NOT NULL,
    profile_id           BIGINT NOT NULL,

    goal_type            VARCHAR(64) NOT NULL,
    target_level         VARCHAR(64) NOT NULL,
    current_level        VARCHAR(64) NOT NULL,

    sessions_per_week    INT NOT NULL,
    minutes_per_session  INT NOT NULL,
    weekly_minutes       INT NOT NULL,
    weeks_total          INT NOT NULL,

    plan_json            JSONB NOT NULL,

    created_at           TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_plan_user UNIQUE (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES user_learning_profiles(id) ON DELETE CASCADE
);
