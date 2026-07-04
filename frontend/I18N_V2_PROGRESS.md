# i18n /v2 — Trilingual (vi · en · de) migration tracker

**Goal:** every `/v2` screen (the canonical Galerie 2.0 UI) renders in Vietnamese, English, and German.
**Scope (locked):** all `/v2` pages + key public legacy pages (login, register, home, pricing, terms/privacy).
Legacy authed screens are out of scope (deprecated tree).

## How it works (the pattern)

- Library: **next-intl 3.26** (already wired). Locale comes from the `locale` cookie
  (`request.ts`), set by `LanguageToggle` / `LanguageSwitcher` + on login from `user.locale`.
- Base catalog stays the legacy monolith `messages/{vi,en,de}.json` (untouched — keeps the 18
  already-translated legacy pages working).
- **All /v2 strings live under a single `v2` root namespace**, split per area under
  `messages/v2/<area>.<locale>.json`. `request.ts` merges every area listed in `V2_AREAS`.
- A page reads `useTranslations('v2.<area>.<screen>')`; shared chrome uses `v2.nav`, `v2.shell`,
  `v2.common`.

### Recipe to migrate one screen
1. Extract every hardcoded VN string in the page into `messages/v2/<area>.vi.json` under
   `<area>.<screen>.<key>` (use ICU `{name}` for interpolation, e.g. `"greeting": "Xin chào, {name}"`).
2. Add the **same keys** to `<area>.en.json` and `<area>.de.json` (see translation rule below).
3. In the page: `const t = useTranslations('v2.<area>.<screen>')`; replace strings with `t('key')`
   / `t('key', { name })`. Reuse `v2.common.*` for generic buttons (Start/Save/Cancel/Retry…).
4. If the area is new, add it to `V2_AREAS` in `src/i18n/request.ts`.
5. Verify: `node_modules/.bin/tsc --noEmit` + run `scripts/check-i18n-v2.js` (parity + key coverage).

### Translation rule (decided)
- **UI chrome** (buttons, nav, labels, toasts, empty/error states): LLM-translated en + de inline — done as we go.
- **German learning-content strings** (anything a learner reads *as a model of correct German* —
  pedagogical instructions, example sentences, grammar explanations): translate best-effort but
  **flag in `## German review queue` below** for expert review. Most page-level strings are chrome;
  true learning content mostly comes from the backend, not hardcoded here.

---

## Status

Legend: ✅ done · 🟡 in progress · ⬜ not started

### Foundation
- ✅ `messages/v2/` per-area structure + `request.ts` merge (`V2_AREAS`)
- ✅ Shared chrome — `v2.nav` (all 4 roles' sidebar items + section headings + role pills),
  `v2.shell` (logout, aria), `v2.common` (generic buttons). `nav.ts` gained `NavSection.labelKey`;
  `GaSidebar` renders via `useTranslations('v2')` with VN fallback (`t.has` guard).
- ⬜ `GaTopBar` chrome strings (search placeholder, bell/notifications aria, etc.)
- ⬜ `GaPageHdr` / shared EmptyState / ErrorBanner / LoadingState default copy

### student (`area: student`) — 18 pages
- ✅ dashboard
- ✅ vocabulary · ✅ grammar · ✅ review · ✅ lessons · ✅ roadmap
- ⬜ speaking · mock-exam · exam
- ⬜ classes · classes/[id] · classes/[id]/assignments/[aid] · progress · messages
- ⬜ achievements · tuition · tutor · welcome

### teacher (`area: teacher`) — ~15 pages
- ⬜ (root) · schedule · tc-progress · tc-checklist · grading · grade-image · materials
- ⬜ messages · analytics · profile · tools/grammar · tools/materials · tools/images · classes/[id]/students…

### admin (`area: admin`) — ~25 pages
- ⬜ (root) · revenue · tokens · organizations · free-teachers · users · classes · plans
- ⬜ mock-exam-packs · vocabulary · grammar-review · media · ai-config · broadcast · marketing
- ⬜ analytics · weekly-speaking · reports(+3) · personas · interviews · audit · training-dataset · settings

### org (`area: org`) — ~10 pages
- ⬜ (root) · students · students/[id] · classes · classes/[id] · schedule · teachers · analytics
- ⬜ finance · billing · invitations · roles

### shared / account (`area: account`)
- ⬜ profile · payment · notifications

### public legacy (out of the v2 tree, in scope)
- ⬜ login · register · home (`/`) · pricing · terms · privacy

---

## German review queue
Strings whose German rendering should be checked by a German-language expert before shipping to
DE users (learner-facing / pedagogically sensitive). Nothing from the dashboard pilot qualifies
(all UI chrome). Append here as content-heavy screens are migrated.

- Học tập group (vocabulary · grammar · review · lessons · roadmap): all extracted strings are
  UI chrome (buttons, labels, headers, toasts, empty/error states, CEFR phase descriptions). No
  hardcoded example German sentences or pedagogical grammar explanations — that content is
  backend-supplied. **No German-review flags required for this group.**
