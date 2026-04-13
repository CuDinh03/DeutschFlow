-- ============================================================
-- V12: USER LEARNING PROFILE + PERSONALIZED PLAN (MVP)
-- ============================================================

CREATE TABLE user_learning_profiles (
    id                   BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id              BIGINT NOT NULL,

    goal_type            ENUM('WORK','CERT') NOT NULL,
    target_level         ENUM('A1','A2','B1','B2','C1','C2') NOT NULL,
    current_level        ENUM('A0','A1','A2','B1','B2','C1','C2') NOT NULL DEFAULT 'A0',

    age_range            ENUM('UNDER_18','AGE_18_24','AGE_25_34','AGE_35_44','AGE_45_PLUS'),
    interests_json       JSON,
    industry             VARCHAR(100),
    work_use_cases_json  JSON,
    exam_type            VARCHAR(50),

    sessions_per_week    INT NOT NULL,
    minutes_per_session  INT NOT NULL,
    learning_speed       ENUM('SLOW','NORMAL','FAST') NOT NULL DEFAULT 'NORMAL',

    created_at           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    UNIQUE KEY uq_profile_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE learning_plans (
    id                   BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id              BIGINT NOT NULL,
    profile_id           BIGINT NOT NULL,

    goal_type            ENUM('WORK','CERT') NOT NULL,
    target_level         ENUM('A1','A2','B1','B2','C1','C2') NOT NULL,
    current_level        ENUM('A0','A1','A2','B1','B2','C1','C2') NOT NULL,

    sessions_per_week    INT NOT NULL,
    minutes_per_session  INT NOT NULL,
    weekly_minutes       INT NOT NULL,
    weeks_total          INT NOT NULL,

    plan_json            JSON NOT NULL,

    created_at           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    UNIQUE KEY uq_plan_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES user_learning_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
