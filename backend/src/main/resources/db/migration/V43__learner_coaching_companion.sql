-- Learner companion: periodic reports, self-reflection check-ins, in-app notifications,
-- reminder scheduling, curated resource whitelist + weekly digest entries.
-- See docs/COACHING_COMPANION_DESIGN.md.

CREATE TABLE learner_period_check_ins  (
    id BIGSERIAL,
    user_id BIGINT NOT NULL,
    period_type VARCHAR(64) NOT NULL,
    period_start DATE NOT NULL,
    period_end_exclusive DATE NOT NULL,
    mood_score SMALLINT NULL,
    reflection_text TEXT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_lpci_user_period UNIQUE (user_id, period_type, period_start),
    CONSTRAINT fk_lpci_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_lpci_user_created ON learner_period_check_ins (user_id, created_at DESC);


CREATE TABLE learner_progress_reports  (
    id BIGSERIAL,
    user_id BIGINT NOT NULL,
    period_type VARCHAR(64) NOT NULL,
    period_start DATE NOT NULL,
    period_end_exclusive DATE NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    learner_check_in_id BIGINT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    metrics_json JSONB NOT NULL,
    highlights_json JSONB NULL,
    focus_errors_json JSONB NULL,
    guidance_markdown TEXT NULL,
    next_steps_json JSONB NULL,
    model_name VARCHAR(128) NULL,
    prompt_version VARCHAR(32) NULL,
    generation_error VARCHAR(768) NULL,
    generated_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_lpr_user_period UNIQUE (user_id, period_type, period_start),
    CONSTRAINT fk_lpr_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_lpr_checkin FOREIGN KEY (learner_check_in_id)
        REFERENCES learner_period_check_ins (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_lpr_user_status_gen ON learner_progress_reports (user_id, status, generated_at DESC);


CREATE TABLE learner_report_feedback  (
    id BIGSERIAL,
    report_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    rating SMALLINT NOT NULL,
    comment_text TEXT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_lrf_report_user UNIQUE (report_id, user_id),
    CONSTRAINT fk_lrf_report FOREIGN KEY (report_id) REFERENCES learner_progress_reports (id) ON DELETE CASCADE,
    CONSTRAINT fk_lrf_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_lrf_user_created ON learner_report_feedback (user_id, created_at DESC);


CREATE TABLE user_coach_preferences  (
    user_id BIGINT NOT NULL,
    exercise_reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    coach_encouragement_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    weekly_report_notice_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    weekly_resource_digest_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    quiet_hours_start_local TIME NULL,
    quiet_hours_end_local TIME NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_ucp_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);


CREATE TABLE coach_in_app_notifications  (
    id BIGSERIAL,
    user_id BIGINT NOT NULL,
    kind VARCHAR(32) NOT NULL,
    title VARCHAR(240) NOT NULL,
    body TEXT NOT NULL,
    action_path VARCHAR(512) NULL,
    dedupe_key VARCHAR(128) NULL,
    read_at TIMESTAMP(6) NULL,
    expires_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_cin_user_dedupe UNIQUE (user_id, dedupe_key),
    CONSTRAINT fk_cin_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cin_user_unread ON coach_in_app_notifications (user_id, read_at, created_at DESC);


CREATE TABLE coach_scheduled_deliveries  (
    id BIGSERIAL,
    user_id BIGINT NOT NULL,
    delivery_kind VARCHAR(32) NOT NULL,
    fire_at TIMESTAMP(6) NOT NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'PENDING',
    payload_json JSONB NULL,
    last_error VARCHAR(512) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP(6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_csd_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_csd_fire_pending ON coach_scheduled_deliveries (fire_at, status);
CREATE INDEX IF NOT EXISTS idx_csd_user ON coach_scheduled_deliveries (user_id, status);


CREATE TABLE curated_resource_channels  (
    id BIGSERIAL,
    code VARCHAR(64) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description_text TEXT NULL,
    homepage_url VARCHAR(1024) NOT NULL,
    audience VARCHAR(24) NOT NULL DEFAULT 'GENERAL',
    language_tags_json JSONB NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_crc_code UNIQUE (code)
);


CREATE TABLE curated_resource_entries  (
    id BIGSERIAL,
    channel_id BIGINT NOT NULL,
    digest_week_start DATE NOT NULL,
    headline VARCHAR(360) NOT NULL,
    summary_text TEXT NOT NULL,
    canonical_url VARCHAR(1024) NOT NULL,
    source_published_date DATE NULL,
    attribution_note VARCHAR(256) NULL,
    created_by VARCHAR(24) NOT NULL DEFAULT 'ADMIN',
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_cre_channel FOREIGN KEY (channel_id) REFERENCES curated_resource_channels (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_cre_week_url ON curated_resource_entries (digest_week_start, LEFT(canonical_url, 255));
CREATE INDEX IF NOT EXISTS idx_cre_week_visible ON curated_resource_entries (digest_week_start, is_visible);
