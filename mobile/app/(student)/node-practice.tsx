import { useMemo, useState, useEffect, useRef } from 'react'
import { View, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Check, X, Eye, Trophy } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { trackFeatureAction } from '@/lib/analytics'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, Pill, Button, AppHeader, EmptyState, ErrorState, Skeleton, Caption } from '@/components/ui'
import {
  skillTreeApi,
  isFillCorrect,
  type Exercise,
  type ExerciseMultipleChoice,
  type ExerciseFillBlank,
  type ExerciseTranslate,
  type ExerciseReorder,
} from '@/lib/skillTreeApi'

type Answer = { choice?: number; text?: string }
const SCORED = new Set(['MULTIPLE_CHOICE', 'FILL_BLANK'])

export default function NodePracticeScreen() {
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
  const [result, setResult] = useState<{ correct: number; total: number; completed: boolean; xp: number } | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['node-session', nodeId],
    queryFn: () => skillTreeApi.getNodeSession(nodeId),
    enabled: Number.isFinite(nodeId),
  })

  const exercises = useMemo<Exercise[]>(() => {
    const ex = data?.content?.exercises
    return [...(ex?.theory_gate ?? []), ...(ex?.practice ?? [])].filter((e) => e && e.id && e.type)
  }, [data?.content?.exercises])

  const scoredCount = exercises.filter((e) => SCORED.has(e.type)).length

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
      setSubmitted(true)
      setResult({ correct, total: scoredCount, completed, xp: res.xpEarned ?? 0 })
      trackFeatureAction('lesson', 'completed', { node_id: nodeId, completed, percent })
      qc.invalidateQueries({ queryKey: ['skill-tree'] })
      qc.invalidateQueries({ queryKey: ['node-session', nodeId] })
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
      <AppHeader title={params.title ?? data?.titleVi ?? 'Luyện tập'} onBack={() => router.back()} />

      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <Skeleton height={110} radius="md" />
          <Skeleton height={110} radius="md" />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : exercises.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState icon={Trophy} title="Chưa có bài tập" message="Bài học này chưa có bài tập trên app." />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[3], paddingTop: space[2] }}>
          {result ? (
            result.completed ? (
              // Completion = the climactic moment: editorial ink hero (mirrors Home).
              <Card style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface, gap: space[3] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Caption color={c.accent}>Hoàn thành chặng</Caption>
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
                      backgroundColor: c.accentSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon icon={Trophy} size={18} color="accent" fill />
                  </View>
                  <ThemedText variant="title" style={{ flex: 1, color: c.onInk }}>
                    {`Tuyệt vời! +${result.xp} XP`}
                  </ThemedText>
                </View>
                <ThemedText variant="caption" style={{ color: c.onInkMuted }}>
                  Bài học đã mở khoá bài tiếp theo trên lộ trình.
                </ThemedText>
              </Card>
            ) : (
              <Card style={{ gap: space[2], borderColor: c.borderStrong }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Caption>Kết quả</Caption>
                  {scoredCount > 0 ? (
                    <ThemedText variant="monoLg" color="accent">
                      {result.correct}/{result.total}
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText variant="caption" color="muted">
                  Cần đúng tất cả câu trắc nghiệm để hoàn thành. Xem đáp án bên dưới rồi thử lại.
                </ThemedText>
              </Card>
            )
          ) : null}

          {!result ? (
            <Caption style={{ paddingHorizontal: space[1], paddingTop: space[1] }}>
              {scoredCount > 0 ? `${exercises.length} bài tập` : 'Tự luyện'}
            </Caption>
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
            <Button label={busy ? 'Đang chấm…' : 'Nộp bài'} onPress={submit} loading={busy} />
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
            <Button label="Xong" variant="secondary" onPress={() => router.back()} />
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
      return <RevealCard index={index} prompt={(exercise as ExerciseTranslate).sentence} answer={(exercise as ExerciseTranslate).answer} kind="Dịch" />
    case 'REORDER':
      return (
        <RevealCard
          index={index}
          prompt={(exercise as ExerciseReorder).translation ?? (exercise as ExerciseReorder).words.join(' / ')}
          answer={(exercise as ExerciseReorder).correct_order.join(' ')}
          kind="Sắp xếp"
        />
      )
    default:
      return null
  }
}

function Prompt({ index, text, badge }: { index: number; text?: string; badge?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
      <ThemedText variant="label" color="faint">
        {index}.
      </ThemedText>
      <ThemedText variant="bodyStrong" style={{ flex: 1 }}>
        {text}
      </ThemedText>
      {badge ? <Pill label={badge} tone="neutral" /> : null}
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
    <Card style={{ gap: space[3] }}>
      <Prompt index={index} text={ex.question_vi ?? ex.question} />
      <View style={{ gap: space[2] }}>
        {ex.options.map((opt, i) => {
          const selected = answer?.choice === i
          const isAnswer = i === ex.correct
          const border = submitted ? (isAnswer ? c.success : selected ? c.danger : c.border) : selected ? c.accent : c.border
          const bg = submitted ? (isAnswer ? c.successSoft : selected ? c.dangerSoft : c.surface) : selected ? c.accentSoft : c.surface
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={opt}
              accessibilityState={{ selected, disabled: submitted }}
              onPress={() => onChoice(i)}
              disabled={submitted}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[2],
                borderWidth: 1,
                borderColor: border,
                backgroundColor: bg,
                borderRadius: radius.md,
                paddingHorizontal: space[3],
                paddingVertical: space[3],
              }}
            >
              <ThemedText variant="body" style={{ flex: 1 }}>
                {opt}
              </ThemedText>
              {/* Non-colour cue so the chosen option isn't conveyed by accent fill alone (color-blind). */}
              {!submitted && selected ? <Icon icon={Check} size={16} color="accent" /> : null}
              {submitted && isAnswer ? <Icon icon={Check} size={16} color="success" /> : null}
              {submitted && selected && !isAnswer ? <Icon icon={X} size={16} color="danger" /> : null}
            </Pressable>
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
    <Card style={{ gap: space[2] }}>
      <Prompt index={index} text={ex.sentence_de ?? ex.question_vi} />
      {ex.hint_vi ? (
        <ThemedText variant="caption" color="faint">
          💡 {ex.hint_vi}
        </ThemedText>
      ) : null}
      <TextInput
        value={answer?.text ?? ''}
        onChangeText={onText}
        editable={!submitted}
        placeholder="Nhập đáp án…"
        placeholderTextColor={c.textFaint}
        autoCapitalize="none"
        style={{
          backgroundColor: c.surfaceSunken,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: submitted ? (ok ? c.success : c.danger) : c.border,
          paddingHorizontal: space[3],
          paddingVertical: space[3],
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
    <Card style={{ gap: space[2] }}>
      <Prompt index={index} text={prompt} badge={kind} />
      {shown ? (
        <ThemedText variant="body" style={{ color: c.success }}>
          {answer}
        </ThemedText>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xem đáp án"
          onPress={() => setShown(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
        >
          <Icon icon={Eye} size={14} color="accent" />
          <ThemedText variant="label" color="accent">
            Xem đáp án
          </ThemedText>
        </Pressable>
      )}
    </Card>
  )
}
