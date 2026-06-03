# Speaking Chat UX — Persona Action States & Mobile Chat UI

Status: **design locked 2026-06-03**. Target: `mobile/` (Expo). Scope: the AI-Speaking chat
view (`mobile/app/(student)/speaking.tsx`) + persona character reactions.

## Signals (from `AiChatResponse`)

| Signal | Meaning | Range | Drives |
|---|---|---|---|
| `correction` | grammar mistake present | string / null | đúng-sai (grammar) |
| `similarityScore` | on-topic relevance | **0.0–1.0** (`1.0`=on-topic, `<0.35`=off-topic) | praise / off-topic |
| `status` | e.g. `OFF_TOPIC` | enum | off-topic redirect |
| `suggestions[]` | native phrases (`germanText` + `vietnameseTranslation` + `whyToUse`/`usageContext`) | — | suggested replies |
| `interviewPhaseKey` | INTRO / ICE_BREAKER / HARD_SKILLS / STAR_SOFT / CLOSING | — | interview phase badge |

> `correction` = grammar; `similarityScore` = on-topic relevance. They are SEPARATE.

## Mode personalities (gate behaviour on `session.sessionMode`)

- **COMMUNICATION (Hội thoại)** — free talk. Flow states only. **NO** on-topic/scoring.
  Grammar: corrected **at end of turn** (gentle "góp ý", not interrupting). Plus
  **native-phrase suggestions** ("câu người Đức hay dùng" — from `suggestions`, surface
  `whyToUse`/`usageContext`). Friendly tone.
- **INTERVIEW (Phỏng vấn)** — evaluated. FULL states incl. đúng/sai/khen/lạc-đề, on-topic
  enforced, phase badge, professional tone, ends in report.
- **LESSON (Luyện tập)** — Vietnamese-tutor A1. Flow + gentle correction + lots of praise
  (encourage beginners) + soft scenario nudging. No strict scoring.

## State machine

| State | Trigger (code) | Expression | Duration | UI |
|---|---|---|---|---|
| Idle | default | neutral + blink | — | static |
| Nghe (listen) | `isRecording` | neutral attentive | while recording | pulse ring + waveform |
| Nghe-xong | record stop → transcribe done | smiling + nod | ~0.8s | flash "Đã nghe ✓" |
| Nghĩ (think) | `sending` | thinking (hand-to-chin) | while awaiting | 3 typing dots |
| Nói (speak) | new AI msg | talking (lip-sync) | reveal time | text reveals word-by-word |
| Khen (praise) | `!correction && score≥0.8` (or 3-good streak) | laughing/winking | ~1.8s | "Sehr gut! 🎉" + haptic success |
| Đúng (approve) | `!correction && score≥0.5` | smiling | ~1.2s | soft ✓ |
| Sai (correct) | `correction` present | serious → thinking | — | correction card (strike-red → green) + explanationVi + haptic warning |
| Lạc-đề (redirect) | `status==OFF_TOPIC` or `score<0.35` | thinking + head-tilt | ~1.5s | "Bleiben wir beim Thema 🙂" |

### State × mode matrix

| State / UI | Hội thoại | Phỏng vấn | Luyện tập |
|---|:--:|:--:|:--:|
| Nghe · Nghe-xong · Nghĩ · Nói | ✅ | ✅ | ✅ |
| Sai (grammar) | ✅ **end-of-turn, gentle** | ✅ | ✅ gentle |
| Khen | 🔸 casual | ✅ formal | ✅ lots |
| Lạc-đề (on-topic) | ❌ | ✅ | 🔸 soft nudge |
| Native-phrase suggestions | ✅ | 🔸 | ✅ |
| Phase badge + report | ❌ | ✅ | ❌ |

`similarityScore` thresholds: ≥0.8 praise · 0.5–0.8 approve · <0.35 off-topic.

## Text appearance

- AI speech: reveal word-by-word (fade + slight up) ~reading pace, synced with `talking`; tap to skip → full.
- Suggestion → **type into input bar char-by-char, then auto-send** — ✅ DONE (commit pending).
- Correction card (redesign): "Bạn nói:" (wrong span strike-red) → "Nên là:" (green) + explanationVi + `grammarPoint` chip.
- Suggestions: tappable chips, `germanText` + `vietnameseTranslation`, optional `whyToUse`.

## Avatar bubble

- Small circular **persona head-crop** avatar on the LEFT of each AI message.
- Source = `PersonaAvatar` (bespoke SVG character) clipped to a circle showing the head.
- Perf: blink-only when idle is cheap; if needed, add `static` to skip intervals for old messages.
- Optional: larger "hero" avatar in chat header reflecting the live state.

## Implementation phases

1. **Avatar bubble** (left of AI messages) — user-requested, concrete. ← NEXT
2. **State machine** wiring: `isRecording`→nghe, `sending`→nghĩ, new msg→nói, mode-gated đúng/sai/khen/lạc-đề.
3. **Reveal text** + typing dots.
4. **Correction card redesign** + haptics + native-phrase suggestions.
5. Hero header avatar (optional).
