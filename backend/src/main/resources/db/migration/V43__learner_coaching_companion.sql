-- Learner companion: periodic reports, self-reflection check-ins, in-app notifications,
-- reminder scheduling, curated resource whitelist + weekly digest entries.
-- See docs/COACHING_COMPANION_DESIGN.md.

CREATE TABLE learner_period_check_ins (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    period_type ENUM('WEEK', 'MONTH', 'QUARTER', 'YEAR', 'ADHOC') NOT NULL,
    period_start DATE NOT NULL COMMENT 'Inclusive VN-calendar boundary for this reflection window.',
    period_end_exclusive DATE NOT NULL COMMENT 'Exclusive end consistent with quota-style half-open intervals.',
    mood_score TINYINT NULL COMMENT 'Optional 1-5 learner mood.',
    reflection_text MEDIUMTEXT NOT NULL COMMENT 'Learner self-attestation before / during period summary.',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_lpci_user_period (user_id, period_type, period_start),
    KEY idx_lpci_user_created (user_id, created_at DESC),
    CONSTRAINT fk_lpci_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE learner_progress_reports (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    period_type ENUM('WEEK', 'MONTH', 'QUARTER', 'YEAR') NOT NULL,
    period_start DATE NOT NULL,
    period_end_exclusive DATE NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    learner_check_in_id BIGINT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT, READY, FAILED',
    metrics_json JSON NOT NULL COMMENT 'Frozen aggregates for the reporting window.',
    highlights_json JSON NULL COMMENT 'Structured strengths ("điểm sáng") before remediation section.',
    focus_errors_json JSON NULL COMMENT 'Structured errors + remediation hints.',
    guidance_markdown MEDIUMTEXT NULL COMMENT 'Tutor narrative: strengths first, then fixes, roadmap, encouragement.',
    next_steps_json JSON NULL COMMENT 'Action items for upcoming period.',
    model_name VARCHAR(128) NULL,
    prompt_version VARCHAR(32) NULL,
    generation_error VARCHAR(768) NULL,
    generated_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_lpr_user_period (user_id, period_type, period_start),
    KEY idx_lpr_user_status_gen (user_id, status, generated_at DESC),
    CONSTRAINT fk_lpr_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_lpr_checkin FOREIGN KEY (learner_check_in_id)
        REFERENCES learner_period_check_ins (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE learner_report_feedback (
    id BIGINT NOT NULL AUTO_INCREMENT,
    report_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    rating TINYINT NOT NULL COMMENT '1-5 usefulness / satisfaction.',
    comment_text TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_lrf_report_user (report_id, user_id),
    KEY idx_lrf_user_created (user_id, created_at DESC),
    CONSTRAINT fk_lrf_report FOREIGN KEY (report_id) REFERENCES learner_progress_reports (id) ON DELETE CASCADE,
    CONSTRAINT fk_lrf_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_coach_preferences (
    user_id BIGINT NOT NULL,
    exercise_reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    coach_encouragement_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    weekly_report_notice_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    weekly_resource_digest_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    quiet_hours_start_local TIME NULL,
    quiet_hours_end_local TIME NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (user_id),
    CONSTRAINT fk_ucp_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE coach_in_app_notifications (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    kind VARCHAR(32) NOT NULL COMMENT 'REMINDER_EXERCISE, ENCOURAGEMENT, REPORT_READY, RESOURCE_DIGEST, GENERIC.',
    title VARCHAR(240) NOT NULL,
    body MEDIUMTEXT NOT NULL,
    action_path VARCHAR(512) NULL COMMENT 'In-app route slug, e.g. /coach/reports/123.',
    dedupe_key VARCHAR(128) NULL COMMENT 'Optional idempotency per user/week.',
    read_at DATETIME(6) NULL,
    expires_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_cin_user_dedupe (user_id, dedupe_key),
    KEY idx_cin_user_unread (user_id, read_at, created_at DESC),
    CONSTRAINT fk_cin_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE coach_scheduled_deliveries (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    delivery_kind VARCHAR(32) NOT NULL COMMENT 'REMINDER_REVIEW_TASK, DIGEST_RESOURCES, ENCOURAGEMENT, REPORT_READY_FANOUT.',
    fire_at DATETIME(6) NOT NULL,
    status ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    payload_json JSON NULL,
    last_error VARCHAR(512) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    processed_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    KEY idx_csd_fire_pending (fire_at, status),
    KEY idx_csd_user (user_id, status),
    CONSTRAINT fk_csd_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE curated_resource_channels (
    id BIGINT NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description_text MEDIUMTEXT NULL,
    homepage_url VARCHAR(1024) NOT NULL,
    audience VARCHAR(24) NOT NULL DEFAULT 'GENERAL' COMMENT 'GENERAL, STUDENT, JOBSEEKER.',
    language_tags_json JSON NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_crc_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE curated_resource_entries (
    id BIGINT NOT NULL AUTO_INCREMENT,
    channel_id BIGINT NOT NULL,
    digest_week_start DATE NOT NULL COMMENT 'VN Monday anchor for weekly roundup.',
    headline VARCHAR(360) NOT NULL,
    summary_text MEDIUMTEXT NOT NULL,
    canonical_url VARCHAR(1024) NOT NULL,
    source_published_date DATE NULL,
    attribution_note VARCHAR(256) NULL,
    created_by VARCHAR(24) NOT NULL DEFAULT 'ADMIN' COMMENT 'ADMIN, IMPORT.',
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_cre_week_visible (digest_week_start, is_visible),
    UNIQUE KEY uk_cre_week_url (digest_week_start, canonical_url(255)),
    CONSTRAINT fk_cre_channel FOREIGN KEY (channel_id) REFERENCES curated_resource_channels (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
