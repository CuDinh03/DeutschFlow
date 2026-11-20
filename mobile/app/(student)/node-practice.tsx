import { useMemo, useState, useEffect, useRef } from 'react'
import { View, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams, type Href } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Check, X, Eye } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { trackFeatureAction } from '@/lib/analytics'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, Button, EmptyState, ErrorState, Skeleton, SelectableRow, GaGlyph, ProgressBar } from '@/components/ui'
import { Badge, Eyebrow, RuledNote, TopBar } from '@/components/learn/HocOnParts'
import { answeredScored, EXERCISE_KIND_LABEL, exerciseKinds } from '@/lib/hocOnUi'
import {
  skillTreeApi,
  isFillCorrect,
  type Exercise,
  type ExerciseMultipleChoice,
  type ExerciseFillBlank,
  type ExerciseTranslate,
  type ExerciseReorder,
} from '@/lib/skillTreeApi'
import { findNextNode } from '@/lib/nextNode'
import { completionCaption, completionTitle } from '@/lib/nodeActions'
import { LessonCompleteNav } from '@/components/LessonCompleteNav'
import { useBackTo } from '@/hooks/useBackTo'
import { PARENT_OF } from '@/lib/screenParents'

type Answer = { choice?: number; text?: string }
const SCORED = new Set(['MULTIPLE_CHOICE', 'FILL_BLANK'])
// Cap how long we hold the loading state waiting for the fresh tree before revealing the
// result: happy-path refetch lands well under this; a slow refetch reveals anyway and the
// derived nextNode self-heals when the observer catches up (the lesson is already graded).
const REVEAL_TREE_CAP_MS = 3000

// Giao diện v3.4 (Đợt 6A, mẫu `practice`): nút thoát + thanh tiến độ "đã làm/tổng" ở đầu màn,
// thẻ "Các dạng bài trong bài học này", mỗi câu có nhãn dạng bài. Vẫn làm hết rồi nộp một lần
// như trước — logic chấm/nộp không đổi.
export default function NodePracticeScreen() {
  // Remount the runner when nodeId changes so stale submitted/result/answers (and the
  // per-exercise child state) from the previous lesson never leak in via "Bài tiếp theo".
  const { nodeId } = useLocalSearchParams<{ nodeId: string }>()
  return <NodePracticeRunner key={nodeId ?? 'none'} />
}

function NodePracticeRunner() {
  // Back tường minh về màn cha — Tabs firstRoute sẽ về Heute (xem lib/screenParents).
  const goBack = useBackTo(PARENT_OF['node-practice'])
  const c = useTheme().colors
  const qc = useQueryClient()
  const params = useLocalSearchParams<{ nodeId: string; title?: string }>()
  const nodeId = Number(params.nodeId)

  const startedRef = useRef(false)
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true
      trackFeatureAction('lesson', 'started', { node_id: nodeId })
    }
  }, [nodeId])

  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{
    correct: number
    total: number
    completed: boolean
    xp: number
    alreadyCompleted: boolean
  } | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['node-session', nodeId],
    queryFn: () => skillTreeApi.getNodeSession(nodeId),
    enabled: Number.isFinite(nodeId),
  })

  // Observe the tree so "Bài tiếp theo" is derived (never held as stale state); it refreshes
  // when submit invalidates the tree below, re-deriving to the freshly-unlocked node.
  const { data: tree = [] } = useQuery({
    queryKey: ['skill-tree'],
    queryFn: () => skillTreeApi.getMySkillTree(),
    staleTime: 120_000,
  })

  const exercises = useMemo<Exercise[]>(() => {
    const ex = data?.content?.exercises
    return [...(ex?.theory_gate ?? []), ...(ex?.practice ?? [])].filter((e) => e && e.id && e.type)
  }, [data?.content?.exercises])

  const scoredCount = exercises.filter((e) => SCORED.has(e.type)).length
  const answered = answeredScored(exercises, answers)
  const kinds = exerciseKinds(exercises.map((e) => e.type))
  const nextNode = result?.completed ? findNextNode(tree, nodeId) : undefined

  function setChoice(id: string, choice: number) {
    if (submitted) return
    setAnswers((p) => ({ ...p, [id]: { ...p[id], choice } }))
  }
  function setText(id: string, text: string) {
    if (submitted) return
    setAnswers((p) => ({ ...p, [id]: { ...p[id], text } }))
  }

  function grade(): number {
    let correct = 0
    for (const e of exercises) {
      if (e.type === 'MULTIPLE_CHOICE') {
        if (answers[e.id]?.choice === (e as ExerciseMultipleChoice).correct) correct++
      } else if (e.type === 'FILL_BLANK') {
        if (isFillCorrect(answers[e.id]?.text ?? '', e as ExerciseFillBlank)) correct++
      }
    }
    return correct
  }

  async function submit() {
    if (busy) return
    const correct = grade()
    const percent = scoredCount > 0 ? Math.round((correct / scoredCount) * 100) : 100
    setBusy(true)
    try {
      // Send the raw answers so the backend grades them server-side (authoritative);
      // `percent` is only a legacy fallback. The local `correct`/`scoredCount` is for
      // instant UI feedback and uses the same rules as the server.
      const res = await skillTreeApi.submitNode(nodeId, percent, answers)
      const completed = res.completed ?? percent >= 100
      trackFeatureAction('lesson', 'completed', { node_id: nodeId, completed, percent })
      // node-session drives the node-detail view; the tree unlocks the next node + refreshes
      // Home/roadmap and feeds the derived "Bài tiếp theo".
      qc.invalidateQueries({ queryKey: ['node-session', nodeId] })
      const treeRefresh = qc.invalidateQueries({ queryKey: ['skill-tree'] }).catch(() => {})
      // Lernweg + card Lộ trình đọc /roadmap/me (N1, 05/09) — làm mới cùng lúc với skill-tree.
      void qc.invalidateQueries({ queryKey: ['roadmap-me'] }).catch(() => {})
      // On completion, wait for the fresh tree BEFORE revealing the result so the derived
      // nextNode is correct on first render (no transient "hết bài" caption / missing button).
      // `busy` keeps the submit button in its loading state throughout, so nothing flashes.
      if (completed) {
        await Promise.race([treeRefresh, new Promise<void>((resolve) => setTimeout(resolve, REVEAL_TREE_CAP_MS))])
      }
      setSubmitted(true)
      setResult({
        correct,
        total: scoredCount,
        completed,
        xp: res.xpEarned ?? 0,
        alreadyCompleted: res.alreadyCompleted === true,
      })
      await Haptics.notificationAsync(
        completed
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      )
    } catch (e) {
      Alert.alert('Lỗi', apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen edges={['top']}>
      <TopBar onBack={goBack} backIcon={X} backLabel="Thoát" title={scoredCount > 0 ? undefined : params.title ?? data?.titleVi ?? 'Luyện tập'}>
        {scoredCount > 0 && !isLoading && !isError ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <View style={{ flex: 1 }}>
              <ProgressBar value={answered / scoredCount} />
            </View>
            <ThemedText variant="label" accessibilityLabel={`Đã làm ${answered} trên ${scoredCount} câu chấm điểm`}>
              {answered}/{scoredCount}
            </ThemedText>
          </View>
        ) : undefined}
      </TopBar>

      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <Skeleton height={110} radius="md" />
          <Skeleton height={110} radius="md" />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : exercises.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState glyph="thithu" title="Chưa có bài tập" message="Bài học này chưa có bài tập trên app." />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <Screen scroll keyboardInsets={false} edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[3], paddingTop: space[4] }}>
          {result ? (
            result.completed ? (
              // Completion = the climactic moment: editorial ink hero (mirrors Home).
              <Card style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface, borderRadius: radius.lg, gap: space[3] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <ThemedText variant="label" style={{ color: c.accent, letterSpacing: 1, textTransform: 'uppercase' }}>
                    Hoàn thành chặng
                  </ThemedText>
                  {scoredCount > 0 ? (
                    <ThemedText variant="monoLg" style={{ color: c.onInk }}>
                      {result.correct}/{result.total}
                    </ThemedText>
                  ) : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: radius.md,
                      backgroundColor: c.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <GaGlyph name="thithu" size={18} ink="primary" gold="ink" />
                  </View>
                  <ThemedText variant="title" style={{ flex: 1, color: c.onInk }}>
                    {completionTitle(result.xp, result.alreadyCompleted)}
                  </ThemedText>
                </View>
                <ThemedText variant="caption" style={{ color: c.onInkMuted }}>
                  {completionCaption(!!nextNode, result.alreadyCompleted)}
                </ThemedText>
              </Card>
            ) : (
              <Card style={{ gap: space[2], borderColor: c.borderStrong, borderRadius: radius.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Eyebrow>Kết quả</Eyebrow>
                  {scoredCount > 0 ? (
                    <ThemedText variant="monoLg">
                      {result.correct}/{result.total}
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText variant="caption" color="muted">
                  Chưa đạt yêu cầu để hoàn thành. Xem đáp án bên dưới rồi thử lại.
                </ThemedText>
              </Card>
            )
          ) : null}

          {!result ? (
            <View style={{ gap: space[1] }}>
              <Eyebrow>{scoredCount > 0 ? `${exercises.length} bài tập` : 'Tự luyện'}</Eyebrow>
              <ThemedText variant="titleLg" accessibilityRole="header">
                {params.title ?? data?.titleVi ?? 'Luyện tập'}
              </ThemedText>
            </View>
          ) : null}

          {!result && kinds.length > 0 ? (
            <View style={{ backgroundColor: c.surfaceSunken, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingVertical: space[3], paddingHorizontal: space[4], gap: space[2] }}>
              <ThemedText variant="label">Các dạng bài trong bài học này</ThemedText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {kinds.map((k) => (
                  <Badge key={k} label={k} />
                ))}
              </View>
            </View>
          ) : null}

          {exercises.map((ex, i) => (
            <ExerciseCard
              key={ex.id}
              index={i + 1}
              exercise={ex}
              answer={answers[ex.id]}
              submitted={submitted}
              onChoice={(v) => setChoice(ex.id, v)}
              onText={(v) => setText(ex.id, v)}
            />
          ))}

          {!submitted ? (
            <Button
              label={busy ? (scoredCount > 0 ? 'Đang chấm…' : 'Đang lưu…') : scoredCount > 0 ? 'Nộp bài' : 'Hoàn thành'}
              onPress={submit}
              loading={busy}
            />
          ) : result && !result.completed ? (
            <Button
              label="Làm lại"
              variant="secondary"
              onPress={() => {
                setSubmitted(false)
                setResult(null)
                setAnswers({})
              }}
            />
          ) : (
            <LessonCompleteNav
              onNext={
                nextNode
                  ? () =>
                      router.replace({
                        pathname: '/(student)/node',
                        params: { nodeId: String(nextNode.id), title: nextNode.title },
                      } as unknown as Href)
                  : undefined
              }
              onRoadmap={() => router.replace('/(student)/lernweg')}
            />
          )}
        </Screen>
        </KeyboardAvoidingView>
      )}
    </Screen>
  )
}

function ExerciseCard({
  index,
  exercise,
  answer,
  submitted,
  onChoice,
  onText,
}: {
  index: number
  exercise: Exercise
  answer?: Answer
  submitted: boolean
  onChoice: (v: number) => void
  onText: (v: string) => void
}) {
  switch (exercise.type) {
    case 'MULTIPLE_CHOICE':
      return <McCard index={index} ex={exercise as ExerciseMultipleChoice} answer={answer} submitted={submitted} onChoice={onChoice} />
    case 'FILL_BLANK':
      return <FillCard index={index} ex={exercise as ExerciseFillBlank} answer={answer} submitted={submitted} onText={onText} />
    case 'TRANSLATE':
      return <RevealCard index={index} prompt={(exercise as ExerciseTranslate).sentence} answer={(exercise as ExerciseTranslate).answer} kind={EXERCISE_KIND_LABEL.TRANSLATE} />
    case 'REORDER':
      return (
        <RevealCard
          index={index}
          prompt={(exercise as ExerciseReorder).translation ?? (exercise as ExerciseReorder).words.join(' / ')}
          answer={(exercise as ExerciseReorder).correct_order.join(' ')}
          kind={EXERCISE_KIND_LABEL.REORDER}
        />
      )
    default:
      return null
  }
}

/** Đầu một câu: nhãn "Câu n · dạng bài" (mẫu `.eyebrow`) rồi đề bài. */
function Prompt({ index, text, kind }: { index: number; text?: string; kind: string }) {
  return (
    <View style={{ gap: space[1] }}>
      <Eyebrow>{`Câu ${index} · ${kind}`}</Eyebrow>
      <ThemedText variant="bodyLg">{text}</ThemedText>
    </View>
  )
}

function McCard({
  index,
  ex,
  answer,
  submitted,
  onChoice,
}: {
  index: number
  ex: ExerciseMultipleChoice
  answer?: Answer
  submitted: boolean
  onChoice: (v: number) => void
}) {
  const c = useTheme().colors
  return (
    <Card style={{ gap: space[3], borderRadius: radius.lg }}>
      <Prompt index={index} text={ex.question_vi ?? ex.question} kind={EXERCISE_KIND_LABEL.MULTIPLE_CHOICE} />
      <View style={{ gap: space[2] }}>
        {ex.options.map((opt, i) => {
          const selected = answer?.choice === i
          const isAnswer = i === ex.correct
          const border = submitted ? (isAnswer ? c.success : selected ? c.danger : c.border) : selected ? c.textPrimary : c.borderStrong
          const bg = submitted ? (isAnswer ? c.successSoft : selected ? c.dangerSoft : c.surface) : selected ? c.accentSoft : c.surface
          return (
            <SelectableRow
              key={i}
              label={opt}
              selected={selected}
              disabled={submitted}
              onPress={() => onChoice(i)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[2],
                borderWidth: 1.5,
                borderColor: border,
                backgroundColor: bg,
                borderRadius: radius.md,
                paddingHorizontal: space[4],
                minHeight: 52,
              }}
            >
              <ThemedText variant="body" style={{ flex: 1, paddingVertical: space[3] }}>
                {opt}
              </ThemedText>
              {/* Non-colour cue so the chosen option isn't conveyed by accent fill alone (color-blind). */}
              {!submitted && selected ? <Icon icon={Check} size={16} color="primary" /> : null}
              {submitted && isAnswer ? <Icon icon={Check} size={16} color="success" /> : null}
              {submitted && selected && !isAnswer ? <Icon icon={X} size={16} color="danger" /> : null}
            </SelectableRow>
          )
        })}
      </View>
    </Card>
  )
}

function FillCard({
  index,
  ex,
  answer,
  submitted,
  onText,
}: {
  index: number
  ex: ExerciseFillBlank
  answer?: Answer
  submitted: boolean
  onText: (v: string) => void
}) {
  const c = useTheme().colors
  const ok = submitted && isFillCorrect(answer?.text ?? '', ex)
  return (
    <Card style={{ gap: space[2], borderRadius: radius.lg }}>
      <Prompt index={index} text={ex.sentence_de ?? ex.question_vi} kind={EXERCISE_KIND_LABEL.FILL_BLANK} />
      {ex.hint_vi ? (
        <ThemedText variant="caption" color="muted">
          Gợi ý: {ex.hint_vi}
        </ThemedText>
      ) : null}
      <TextInput
        value={answer?.text ?? ''}
        onChangeText={onText}
        editable={!submitted}
        placeholder="Nhập đáp án…"
        placeholderTextColor={c.textFaint}
        autoCapitalize="none"
        accessibilityLabel={`Đáp án câu ${index}`}
        style={{
          backgroundColor: c.surface,
          borderRadius: radius.sm,
          borderWidth: 1.5,
          borderColor: submitted ? (ok ? c.success : c.danger) : c.borderStrong,
          paddingHorizontal: space[4],
          minHeight: 52,
          color: c.textPrimary,
          fontFamily: fonts.bodyRegular,
          fontSize: 15,
        }}
      />
      {submitted && !ok ? (
        <ThemedText variant="caption">
          <ThemedText variant="caption" color="muted">
            Đáp án:{' '}
          </ThemedText>
          <ThemedText variant="caption" style={{ color: c.success }}>
            {ex.answer}
          </ThemedText>
        </ThemedText>
      ) : null}
    </Card>
  )
}

// Free-text / reorder items aren't auto-scored — shown as a self-check with reveal.
function RevealCard({ index, prompt, answer, kind }: { index: number; prompt?: string; answer: string; kind: string }) {
  const c = useTheme().colors
  const [shown, setShown] = useState(false)
  return (
    <Card style={{ gap: space[3], borderRadius: radius.lg }}>
      <Prompt index={index} text={prompt} kind={kind} />
      {shown ? (
        <RuledNote>
          <ThemedText variant="bodyLg" style={{ color: c.success }} accessibilityLanguage="de-DE">
            {answer}
          </ThemedText>
        </RuledNote>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xem đáp án"
          hitSlop={{ top: 4, bottom: 4 }}
          onPress={() => setShown(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            alignSelf: 'flex-start',
            height: 36,
            paddingHorizontal: 14,
            borderRadius: radius.full,
            backgroundColor: c.surfaceSunken,
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          <Icon icon={Eye} size={14} color="secondary" />
          <ThemedText variant="label" color="secondary">
            Xem đáp án
          </ThemedText>
        </Pressable>
      )}
    </Card>
  )
}
