# DeutschFlow Mobile — QA toàn bộ màn hình học viên (2026-06-28)

> **⟳ Re-verify 2026-07-01 (P7):** Toàn bộ 25 HIGH đã được đối chiếu lại với code hiện tại. **24/25 đã được khắc phục** từ sau audit (error-states H1/H4/H9/H13/H21, review onError H5, notifications badge+onError H17/H18, grammar empty H14, exam-attempt back-guard H10, KAV H12/H22/H23/H25, a11y H3/H8/H11/H19 + response-guard H24; các chip/nút đã chuyển sang `SelectableChip`/`IconButton`/`SelectableRow` centralize a11y+44pt → H15/H16). **Chỉ còn H2** (roadmap back không guard `canGoBack`) → **đã fix trong nhánh này** (`roadmap.tsx` onBack → `canGoBack() ? back() : replace('/(student)')`). Còn lại là MEDIUM/LOW + dọn shared-component/token của Pha 4 (mục "Mức sẵn sàng Pha 4").

**Phạm vi:** 24 màn (student) · **Phương pháp:** 24 agent QA song song (code/UX, KHÔNG fidelity vì chưa có design v2 trong repo).

**Tổng:** 0 CRITICAL · 25 HIGH · 59 MEDIUM · 97 LOW. 24 student screens, 0 CRITICAL / 25 HIGH / 59 MEDIUM / 97 LOW (181 findings). No crashers; the app is functionally shippable. Risk is concentrated in three recurring, systemic gaps: (1) data-fetch screens that silently swallow errors and render a failed load as a misleading empty/zero state, (2) accessibility debt on hand-rolled Pressables (no role/label/selected-state, sub-44pt touch targets, color-only meaning), and (3) text-entry screens with no KeyboardAvoidingView. Fix the HIGH cluster (error states, keyboard handling, the unread-badge cache bug, data-loss-on-back) before App Store submission.


## Chủ đề xuyên màn (cross-cutting)

- MISSING ERROR STATES (most impactful theme): 6 fetching screens omit isError handling so a failed/offline load is indistinguishable from a legitimate empty/new-user result, with no retry. Home (4 queries), SRS (failure shows 'no cards due'), Weekly Speaking (silent blank), Learn (zero-value tiles), Grammar (missing empty branch), and Classes detail (assignments/lessons sub-queries fall through to '?? []' as fake-empty). The fix pattern (isError -> <ErrorState onRetry={refetch}/>) already exists in ~13 sibling screens (vocabulary, roadmap, exam, weekly-detail), making these clear oversights.
- ACCESSIBILITY ON HAND-ROLLED PRESSABLES (pervasive HIGH/MEDIUM): bespoke Pressables for chips, radios, filter pills, mark-all, delete-account, XP row, FAQ accordion, mic/send/close icons consistently lack accessibilityRole, accessibilityLabel, and accessibilityState. Affects SRS, Speaking, Exam, Exam-Attempt, Node-Practice, Vocabulary, Video-Lesson, Notifications, Profile, Guide, Classes, Edit-Profile, and the Roadmap node Card.
- SUB-44pt TOUCH TARGETS (App Store HIG): filter/level/topic/option chips and icon-only buttons fall ~26-40pt tall with insufficient or absent hitSlop. Recurs on Vocabulary, Exam, SRS (reset 36pt), Notifications (mark-all 38pt), Video-Lesson (26-28pt chips), Node-Practice (reveal 16pt), Profile, Edit-Profile (Save 38pt), Grammar.
- COLOR-ONLY MEANING: status/selection/correctness conveyed by color (and sometimes opacity:0.5) without a text/icon alternative. Roadmap (locked=opacity-only), Exam-Attempt & Node-Practice (selected option color-only pre-submit), Vocabulary/Exam filters, Stats (leaderboard rank, achievements), Notifications (unread dot), Speaking/Weekly mic record state, Video-Lesson.
- MISSING KeyboardAvoidingView on text-entry screens: Node-Practice (fill-blank), Assignment Detail (essay submit), Edit Profile (autoFocus name), and the Classes join-class sheet all let the keyboard cover the input and/or submit button on small devices — inconsistent with the 4 auth screens + speaking which all wrap in KeyboardAvoidingView.
- HEX-ALPHA STRING CONCATENATION on theme tokens (design-system fragility): theme.colors.accent + '66'/'4D'/'99' and success/info variants to fake translucent borders, assuming 6-digit hex. Appears on Home, Roadmap, Exam, Speaking, Weekly-Speaking, Node-Practice, Notifications, Profile, Guide, Classes. Existing *Soft tokens (accentSoft/infoSoft/successSoft) should replace them; add a withAlpha() helper.
- BOTTOM SAFE-AREA via fixed paddingBottom instead of insets.bottom: most screens use edges={['top']} + a static space[8]/space[10] pad. Combined with the floating glass TabBar overlaying href:null detail routes, the last row/disclaimer can sit under the home indicator or the tab bar (Weekly-Detail, Guide, Classes, Node-Practice, SRS, Video-Lesson, Notifications).
- UNGUARDED router.back(): no router.canGoBack() fallback, so back is a dead control on deep-link/cold-start/post-replace entry. Roadmap (acute — onboarding uses router.replace), Vocabulary, Weekly-Detail, Stats, Upgrade, plus the Exam-Attempt data-loss variant.
- TYPED-ROUTE BYPASS via 'as unknown as Href' double-cast, defeating expo-router typed routes the project opted into. Roadmap, Vocabulary, Exam, Node, Learn, Grammar, Weekly-Speaking, Profile.
- INVALID/MISSING PARAM -> wrong state: NaN id disables the query so the screen renders empty instead of an error/invalid-input state. Exam-Attempt (masquerades as 'unsupported content'), Exam-Review, Node, Node-Practice, Weekly-Detail.
- MUTATIONS WITHOUT onError / cache invalidation: SRS review submit, Notifications mark-read (both also fire-and-forget), Vocabulary markWordLearned (no invalidate). Breaks the app's Alert.alert(apiMessage(e)) convention and leaves stale UI.
- ARRAY-INDEX REACT KEYS on list rows (Exam-Attempt groups, Exam-Review sections, Node theory/phrases, Weekly-Detail rubric, Speaking messages) — safe today but fragile under refetch/reorder.
- expo-av (deprecated SDK 54) for record + TTS on Speaking, Weekly-Speaking, Video-Lesson — uniformly logged as accepted Phase-4 tech-debt; no other SDK54/RN0.81/React19/Reanimated4 breakage found anywhere.

## Thiếu state (loading/error/empty)

- Student Home / Dashboard — MISSING error state (4 queries) and MISSING distinct empty/zero state for genuine new users (failed load == new-user UI).
- SRS Flashcard Review — MISSING error state; a /srs/due failure is rendered as the 'no cards due' empty state.
- Weekly Speaking — MISSING error state on prompt/history; also MISSING empty state for 'PRO user, no prompt this week' (renders null/blank).
- Learn (Skill-tree hub) — MISSING loading skeleton (shows placeholder counts as if real), MISSING error state (zero-value tiles on failure), and MISSING empty state when no actionable nodes; only success is handled.
- Grammar — MISSING empty state for the lessons list (topics.length===0 returns null); loading/error present. (Kasus table always renders, masking the gap.)
- Classes (detail) — assignments/lessons sub-query ERRORS are not surfaced; they render as per-tab empty states with no retry (success/loading/empty present, error swallowed).
- Profile — XP chip has no loading/error/empty; soft-degrades to hidden (acceptable for a non-primary chip, but no feedback on transient error).
- Stats — no top-level empty state for a brand-new all-zeros user (acceptable for an aggregate dashboard); ErrorState retry only refetches the 'stats' query, not the other 5.
- NOTE — legitimately N/A (do NOT flag): Upgrade, Guide, and the (student) _layout are static/navigator with no data fetching; Edit Profile and Assignment Detail submit are mutation/form screens where fetch loading/error/empty correctly do not apply and mutation states are handled.

## Mức sẵn sàng Pha 4

CONDITIONAL GO for the Phase-4 restyle, contingent on first landing the HIGH cluster. The design-system foundation is strong and restyle-ready: nearly every screen already composes Screen/Card/ThemedText/Icon/Pill/Skeleton/EmptyState/ErrorState from components/ui and pulls space/radius/colors tokens, with almost no raw hex fills — so a token/theme revamp will propagate cleanly. Before restyling, knock out these systemic, low-cost items that will otherwise be re-touched per-screen during the reskin: (1) replace all hex-alpha string concatenation (accent+'66'/'4D'/'99', etc.) with *Soft tokens or a shared withAlpha() helper — a latent break the moment a token becomes rgba()/oklch, which a restyle is likely to introduce; (2) extract the duplicated hand-rolled primitives the audit repeatedly flags — a Chip/SegmentedControl, an IconButton (centralizing 44pt targets + a11y role/label/state), a SelectableRow/radio, a Callout/Banner, and a shared Divider/IconChip — since chips/radios/icon-buttons are re-implemented across exam, exam-attempt, node-practice, video-lesson, vocabulary, speaking, and notifications; (3) standardize bottom safe-area as a shared TAB_BAR_CLEARANCE (insets.bottom + bar height) rather than per-screen fixed paddingBottom, and decide whether detail (href:null) routes should live in a Stack so the floating glass TabBar stops overlaying them with a frozen indicator; (4) bake a maxFontSizeMultiplier policy into ThemedText for Dynamic Type. Doing the a11y/touch-target/error-state work inside those shared components means the restyle improves accessibility instead of re-cloning the gaps. Do NOT start Phase 4 on top of the current per-screen Pressables, or the HIGH bugs will be duplicated into the new look.

## Scorecard theo màn

| Màn | Risk | HIGH | MED | LOW | loading | error | empty |
|---|---|---|---|---|---|---|---|
| home-today | medium | 1 | 4 | 5 | ✓ | ✗ | ✗ |
| roadmap | medium | 2 | 3 | 3 | ✓ | ✓ | ✓ |
| vocabulary | medium | 0 | 4 | 5 | ✓ | ✓ | ✓ |
| srs | medium | 2 | 5 | 3 | ✓ | ✗ | ✓ |
| speaking | medium | 3 | 4 | 4 | ✓ | ✓ | ✗ |
| weekly-speaking | medium | 1 | 3 | 4 | ✓ | ✗ | ✓ |
| weekly-detail | low | 0 | 1 | 7 | ✓ | ✓ | ✓ |
| exam | low | 0 | 3 | 4 | ✓ | ✓ | ✓ |
| exam-attempt | medium | 2 | 3 | 5 | ✓ | ✓ | ✓ |
| exam-review | low | 0 | 1 | 4 | ✓ | ✓ | ✓ |
| node | low | 0 | 2 | 7 | ✓ | ✓ | ✓ |
| node-practice | medium | 1 | 2 | 4 | ✓ | ✓ | ✓ |
| learn | medium | 1 | 2 | 4 | ✗ | ✗ | ✗ |
| grammar | low | 1 | 2 | 4 | ✓ | ✓ | ✗ |
| video-lesson | medium | 2 | 4 | 4 | ✓ | ✓ | ✓ |
| stats | low | 0 | 3 | 6 | ✓ | ✓ | ✓ |
| notifications | medium | 2 | 2 | 4 | ✓ | ✓ | ✓ |
| profile | low | 1 | 3 | 5 | ✗ | ✗ | ✗ |
| upgrade | low | 0 | 0 | 4 | ✗ | ✗ | ✗ |
| guide | low | 1 | 1 | 3 | ✗ | ✗ | ✗ |
| classes | medium | 2 | 2 | 4 | ✓ | ✓ | ✓ |
| settings | medium | 2 | 3 | 4 | ✗ | ✓ | ✗ |
| assignments | low | 1 | 1 | 3 | ✓ | ✓ | ✓ |
| student-layout | low | 0 | 1 | 6 | ✗ | ✗ | ✗ |

## Tất cả HIGH findings (cần xử lý trước submit)

### H1. [state] home-today — No error state on any of the four data queries — failed load renders as a zero-value new-user screen
- **Vị trí:** app/(student)/index.tsx:41-63, render 144-146
- **Vấn đề:** All four useQuery calls (dashboard line 41, xp line 47, srs line 53, unread line 59) destructure only data/isLoading/refetch and ignore isError/error. The render path has only isLoading ? <Skeleton> : <success layout>. On a failed or offline fetch with no cached data, the screen shows streak 0, Lv 1, 0 XP, no SRS card — visually identical to a legitimate empty account, with no message and no retry button. ErrorState is exported from components/ui but never used. This is the kind of finding the brief explicitly flags: a data-fetching screen missing an error state.
- **Fix:** Destructure isError from at least the primary dashboard query (and ideally combine the others) and render <ErrorState onRetry={onRefresh} /> when the load fails and there is no data. Keep the partial queries (xp/srs/unread) soft-failing, but the core screen should distinguish 'failed to load' from 'new user'.

### H2. [nav] roadmap — Back button is a dead control for users arriving from onboarding
- **Vị trí:** roadmap.tsx:28; app/(auth)/onboarding.tsx:258; app/(student)/_layout.tsx:27
- **Vấn đề:** AppHeader's onBack calls router.back() (line 28). The screen is a hidden tab (app/(student)/_layout.tsx:27 → href: null) reached via router.push from index.tsx:245 and learn.tsx, but ALSO via router.replace('/(student)/roadmap') from onboarding (app/(auth)/onboarding.tsx:258) for ROADMAP_ALPHABET / ROADMAP_NODE archetypes. After a replace there is no entry beneath roadmap, so a brand-new user's first action — tapping the back chevron — does nothing (or behaves inconsistently depending on the navigator's history). A visible-but-inert back affordance on a first-run screen is a poor App Store first impression.
- **Fix:** Guard the back action: use router.canGoBack() ? router.back() : router.replace('/(student)') (or the home tab). Either omit onBack when there is no history, or always route to a sane home destination so the control is never inert.

### H3. [a11y] roadmap — Tappable node Card has no accessibilityLabel and no status announced to VoiceOver
- **Vị trí:** roadmap.tsx:110-122 (NodeRow Card); Card.tsx:80-83
- **Vấn đề:** Card is rendered pressable (onPress set for non-locked nodes, lines 112-121) but no accessibilityLabel/accessibilityHint is passed. Card.tsx sets accessibilityRole='button' but relies on the caller for the label. VoiceOver will read the concatenated children ('<title> Ngày <n> Đang học?' plus up to 3 tag words) with no indication that it is the active/next/completed lesson, and the marker icon (CheckCircle2/PlayCircle/Lock/Circle) carries the primary status meaning purely visually. Locked rows pass onPress=undefined so Card renders a plain View with no role at all — a screen-reader user cannot tell a locked node is locked.
- **Fix:** Pass an explicit accessibilityLabel like `${node.title}, ngày ${node.dayNumber}, ${statusText}` where statusText is 'đã hoàn thành' / 'đang học' / 'đã khoá' / 'sẵn sàng'. For locked rows, give the Card accessibilityRole='button' + accessibilityState={{disabled:true}} (Card already supports disabled) instead of dropping onPress, so the locked state is announced.

### H4. [state] srs — Network failure on /srs/due is shown as the empty state, not an error
- **Vị trí:** app/(student)/srs.tsx:42-45, 148-168
- **Vấn đề:** useQuery destructures only { data, isLoading, refetch } (line 42). isError is never read and ErrorState is never imported. With the global QueryClient config (retry:1, staleTime:30s in app/_layout.tsx:54), a failed due-cards fetch resolves to isLoading=false and data=undefined, which defaults to cards=[] (line 42). Execution then falls into the empty branch (line 148) and renders EmptyState 'Chưa có thẻ đến hạn' ('No cards due today'). The user is told their review queue is empty when the request actually failed — a misleading false-success. Every sibling fetching screen (vocabulary.tsx:169, plus ~13 others) uses the isError ? <ErrorState onRetry={refetch}/> pattern; this screen is an outlier.
- **Fix:** Destructure isError from useQuery and add a branch before the empty check: if (isError) return <Screen edges={['top']}><AppHeader title="Ôn tập SRS" onBack={...}/><View style={{flex:1,justifyContent:'center'}}><ErrorState onRetry={() => void refetch()} /></View></Screen>. Import ErrorState from '@/components/ui'.

### H5. [bug] srs — Review grade submission is fire-and-forget with no error handling
- **Vị trí:** app/(student)/srs.tsx:68-74, 84-91, 125, 128
- **Vấn đề:** submitReview (line 84-91) calls `void reviewMutation.mutateAsync({ vocabId, quality })` then immediately advance(). reviewMutation (line 68-74) has onSuccess but no onError. If POST /srs/review fails (offline, 500, expired session beyond the single refresh retry), the card has already advanced and the user's grade is silently lost — the SRS schedule for that word is never updated and the user gets zero feedback. Because mutateAsync's rejection is swallowed by `void`, it also produces an unhandled promise rejection. On swipe this is worse: the failure happens deep inside a withTiming→runOnJS callback with no surfacing path.
- **Fix:** Use mutate (not void mutateAsync) and add onError to the mutation to surface a toast/inline message and ideally re-enqueue or roll back the advance. At minimum catch the rejection so it is not unhandled, and consider blocking advance until the mutation settles, or optimistic-with-rollback per the project's patterns.md.

### H6. [state] speaking — speakGerman setTimeout fallbacks are untracked → setState after unmount/reset
- **Vị trí:** speaking.tsx:148, 191, 117-124
- **Vấn đề:** speakGerman has two fire-and-forget timers: the empty-text path `setTimeout(finish, 600)` (line 148) and the no-TTS/no-speech fallback `setTimeout(finish, Math.min(4200, 1200 + len*42))` (line 191). Neither is stored in a ref. `finish()` calls the passed `onDone` which runs flashReaction/setStage/Haptics (and in submitAnswer can trigger more state). The unmount cleanup (lines 117-124) only clears typingRef/reactionRef and calls stopSpeech() — it does NOT cancel these speak timers. If the user unmounts the screen (navigates away) or calls resetToSelect()/handleClose() while a reply is being 'spoken' via the timed fallback (the common case when TTS provider is unconfigured — which the comments say is expected), onDone fires later and calls setState on a torn-down/reset flow, producing a React warning and a flash of stale stage/reaction.
- **Fix:** Store the fallback timer id in a ref (e.g. speakTimerRef) and clear it in the unmount cleanup, in stopSpeech(), and at the top of resetToSelect(). Also guard finish() with an isMounted ref so onDone never runs after teardown.

### H7. [safe-area] speaking — Chat input dock ignores bottom safe-area inset on Face-ID devices
- **Vị trí:** speaking.tsx:584, 662-673
- **Vấn đề:** The chat/practice view uses `<Screen edges={['top']}>` (line 584) so the bottom inset is never applied. The input dock (lines 662-733) hardcodes `paddingBottom: space[4]` (16px). On notch/Dynamic-Island devices (iPhone X–16 Pro Max) the home indicator occupies ~34pt at the bottom; with the keyboard dismissed the mic/send buttons and text field sit under/too close to the home indicator. KeyboardAvoidingView 'padding' only compensates when the keyboard is open, so the resting state is wrong. The summary/select views use Screen which handles top only too, but their content scrolls and ends with paddingBottom, so the dock is the acute case.
- **Fix:** Read useSafeAreaInsets() and set the dock paddingBottom to `Math.max(space[4], insets.bottom)` (or insets.bottom + space[2]). Keep KeyboardAvoidingView for the open-keyboard case. Do NOT add edges 'bottom' to Screen or it will double-pad.

### H8. [a11y] speaking — Icon-only controls have no accessibilityLabel / accessibilityRole
- **Vị trí:** speaking.tsx:600, 614, 676, 719, 541, 568
- **Vấn đề:** All interactive controls are bare Pressables with only an Icon child and no a11y metadata: header close ✕ (line 600), Flag/end (line 614), mic record/stop (line 676), send (line 719), resume card + dismiss ✕ (lines 541, 568). VoiceOver will announce them as unlabeled buttons ('button') or not at all. The mic button additionally conveys record vs stop state purely by color (danger fill) and icon — color-only meaning with no label change. This is an App Store accessibility quality gap and likely an audit flag.
- **Fix:** Add accessibilityRole='button' and a dynamic accessibilityLabel to each (e.g. mic: isRecording ? 'Dừng ghi âm' : 'Ghi âm câu trả lời'; send: 'Gửi câu trả lời'; close: 'Đóng'; flag: 'Kết thúc và xem đánh giá'). Prefer reusing IconButton from components/ui which can centralize this.

### H9. [state] weekly-speaking — No error state on prompt/history queries — failed fetch shows a silent blank screen
- **Vị trí:** weekly-speaking.tsx:36-56, render gap at 89-110 (cf. weekly-detail.tsx:33-34)
- **Vấn đề:** Both useQuery hooks (lines 36-44 prompt, 46-56 history) destructure data/loading/refetch but never isError. When the prompt fetch fails, promptLoading becomes false and prompt is undefined, so the render chain `promptLoading ? Skeleton : prompt ? Card : null` (lines 89-110) resolves to null — the user sees only the header over an empty body, with no error message and no way to retry except an undiscoverable pull-to-refresh. History errors are also swallowed (defaults to []). This is demonstrably an oversight, not a deliberate choice: the sibling screen weekly-detail.tsx (lines 15,33-34) destructures isError and renders `<ErrorState onRetry={() => void refetch()} />`. ErrorState is already exported from components/ui.
- **Fix:** Destructure isError from the prompt query and render <ErrorState onRetry={() => { void refetchPrompt(); void refetchHistory() }} /> when isError && !prompt, mirroring weekly-detail.tsx. Optionally also surface history isError inline.

### H10. [state] exam-attempt — Back during an in-progress attempt silently discards all answers and orphans the server attempt
- **Vị trí:** exam-attempt.tsx:63 (onBack), no beforeRemove anywhere in file
- **Vấn đề:** AppHeader onBack just calls router.back() (line 63). There is no confirmation dialog, no beforeRemove/usePreventRemove guard, and no save of in-progress answers. The attempt was already created server-side by exam.tsx's startExam.mutate before navigation, so leaving without finishing leaves a dangling IN_PROGRESS attempt and loses all entered answers. iOS users will also trigger this via the interactive swipe-back gesture, which is even easier to hit accidentally mid-exam.
- **Fix:** When answeredCount > 0 and score == null, intercept back (Alert confirm or navigation beforeRemove listener) before discarding. Consider disabling the swipe-back gesture for this route or persisting answers. Emit trackFeatureAction('mock_exam','quit') on confirmed abandon to keep the started→completed funnel honest.

### H11. [a11y] exam-attempt — Custom radio choices have no accessibility role/state and are not announced as selectable
- **Vị trí:** exam-attempt.tsx:180-211 (Choice Pressable)
- **Vấn đề:** The Choice Pressable (lines 177-212) renders a custom radio (a View circle + check Icon) but sets no accessibilityRole, no accessibilityState={{selected}}, and no accessibilityLabel. VoiceOver reads only the inner label text with no indication it is a selectable option or whether it is currently selected — selection state is conveyed purely by color/border (color-only meaning). This is the core interaction of the screen.
- **Fix:** Add accessibilityRole='radio' (or 'button'), accessibilityState={{ selected: active }}, and an accessibilityLabel/value so the selected option is announced. The decorative check Icon is fine but state must not be color-only.

### H12. [a11y] node-practice — No KeyboardAvoidingView — fill-blank inputs and submit button obscured by keyboard
- **Vị trí:** node-practice.tsx:121 (Screen scroll) + 299-317 (TextInput) + 152-166 (Button); contrast components/ui/Screen.tsx:40-60
- **Vấn đề:** This is a text-entry exercise screen: FILL_BLANK exercises render TextInputs (node-practice.tsx:299-317) and the 'Nộp bài'/'Làm lại'/'Xong' Button is the last item in the ScrollView (152-166). The screen wraps content in <Screen scroll> (a plain ScrollView, see components/ui/Screen.tsx:40-60) with NO KeyboardAvoidingView. On small devices (iPhone SE) tapping a fill-blank near the bottom raises the keyboard over both the focused field and the submit button, with no way to scroll the input into view while typing. The auth and speaking screens in this app DO use KeyboardAvoidingView (app/(auth)/login.tsx, register.tsx, speaking.tsx), so this is an inconsistency, not a platform limitation. keyboardShouldPersistTaps="handled" is set on the ScrollView which helps dismiss-on-tap but does not move content above the keyboard.
- **Fix:** Wrap the scrollable success branch in a KeyboardAvoidingView (behavior=Platform.OS==='ios'?'padding':'height') with an appropriate keyboardVerticalOffset for the AppHeader, mirroring the auth screens. Alternatively add automaticallyAdjustKeyboardInsets to the ScrollView (RN 0.70+) so the focused TextInput and submit button stay reachable.

### H13. [state] learn — No error state — failed fetch silently renders misleading success UI
- **Vị trí:** learn.tsx:20-24, 26-39
- **Vấn đề:** useQuery destructures only { data: nodes = [], refetch, isFetching } (learn.tsx:20-24). isError/error are never read. With data defaulting to [], a network failure (timeout=15s in api.ts) produces the exact same layout as a successful empty fetch: the 5 tiles render with placeholder counts ('0 đã học', 'Ngày 1') and both data sections collapse to nothing. The user gets no signal that loading failed and no retry button. The design system ships an ErrorState (components/ui/ErrorState.tsx) with a Vietnamese default message and retry, which is unused here.
- **Fix:** Destructure isError and render <ErrorState onRetry={() => void refetch()} /> inside <Screen> when isError is true (and not still showing cached data). At minimum gate the data sections so a real failure is distinguishable from an empty-but-successful tree.

### H14. [state] grammar — Missing empty state for grammar lessons list
- **Vị trí:** grammar.tsx:170-205 (the `topics.length > 0 ? (...) : null` ternary)
- **Vấn đề:** When the topics query succeeds with an empty array (topics.length === 0) and it is not loading or erroring, the lessons branch resolves to `null` (the trailing `: null` at line 205). The 'Bài học ngữ pháp' SectionHeader and any lessons content simply do not render — there is no EmptyState. A student whose A1 syllabus returns zero topics (new account, content gap, or a backend filtering edge) sees the Kasus table and then nothing, with no explanation. The Card-table is always visible so the screen is not fully blank, which hides this regression during casual testing.
- **Fix:** Add an explicit empty branch using the shared EmptyState component (already imported and used in the sibling app/(student)/video-lesson.tsx). e.g. render `<EmptyState icon={BookOpen} title="Chưa có bài học" message="Cấp A1 chưa có bài học ngữ pháp. Thử lại sau." />` when topics.length === 0, so the success-but-empty case is communicated.

### H15. [a11y] video-lesson — Filter/topic chips and export button have no accessibility metadata
- **Vị trí:** video-lesson.tsx:115-135, 137-172, 176-191, 208-223
- **Vấn đề:** Every interactive Pressable on this screen is missing accessibilityRole, accessibilityLabel, and accessibilityState. The level chips (lines 115-135), 'Tới hạn' chip (137-154), 'Hội thoại' chip (155-172), the .mp4 export button (176-191), and the topic chips (208-223) are all bare Pressables. Screen-reader users get an unlabeled, role-less tap target with no selected/disabled announcement. Contrast this with AppHeader's back button (AppHeader.tsx:34-35) which correctly sets accessibilityRole='button' + accessibilityLabel='Quay lại'.
- **Fix:** Add accessibilityRole="button", an accessibilityLabel (e.g. the level/topic text or 'Xuất video mp4'), and accessibilityState={{ selected: active, disabled: exporting }} to each chip and the export button. Adopting the Pill component (which can centralize this) would fix it in one place.

### H16. [a11y] video-lesson — Tap targets below the 44pt iOS minimum
- **Vị trí:** video-lesson.tsx:124, 143, 161, 213, 179
- **Vấn đề:** Level/'Tới hạn'/'Hội thoại' chips use paddingVertical: 6 around a label with lineHeight 16 => ~28pt tall (lines 124,143,161). Topic chips use paddingVertical: 5 around caption lineHeight 16 => ~26pt tall (line 213). The export button has no minimum height and only hitSlop={8} on a row of 18px icon + 13px label. All fall short of Apple's 44x44pt minimum hit target, and none of the chips declare hitSlop to compensate.
- **Fix:** Raise vertical padding to reach ~44pt, or add hitSlop to expand the touchable region (e.g. hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}). The shared Pill component should enforce a minimum height.

### H17. [state] notifications — Marking notifications read does not invalidate the unread-count query that drives the home badge
- **Vị trí:** /Users/dinhcu/Developer/DeutschFlow/mobile/app/(student)/notifications.tsx:27-39 (and app/(student)/index.tsx:59-63)
- **Vấn đề:** Both mutations invalidate ['notifications'] and ['dashboard'] (lines 28-29, 36-37). But the home-screen bell badge is driven by a SEPARATE query keyed ['unread-count'] (app/(student)/index.tsx:59-63, staleTime 30s). Neither mutation invalidates ['unread-count'], so after the user marks all/one read and navigates back, the badge still shows the old count until the 30s staleTime expires AND something triggers a refetch. The ['dashboard'] invalidation is also likely a no-op for the badge: /student/dashboard (index.tsx:43) is a different payload from /notifications/unread-count.
- **Fix:** Add qc.invalidateQueries({ queryKey: ['unread-count'] }) to both markAllRead.onSuccess and markOneRead.onSuccess. Verify whether ['dashboard'] is still needed; if the dashboard payload carries no unread count, drop it to avoid a confusing/unnecessary refetch.

### H18. [bug] notifications — Both mutations have no onError handler — failures are silent (unhandled rejection + no user feedback)
- **Vị trí:** /Users/dinhcu/Developer/DeutschFlow/mobile/app/(student)/notifications.tsx:25-39
- **Vấn đề:** markAllRead (lines 25-31) and markOneRead (lines 33-39) define only onSuccess. The rest of the app consistently surfaces mutation errors with onError: (e) => Alert.alert(..., apiMessage(e)) (see exam.tsx:66, assignments/[id].tsx:51, classes/index.tsx:256). Here, if /notifications/read-all or /notifications/{id}/read fails (offline, 500), the user taps, the dot/border do not change (no optimistic update either), and nothing is shown — the action appears to do nothing. React Query swallows the rejection so it is not a crash, but it is a silent failure that breaks the screen's perceived interactivity.
- **Fix:** Add onError to both mutations using the existing pattern: onError: (e) => Alert.alert('Lỗi', apiMessage(e)) (import Alert from 'react-native', apiMessage from '@/lib/api'). Consider an optimistic update (set item.isRead in the cache, roll back on error) so the dot disappears immediately.

### H19. [a11y] profile — Destructive 'Xoá tài khoản' Pressable has no accessibilityRole/label
- **Vị trí:** profile.tsx:176-185
- **Vấn đề:** The delete-account control (lines 176-185) is a raw RN Pressable wrapping a small Trash2 icon + faint caption. Unlike Card/ListRow (which inject accessibilityRole="button" + accessibilityLabel), a raw Pressable exposes nothing to VoiceOver — it announces as plain text, not a button, and gives no hint that it triggers an irreversible account deletion. For a destructive action this is the most important control on the screen to label.
- **Fix:** Add accessibilityRole="button" and accessibilityLabel="Xoá tài khoản" (plus an accessibilityHint describing permanence) to the Pressable. Consider routing it through the shared Card/Button system which already handles this.

### H20. [a11y] guide — FAQ accordion is not accessible — no role, no expanded state announced
- **Vị trí:** guide.tsx:148-164 (Pressable in FaqRow)
- **Vấn đề:** FaqRow (guide.tsx:142-178) uses a raw <Pressable> (line 148) with NO accessibilityRole and NO accessibilityState. VoiceOver therefore announces the question as plain text and gives no cue that it expands/collapses, and screen-reader users get no feedback when toggling. The disclosure chevron (ChevronDown) is purely visual (color-only/icon-only meaning) with no accessible alternative. This is the only interactive element on the screen that bypasses the Card component's built-in a11y.
- **Fix:** On the Pressable add accessibilityRole="button" and accessibilityState={{ expanded: open }}, and an accessibilityLabel of the question text (or rely on the child text). Optionally accessibilityHint like 'Nhấn để mở/đóng câu trả lời'. The chevron can stay decorative once state is announced.

### H21. [state] classes — Detail screen swallows assignments/lessons fetch errors and shows a misleading empty state
- **Vị trí:** /Users/dinhcu/Developer/DeutschFlow/mobile/app/(student)/classes/[id].tsx:67-68, 250-255, 372-383
- **Vấn đề:** In [id].tsx only detailQ drives the screen-level error branch (lines 54-64). assignmentsQ and lessonsQ are read as `assignments = assignmentsQ.data ?? []` (line 67) and `lessons = lessonsQ.data ?? []` (line 68). If detail succeeds but either sub-query fails (timeout, 500, transient 401-after-refresh-failure), the user is shown 'Chưa có bài tập' / 'Chưa có checklist' EmptyState with NO error indication and NO retry — data loss presented as no-data. This is a genuine correctness/UX defect on a network-driven screen.
- **Fix:** Per-tab, branch on the relevant query's error/isLoading. e.g. AssignmentsTab should receive assignmentsQ.error and render ErrorState with onRetry={assignmentsQ.refetch} when error && !data; same for ProgressTab with lessonsQ. At minimum surface an inline retry within the tab instead of EmptyState when the query errored.

### H22. [state] classes — Join-class bottom sheet has no keyboard avoidance — keyboard covers input and buttons
- **Vị trí:** /Users/dinhcu/Developer/DeutschFlow/mobile/app/(student)/classes/index.tsx:263-323
- **Vấn đề:** JoinClassModal (index.tsx:263-323) is an absolute-positioned overlay anchored with justifyContent:'flex-end'. There is no KeyboardAvoidingView. When the TextField focuses, the iOS keyboard slides up over the bottom-anchored sheet, hiding the 'Mã mời' input and the Huỷ/Gửi yêu cầu buttons on all but the tallest devices, making the form effectively unusable on an iPhone SE.
- **Fix:** Wrap the sheet in KeyboardAvoidingView (behavior='padding' on iOS) or use a real <Modal> with a keyboard-aware sheet. Combine with the safe-area fix below so the lifted sheet still clears the home indicator.

### H23. [bug] settings — Missing KeyboardAvoidingView on an autoFocus text-entry screen
- **Vị trí:** profile.tsx:34-104 (Screen/View), 70-79 (autoFocus TextField); cf. app/(auth)/reset-password.tsx:58-59
- **Vấn đề:** The screen autoFocuses the name TextField (line 75) which raises the keyboard immediately, but the screen has no KeyboardAvoidingView. The content sits in a plain View inside a non-scrolling Screen (edges={['top']}). On small devices (iPhone SE) the keyboard can overlap the input and, critically, the inline validation error line ('Tên phải có ít nhất 2 ký tự.', line 78) and the email helper text below it — the user cannot see why Save is disabled. Every other text-entry screen in the app (login, register, reset-password, forgot-password) wraps content in KeyboardAvoidingView with behavior={Platform.OS==='ios'?'padding':'height'}; this screen is the inconsistent outlier.
- **Fix:** Wrap the content View in KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} (or make Screen scrollable with keyboardShouldPersistTaps='handled', which Screen already supports via scroll), matching the auth screens.

### H24. [state] settings — Auth store written from un-validated PATCH response shape (cross-endpoint contract trust)
- **Vị trí:** profile.tsx:16-22 (mutationFn + onSuccess); useAuthStore.ts:46,60 use /auth/me
- **Vấn đề:** onSuccess does setUser({ ...user, displayName: res.data.displayName }) (line 19), trusting that PATCH /profile/me returns a flat { displayName: string }. The store is otherwise populated exclusively from GET /auth/me which returns the full AuthUser ({id,displayName,email,role}). These are different endpoints. If /profile/me returns a wrapped envelope, a different field name, or omits displayName, res.data.displayName is undefined and the store's displayName silently becomes undefined — which then renders as an empty name on the profile tab and a '?' avatar initial. There is no runtime validation (no Zod, no fallback to the submitted `trimmed`).
- **Fix:** Validate/guard the response, e.g. const next = res.data?.displayName ?? trimmed; if the field is missing fall back to the value the user just submitted, or parse with a small Zod schema. At minimum: setUser({ ...user, displayName: res.data?.displayName || trimmed }).

### H25. [a11y] assignments — Multiline essay submit form has no KeyboardAvoidingView — input and confirm button obscured on small devices
- **Vị trí:** app/(student)/assignments/[id].tsx:84-102, 172-216 (compare app/(auth)/login.tsx:69-71)
- **Vấn đề:** SubmitForm (lines 172-216) renders a multiline TextField (minHeight 160) followed by an info box and the 'Xác nhận nộp bài' button, all inside the page ScrollView (lines 84-102). There is no KeyboardAvoidingView. Every other text-input screen in the app uses one — app/(auth)/login.tsx:70-71 wraps its ScrollView in KeyboardAvoidingView with behavior={Platform.OS==='ios'?'padding':'height'}, and register/forgot-password/reset-password/speaking follow the same pattern. On an iPhone SE the soft keyboard covers the lower portion of the form; because the submit button sits AFTER the tall input, the user cannot see the button or the bottom of their essay while typing. keyboardShouldPersistTaps='handled' lets a tap pass through but does not bring the button into view.
- **Fix:** Wrap the ScrollView in <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1}} keyboardVerticalOffset={...}> mirroring the auth screens, OR move the submit form into a sticky footer. Also consider auto-scrolling to the input on focus.
