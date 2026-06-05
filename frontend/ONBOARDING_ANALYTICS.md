# Onboarding Analytics & A/B (PostHog setup)

All events below are **already emitted** by the app (web + mobile) — this doc is the
PostHog-side setup so the per-cell conversion funnel and the mentor-upsell A/B can be
built without further code. (Strategy: `docs/superpowers/specs/2026-06-05-onboarding-type-selection-design.md`, §6.)

## Events emitted

| Event | Where | Key properties |
|-------|-------|----------------|
| `onboarding_step_completed` | web | `step_name`, `step_number`, `currentLevel`/`goalType`/`industry`/`weeklyTarget` |
| `onboarding_type_assigned` | web + mobile | `onboardingType` (O1–O5), `platform`, `currentLevel`, `postAction`, `paywallAllowed` |
| `onboarding_placement_test_started` / `_completed` | web | `level`, `passed`, `score` |
| `onboarding_completed` | web + mobile | `level`/`goal`/`industry` (web), `goalType`/`targetLevel` (mobile) |
| `onboarding_mentor_upsell_clicked` | web | `mentor`, `upsell` |
| `onboarding_pricing_cta_clicked` | web | `currentLevel` |
| `upsell_opt_in` / `upsell_dismissed` | mobile | `source` |
| `checkout_started` / `checkout_completed` | web/android | (existing payment taxonomy) |

`platform` is also a registered super-property on mobile (`ios`/`android`); web events are implicitly `web`.

## Per-cell conversion funnel

Create one PostHog **Funnel** insight, broken down by `onboardingType` (and/or `platform`):

1. `onboarding_type_assigned`
2. `onboarding_completed`
3. first-value: `onboarding_placement_test_completed` **OR** `onboarding_mentor_upsell_clicked` **OR** `checkout_started`
4. `checkout_completed`

- **Breakdown** by `onboardingType` → compares O1–O5 archetypes.
- Add a second funnel broken down by `platform` to isolate iOS (no in-app paywall → measure `upsell_opt_in` rate instead of `checkout_*`).
- iOS "activation" funnel: `onboarding_type_assigned` → `onboarding_completed` → `upsell_opt_in`.

## A/B experiment: mentor PRO-upsell nudge

The web onboarding mentor card shows a "🔓 Mở khoá <mentor> với PRO" nudge for FREE users
whose industry mentor is gated. It is gated behind a PostHog **feature flag**:

- **Flag key:** `onboarding-mentor-upsell`
- **Behavior:** flag absent/undefined → nudge shown (default-on, no regression); flag `false` → hidden.
- **To run the experiment:** create a PostHog Experiment on this flag (control = `false`/hidden,
  treatment = `true`/shown). Goal metric: funnel `onboarding_mentor_upsell_clicked` → `checkout_completed`
  (or `checkout_started`). PostHog auto-attaches the flag value to all captured events, so no extra
  instrumentation is needed.

## Notes

- Email send for `upsell_opt_in` leads is out of scope here (needs an email provider) — the consent
  is persisted on `user_learning_profiles.upsell_opt_in_at` and is queryable for a later campaign job.
