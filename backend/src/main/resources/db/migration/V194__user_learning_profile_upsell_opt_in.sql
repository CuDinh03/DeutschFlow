-- iOS web-upsell handoff (Phase 4). Records when a learner opted in, in-app, to
-- receive PRO-upgrade information by email. This is the Apple-3.1.1-compliant path
-- for iOS ("reader app"): no in-app pricing/checkout — instead capture consent and
-- convert out-of-band by email. NULL = not opted in. The email send itself is
-- handled by a separate job (out of scope here).
ALTER TABLE user_learning_profiles
    ADD COLUMN IF NOT EXISTS upsell_opt_in_at TIMESTAMP(6);
