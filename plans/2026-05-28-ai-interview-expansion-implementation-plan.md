# AI Interview Expansion Implementation Plan

Date: 2026-05-28  
Scope: Expand DeutschFlow AI Interview into a dedicated interview domain while preserving the existing speaking core.

## Objective

Turn the current interview mode from an embedded speaking variant into a maintainable product line with:

- explicit interview domain boundaries
- interview persona registry
- phase-based orchestration
- structured scoring and final reports
- analytics and experimentation support
- backward compatibility for existing speaking and interview sessions

## Planning assumptions

- The current codebase already contains interview primitives (`InterviewOrchestrator`, `InterviewQuestionBank`, `InterviewAnswerAnalyzer`, `InterviewSpeechSanitizer`, `InterviewEvaluationService`).
- The speaking core remains the shared runtime for session persistence, message persistence, quota handling, and AI transport.
- The new work should reuse existing database/session infrastructure rather than rewriting the speaking engine.
- Special Vietnamese tutor personas used for lesson/communication modes remain outside the interview registry unless explicitly promoted.

## Dependency graph

1. Interview domain model and registry foundations
2. Shared evaluation and report contract
3. Orchestration refactor around explicit interview boundaries
4. Prompt layer extraction and versioning
5. Analytics events and experiment assignment
6. Migration/backward-compatibility safeguards
7. Test coverage and release readiness

Parallelism note: steps 4 and 5 can start after step 3 stabilizes, but they should not be merged into the same change set as the core domain model work.

---

## Step 1 — Formalize the interview domain model and registry

### Goal
Create a stable interview-specific domain model so the rest of the implementation can stop relying on scattered enum switches and implicit persona behavior.

### Work items
- Define interview domain classes/entities for:
  - interview session state
  - interview turn
  - interview phase result
  - interview persona metadata
  - interview rubric template
  - interview experiment assignment
- Introduce or refine an interview persona registry that maps supported personas to:
  - industry
  - role title
  - tone
  - difficulty
  - question style
  - follow-up style
  - evaluation bias
  - version
- Classify personas into capability buckets:
  - interview-capable now
  - interview-capable after expansion
  - non-interview personas
- Document the supported industry/role groups.

### Dependencies
- None. This is the foundation.

### Verification
- Build succeeds after adding the domain classes.
- Existing speaking personas still resolve normally.
- Interview persona capability lookup returns deterministic results.

### Exit criteria
- Interview-specific model is explicit and reusable.
- No interview logic needs to infer capability from scattered switch statements.

---

## Step 2 — Separate interview question selection from orchestration

### Goal
Make question selection a clean capability independent from turn orchestration.

### Work items
- Refactor question lookup into a dedicated question bank service/component.
- Ensure question selection can resolve by:
  - persona
  - phase
  - position title
  - industry
- Preserve shared/common question sets and persona-specific question sets.
- Make fallback questions deterministic and visible in the output.
- Ensure the question bank can be versioned.

### Dependencies
- Step 1

### Verification
- Unit tests cover question selection for at least:
  - a tech persona
  - a healthcare persona
  - a service/persona fallback
  - a generic fallback path
- Questions returned for a given input are deterministic.

### Exit criteria
- Orchestration no longer owns question catalog logic.
- New personas/industries can be added without touching the turn engine.

---

## Step 3 — Refactor interview orchestration into a phase-aware engine

### Goal
Make interview runtime behavior explicit and predictable: phase selection, answer analysis, directive resolution, and question choice should live behind a dedicated interview orchestration layer.

### Work items
- Refactor turn planning so it clearly owns:
  - phase progression
  - answer analysis
  - directive selection
  - closing/question-handling behavior
  - final turn cutoff rules
- Keep the existing speaking session lifecycle intact, but route interview sessions through the interview orchestrator.
- Ensure the orchestrator produces a structured turn plan with stable fields.
- Make closing-question detection and candidate-question handling explicit.
- Keep post-processing deterministic and separated from question generation.

### Dependencies
- Step 1
- Step 2

### Verification
- Interview mode still creates valid turns for all phases.
- Closing behavior works deterministically.
- A turn plan can be generated without calling the whole speaking chat pipeline.

### Exit criteria
- Interview runtime behavior is no longer coupled to generic speaking logic beyond shared session/message storage.
- Phase-aware behavior is testable in isolation.

---

## Step 4 — Extract layered prompt construction and versioning

### Goal
Replace monolithic prompt assembly with layered interview prompt composition that is easier to tune, test, and A/B compare.

### Work items
- Extract prompt layers:
  - base system policy
  - persona prompt
  - phase prompt
  - scoring prompt
  - feedback prompt
- Make prompt variants versioned and runtime-visible.
- Keep the output schema stable and JSON-first.
- Ensure prompt construction is explicit about:
  - persona
  - industry
  - phase
  - difficulty
  - experiment variant
- Add prompt variant keys to the interview session or turn metadata.

### Dependencies
- Step 3

### Verification
- Prompt assembly can be unit-tested by layer.
- A prompt variant key is recorded in the runtime metadata.
- Existing interview responses remain parseable by the current response pipeline.

### Exit criteria
- Prompt changes can be scoped and compared without editing one giant prompt string.
- Prompt versions are preserved for historical analysis.

---

## Step 5 — Introduce hybrid scoring and structured reporting

### Goal
Make interview evaluation a hybrid system: deterministic structure checks plus LLM-based qualitative judgment, returning stable JSON for downstream use.

### Work items
- Define evaluation ownership clearly:
  - rule-based checks for phase completion, missing evidence, and hard thresholds
  - LLM-based qualitative scoring for nuance and feedback text
- Normalize phase-level score outputs into a structured JSON contract.
- Normalize overall outcomes into:
  - score
  - verdict
  - readiness level
  - strong areas
  - critical gaps
  - recommended drills
  - next action
- Ensure the final report is generated from structured interview data rather than free-form text only.
- Keep interview report generation separate from the speaking tutor summary flow.

### Dependencies
- Step 3
- Step 4

### Verification
- Scoring output is stable JSON.
- Final report generation works for at least one session per major industry group.
- Rule-based checks and LLM feedback can be tested independently.

### Exit criteria
- Interview evaluation is consistent enough for analytics and experimentation.
- Reports are structured and readable for users and dashboards.

---

## Step 6 — Add analytics events and experiment assignment

### Goal
Make interview usage measurable so product decisions can be driven by completion, quality, and conversion data.

### Work items
- Add analytics events for:
  - session started
  - phase entered
  - turn answered
  - phase completed
  - report generated
  - session completed
  - prompt variant assigned
- Add experiment assignment support at session start.
- Persist version/variant identifiers on interview records.
- Emit enough metadata to answer:
  - which persona works best
  - which phase drops users off
  - which rubric variant improves completion or conversion
- Ensure historical sessions remain interpretable when personas or rubrics evolve.

### Dependencies
- Step 1
- Step 3
- Step 4
- Step 5

### Verification
- Analytics events are emitted for a full interview session.
- Experiment assignment is deterministic for a given assignment rule.
- Session records preserve version or variant keys.

### Exit criteria
- The product can be measured and compared across variants.
- Future prompt/persona changes do not destroy interpretability.

---

## Step 7 — Add backward-compatibility and rollout safeguards

### Goal
Introduce the new interview domain without breaking existing users, reports, or speaking sessions.

### Work items
- Preserve compatibility for existing interview sessions and reports.
- Ensure old sessions can still be read even if new version fields are missing.
- Add fallback paths for personas or rubrics not yet migrated to the new registry.
- Where needed, support shadow-mode or dual-read comparison for prompt/rubric changes.
- Make rollout flags explicit for interview variants.

### Dependencies
- Step 1 through Step 6

### Verification
- Old sessions still load and render correctly.
- Missing version fields do not break report rendering.
- New code paths fail closed to safe defaults.

### Exit criteria
- Deployment can happen incrementally.
- The new domain does not force a hard cutover.

---

## Step 8 — Add test coverage and release readiness checks

### Goal
Prove the new interview domain works correctly across core flows and regression-sensitive boundaries.

### Work items
- Add unit tests for:
  - persona registry lookup
  - question selection
  - phase progression
  - closing behavior
  - scoring output
  - report generation
- Add integration tests for:
  - starting an interview session
  - completing a full interview flow
  - generating a final report
  - persisting analytics/version metadata
- Add regression tests around:
  - old interview sessions
  - fallback personas
  - prompt variant parsing
- Verify that the speaking tutor path remains unchanged.

### Dependencies
- Step 1 through Step 7

### Verification
- Relevant tests pass.
- No regressions in non-interview speaking flows.
- Existing build/lint checks remain green.

### Exit criteria
- The implementation is production-ready.
- The interview domain is tested at the boundary points that matter most.

---

## Parallel work opportunities

After Step 1, the following can be parallelized with clear ownership boundaries:

- **Track A:** question bank and persona registry refinement
- **Track B:** prompt extraction and versioning
- **Track C:** analytics event schema and experiment assignment

These tracks should still converge on the shared orchestration and scoring contract before release.

## Anti-patterns to avoid

- stuffing all interview logic into `AiSpeakingServiceImpl`
- treating a persona enum entry as the same thing as interview capability
- making scoring fully free-form without structured output
- losing version history for prompt/rubric changes
- merging analytics changes before the interview contract is stable
- breaking existing speaking sessions while refactoring interview mode

## Recommended rollout order

1. Domain model and persona registry
2. Question bank separation
3. Orchestration refactor
4. Prompt layering and versioning
5. Hybrid scoring and report generation
6. Analytics and experiments
7. Backward compatibility safeguards
8. Tests and release hardening

## Definition of done

AI Interview is considered implemented when:

- the interview domain has explicit boundaries
- supported personas are registry-driven
- phase-based interview flow works end-to-end
- scoring and report output are structured and stable
- analytics and experiment metadata are captured
- existing speaking behavior remains intact
- the system can evolve without another major rewrite
