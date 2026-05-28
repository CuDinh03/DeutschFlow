---
name: project-b1-journey
description: 12-week B1 Journey implementation — phase engine, beginner journey, AI speaking day-1, B1 assessment
metadata:
  type: project
---

Implemented the 4-workstream 12-week B1 Journey plan from docs/superpowers/specs/2026-05-28-12-week-b1-journey-implementation-plan.md.

**Why:** Roadmap was a document only; needed a runtime phase progression system for the product to behave as a real learning system.

**How to apply:** All 4 new domains are live and connected. When touching learner progress, phase gating, or beginner experience, check these packages first.

## Workstream A — Phase Engine

New domain: `com.deutschflow.progress`

- `LearnerPhaseState` entity → `learner_phase_states` table (V159)
- `PhaseType` enum: FOUNDATION / PRODUCTION / FLUENCY / GRADUATED
- `PhaseEngineService`: thresholds — Foundation: 50 vocab + 8 sessions, Production: 250 vocab + 20 sessions, Fluency: 700 vocab + 85% grammar
- API: `GET /api/phase/current`, `GET /api/phase/next-action`

## Workstream B — Beginner Journey

New domain: `com.deutschflow.beginner`

- `beginner_journey_items` table (V160) with 10 day-1 items (greetings, phrases, dialogue prompts)
- API: `GET /api/beginner/first-session`, `POST /api/beginner/first-session/complete`

## Workstream C — AI Speaking Day 1

Extended `com.deutschflow.speaking`

- 3 beginner dialogue templates seeded into existing `dialogue_templates` table (V161, difficulty_level=1)
- `BeginnerSpeakingService` + `BeginnerSpeakingController`
- API: `GET /api/speaking/beginner/day1`, `GET /api/speaking/beginner/templates`

## Workstream D — B1 Assessment

New domain: `com.deutschflow.assessment`

- `b1_assessment_states` table (V162)
- `B1ReadinessService`: computes readiness score from phase state + mock exam
- API: `GET /api/assessment/b1/readiness`, `POST /api/assessment/b1/evaluate`, `POST /api/assessment/b1/mock-exam?passed=true`

## Frontend

- `frontend/src/lib/phaseApi.ts` — API client for phase endpoints
- `frontend/src/components/journey/PhaseIndicator.tsx` — 3-step phase progress component with metrics
- Dashboard (`app/dashboard/page.tsx`) updated to fetch and display phase state

## Test results

306 backend tests, 0 failures. 17 new tests added (9 PhaseEngine + 5 B1Readiness + 3 BeginnerJourney).
