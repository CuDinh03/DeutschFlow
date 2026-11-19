import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  createAudioPlayer,
  type AudioPlayer,
} from 'expo-audio'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams, type Href } from 'expo-router'
import * as Haptics from 'expo-haptics'
import * as FileSystem from 'expo-file-system/legacy'
import { Check, X, Volume2, Square, Play } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { ensureAiConsent } from '@/lib/aiConsent'
import { trackFeatureAction } from '@/lib/analytics'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import {
  Screen,
  Card,
  ThemedText,
  Icon,
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  SelectableRow,
  GaGlyph,
} from '@/components/ui'
import { Chip, Eyebrow, GlyphTile, Rail, RuledNote, TopBar } from '@/components/learn/HocOnParts'
import { skillAnswered } from '@/lib/hocOnUi'
import { skillTreeApi, type SkillExerciseItem } from '@/lib/skillTreeApi'
import {
  activeSkills,
  itemsOf,
  passageOf,
  buildSkillAnswers,
  localIsCorrect,
  answerKey,
  isChoiceType,
  isTrueFalse,
  isReorder,
  isSpeaking,
  hiddenPromptOf,
  SKILL_LABEL,
  SKILL_GLYPH,
  type SkillKey,
  type SkillAnswer,
} from '@/lib/skillExercises'
import { speakGerman, stopGermanSpeech, setGermanRecordingActive } from '@/lib/germanTts'
import { useBlurGuard } from '@/hooks/useBlurGuard'
import { findNextNode } from '@/lib/nextNode'
import { completionCaption, completionTitle } from '@/lib/nodeActions'
import { LessonCompleteNav } from '@/components/LessonCompleteNav'
import { useBackTo } from '@/hooks/useBackTo'
import { PARENT_OF } from '@/lib/screenParents'

type Result = { scorePercent: number; completed: boolean; xp: number; alreadyCompleted: boolean } | null
// Cap how long we hold the loading state waiting for the fresh tree before revealing the
// result: happy-path refetch lands well under this; a slow refetch reveals anyway and the
// derived nextNode self-heals when the observer catches up (the lesson is already graded).
const REVEAL_TREE_CAP_MS = 3000

// Giao diện v3.4 (Đợt 6A, mẫu `skills4`): đầu màn "Luyện 4 kỹ năng", hàng chip tiến độ từng kỹ năng
// (chạm để cuộn tới phần đó), mỗi câu là một thẻ lớn có nhãn "kỹ năng · câu n / N", câu Nói có nút
// micro tròn. Vẫn làm hết rồi nộp một lần — logic chấm/nộp và ghi âm không đổi.
export default function SkillPracticeScreen() {
  // Remount the runner when nodeId changes so stale submitted/result/answers and per-skill
  // child state (reorder order, recording) never leak from the previous lesson via "Bài tiếp theo".
  const { nodeId } = useLocalSearchParams<{ nodeId: string }>()
  return <SkillPracticeRunner key={nodeId ?? 'none'} />
}

function SkillPracticeRunner() {
  // Back tường minh về màn cha — Tabs firstRoute sẽ về Heute (xem lib/screenParents).
  const goBack = useBackTo(PARENT_OF['skill-practice'])
  const c = useTheme().colors
  const qc = useQueryClient()
  const params = useLocalSearchParams<{ nodeId: string; title?: string }>()
  const nodeId = Number(params.nodeId)

  const [answers, setAnswers] = useState<Record<string, SkillAnswer>>({})
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result>(null)

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

  const se = data?.content?.skill_exercises
  const skills = useMemo(() => activeSkills(se), [se])
  // Chip kỹ năng → cuộn tới phần đó (chỉ trình bày; vị trí đo bằng onLayout).
  const scrollRef = useRef<ScrollView | null>(null)
  const sectionY = useRef<Partial<Record<SkillKey, number>>>({})
  const nextNode = result?.completed ? findNextNode(tree, nodeId) : undefined

  function setAnswer(key: string, value: SkillAnswer) {
    if (submitted) return
    setAnswers((p) => ({ ...p, [key]: value }))
  }

  async function submit() {
    if (busy) return
    setBusy(true)
    try {
      const payload = buildSkillAnswers(se, answers)
      const res = await skillTreeApi.submitSkillExercises(nodeId, payload)
      const completed = res.completed ?? (res.scorePercent ?? 0) >= 70
      trackFeatureAction('lesson', 'completed', { node_id: nodeId, completed, percent: res.scorePercent ?? 0 })
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
        scorePercent: res.scorePercent ?? 0,
        completed,
        xp: res.xpEarned ?? 0,
        alreadyCompleted: res.alreadyCompleted === true,
      })
      await Haptics.notificationAsync(
        completed ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
      )
    } catch (e) {
      Alert.alert('Lỗi', apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  function retry() {
    setSubmitted(false)
    setResult(null)
    setAnswers({})
  }

  return (
    <Screen edges={['top']}>
      <TopBar
        onBack={goBack}
        title="Luyện 4 kỹ năng"
        subtitle={params.title ?? data?.titleVi ?? 'Nghe · Nói · Đọc · Viết'}
      />

      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <Skeleton height={110} radius="md" />
          <Skeleton height={110} radius="md" />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : skills.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState glyph="thithu" title="Chưa có bài tập" message="Bài học này chưa có bài luyện 4 kỹ năng." />
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1, backgroundColor: c.bg }}
            contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[3], paddingTop: space[3] }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Rail>
              {skills.map((skill) => {
                const total = itemsOf(se, skill).length
                const doneCount = skillAnswered(skill, total, answers)
                return (
                  <Chip
                    key={skill}
                    label={`${SKILL_LABEL[skill]} · ${doneCount}/${total}`}
                    on={doneCount === total}
                    accessibilityLabel={`${SKILL_LABEL[skill]}: đã làm ${doneCount} trên ${total} câu. Chạm để cuộn tới`}
                    onPress={() => scrollRef.current?.scrollTo({ y: Math.max(0, (sectionY.current[skill] ?? 0) - space[2]), animated: true })}
                  />
                )
              })}
            </Rail>

            {result ? <ResultHero result={result} hasNext={!!nextNode} /> : null}

            {skills.map((skill) => (
              <SkillSection
                key={skill}
                onLayoutY={(y) => {
                  sectionY.current[skill] = y
                }}
                skill={skill}
                items={itemsOf(se, skill)}
                passage={skill === 'LESEN' ? passageOf(se) : undefined}
                answers={answers}
                submitted={submitted}
                onAnswer={setAnswer}
              />
            ))}

            {!submitted ? (
              <Button label={busy ? 'Đang chấm…' : 'Nộp bài'} onPress={submit} loading={busy} />
            ) : result && !result.completed ? (
              <Button label="Làm lại" variant="secondary" onPress={retry} />
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
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  )
}

function ResultHero({ result, hasNext }: { result: NonNullable<Result>; hasNext: boolean }) {
  const c = useTheme().colors
  if (result.completed) {
    return (
      <Card style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface, borderRadius: radius.lg, gap: space[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <ThemedText variant="label" style={{ color: c.accent, letterSpacing: 1, textTransform: 'uppercase' }}>
            Hoàn thành chặng
          </ThemedText>
          <ThemedText variant="monoLg" style={{ color: c.onInk }}>
            {result.scorePercent}%
          </ThemedText>
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
          {completionCaption(hasNext, result.alreadyCompleted)}
        </ThemedText>
      </Card>
    )
  }
  return (
    <Card style={{ gap: space[2], borderColor: c.borderStrong, borderRadius: radius.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Eyebrow>Kết quả</Eyebrow>
        <ThemedText variant="monoLg">
          {result.scorePercent}%
        </ThemedText>
      </View>
      <ThemedText variant="caption" color="muted">
        Chưa đạt yêu cầu để hoàn thành. Xem đáp án bên dưới rồi thử lại.
      </ThemedText>
    </Card>
  )
}

function SkillSection({
  skill,
  items,
  passage,
  answers,
  submitted,
  onAnswer,
  onLayoutY,
}: {
  onLayoutY: (y: number) => void
  skill: SkillKey
  items: SkillExerciseItem[]
  passage?: { text_de?: string; text_type?: string; text_vi_hint?: string }
  answers: Record<string, SkillAnswer>
  submitted: boolean
  onAnswer: (key: string, v: SkillAnswer) => void
}) {
  return (
    <View style={{ gap: space[3], marginTop: space[3] }} onLayout={(e) => onLayoutY(e.nativeEvent.layout.y)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <GlyphTile name={SKILL_GLYPH[skill]} />
        <ThemedText variant="titleLg" accessibilityRole="header" style={{ flex: 1 }}>
          {SKILL_LABEL[skill]}
        </ThemedText>
        <ThemedText variant="caption" color="muted">
          {`${items.length} câu`}
        </ThemedText>
      </View>

      {passage?.text_de ? (
        <RuledNote style={{ gap: space[2] }}>
          {passage.text_type ? <Eyebrow>{passage.text_type}</Eyebrow> : null}
          <ThemedText variant="bodyLg" accessibilityLanguage="de-DE">{passage.text_de}</ThemedText>
          {submitted && passage.text_vi_hint ? (
            <ThemedText variant="caption" color="muted">
              {passage.text_vi_hint}
            </ThemedText>
          ) : null}
        </RuledNote>
      ) : null}

      {items.map((item, i) => (
        <SkillItemCard
          key={`${skill}:${i}`}
          eyebrow={`${SKILL_LABEL[skill]} · câu ${i + 1} / ${items.length}`}
          index={i + 1}
          item={item}
          value={answers[answerKey(skill, i)]}
          submitted={submitted}
          onAnswer={(v) => onAnswer(answerKey(skill, i), v)}
        />
      ))}
    </View>
  )
}

function SkillItemCard({
  eyebrow,
  item,
  value,
  submitted,
  onAnswer,
}: {
  eyebrow: string
  index: number
  item: SkillExerciseItem
  value: SkillAnswer
  submitted: boolean
  onAnswer: (v: SkillAnswer) => void
}) {
  const ok = submitted && localIsCorrect(item, value)
  const speaking = isSpeaking(item.type)
  const hiddenPrompt = hiddenPromptOf(item)

  return (
    <Card style={{ gap: space[3], borderRadius: radius.lg, padding: space[5] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Eyebrow style={{ flex: 1 }}>{eyebrow}</Eyebrow>
        {submitted && !speaking ? (
          <Icon icon={ok ? Check : X} size={18} color={ok ? 'success' : 'danger'} />
        ) : null}
      </View>
      <ThemedText variant="bodyStrong">
        {item.instruction_vi ?? item.question_vi ?? item.statement_de ?? ''}
      </ThemedText>
      {item.audio_transcript ? (
        <View style={{ flexDirection: 'row' }}>
          <PlayButton text={item.audio_transcript} label="Nghe" />
        </View>
      ) : null}

      {/* The header renders instruction_vi, which HIDES the real question/statement for
          choice + true-false items (see hiddenPromptOf). Surface it so the card isn't
          "only answers". */}
      {hiddenPrompt ? <ThemedText variant="body">{hiddenPrompt}</ThemedText> : null}

      {isChoiceType(item.type) ? (
        <ChoiceInput item={item} value={value} submitted={submitted} onAnswer={onAnswer} />
      ) : isTrueFalse(item.type) ? (
        <TrueFalseInput value={value} submitted={submitted} onAnswer={onAnswer} />
      ) : isReorder(item.type) ? (
        <ReorderInput item={item} submitted={submitted} onAnswer={onAnswer} />
      ) : speaking ? (
        <SpeakingInput item={item} value={value} submitted={submitted} onAnswer={onAnswer} />
      ) : (
        <TextAnswerInput item={item} value={value} submitted={submitted} onAnswer={onAnswer} />
      )}

      {submitted && item.explanation_vi ? (
        <ThemedText variant="caption" color="muted">
          Giải thích: {item.explanation_vi}
        </ThemedText>
      ) : null}
    </Card>
  )
}

function PlayButton({ text, label, disabled }: { text: string; label: string; disabled?: boolean }) {
  const c = useTheme().colors
  const [loading, setLoading] = useState(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  async function play() {
    if (loading) return
    setLoading(true)
    try {
      await speakGerman(text)
    } finally {
      if (alive.current) setLoading(false)
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Phát âm thanh: ${label}`}
      accessibilityState={{ busy: loading, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => void play()}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 36,
        paddingHorizontal: 14,
        borderRadius: radius.full,
        backgroundColor: c.surfaceSunken,
        borderWidth: 1,
        borderColor: c.border,
        opacity: disabled ? 0.4 : 1,
      }}
      hitSlop={{ top: 4, bottom: 4 }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={c.textPrimary} />
      ) : (
        <Icon icon={Volume2} size={16} color="secondary" />
      )}
      <ThemedText variant="label" color="secondary">
        {label}
      </ThemedText>
    </Pressable>
  )
}

function ChoiceInput({
  item,
  value,
  submitted,
  onAnswer,
}: {
  item: SkillExerciseItem
  value: SkillAnswer
  submitted: boolean
  onAnswer: (v: SkillAnswer) => void
}) {
  const c = useTheme().colors
  return (
    <View style={{ gap: space[2] }}>
      {(item.options ?? []).map((opt, i) => {
        const selected = value === i
        const isAnswer = i === item.correct_index
        const border = submitted ? (isAnswer ? c.success : selected ? c.danger : c.border) : selected ? c.textPrimary : c.borderStrong
        const bg = submitted ? (isAnswer ? c.successSoft : selected ? c.dangerSoft : c.surface) : selected ? c.accentSoft : c.surface
        return (
          <SelectableRow
            key={i}
            label={opt}
            selected={selected}
            disabled={submitted}
            onPress={() => onAnswer(i)}
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
            {!submitted && selected ? <Icon icon={Check} size={16} color="primary" /> : null}
            {submitted && isAnswer ? <Icon icon={Check} size={16} color="success" /> : null}
            {submitted && selected && !isAnswer ? <Icon icon={X} size={16} color="danger" /> : null}
          </SelectableRow>
        )
      })}
    </View>
  )
}

function TrueFalseInput({
  value,
  submitted,
  onAnswer,
}: {
  value: SkillAnswer
  submitted: boolean
  onAnswer: (v: SkillAnswer) => void
}) {
  const c = useTheme().colors
  const opts: [string, string][] = [
    ['richtig', 'Richtig (Đúng)'],
    ['falsch', 'Falsch (Sai)'],
  ]
  return (
    <View style={{ flexDirection: 'row', gap: space[2] }}>
      {opts.map(([val, label]) => {
        const selected = value === val
        return (
          <Pressable
            key={val}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected, disabled: submitted }}
            disabled={submitted}
            onPress={() => onAnswer(val)}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 52,
              borderRadius: radius.md,
              borderWidth: 1.5,
              borderColor: selected ? c.textPrimary : c.borderStrong,
              backgroundColor: selected ? c.accentSoft : c.surface,
            }}
          >
            <ThemedText variant="body">{label}</ThemedText>
          </Pressable>
        )
      })}
    </View>
  )
}

function TextAnswerInput({
  item,
  value,
  submitted,
  onAnswer,
}: {
  item: SkillExerciseItem
  value: SkillAnswer
  submitted: boolean
  onAnswer: (v: SkillAnswer) => void
}) {
  const c = useTheme().colors
  const ok = submitted && localIsCorrect(item, value)
  return (
    <View style={{ gap: space[2] }}>
      {/* Translate items (TRANSLATE_VI_DE) carry the source sentence in sentence_vi — the actual
          prompt the learner must translate. Without this it renders blank (only the instruction shows). */}
      {item.sentence_vi ? <ThemedText variant="bodyStrong">{item.sentence_vi}</ThemedText> : null}
      {item.sentence_with_blank ? <ThemedText variant="body">{item.sentence_with_blank}</ThemedText> : null}
      {item.hint_vi ? (
        <ThemedText variant="caption" color="faint">
          Gợi ý: {item.hint_vi}
        </ThemedText>
      ) : null}
      <TextInput
        value={typeof value === 'string' ? value : ''}
        onChangeText={(t) => onAnswer(t)}
        editable={!submitted}
        placeholder="Nhập đáp án…"
        placeholderTextColor={c.textFaint}
        autoCapitalize="none"
        accessibilityLabel="Đáp án"
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
      {submitted && !ok && item.correct_answer != null ? (
        <ThemedText variant="caption">
          <ThemedText variant="caption" color="muted">
            Đáp án:{' '}
          </ThemedText>
          <ThemedText variant="caption" style={{ color: c.success }}>
            {String(item.correct_answer)}
          </ThemedText>
        </ThemedText>
      ) : null}
      {item.grammar_rule_vi && submitted ? (
        <ThemedText variant="caption" color="muted">
          {item.grammar_rule_vi}
        </ThemedText>
      ) : null}
    </View>
  )
}

// Tap words in order to build the sentence; the joined string is the graded answer.
function ReorderInput({
  item,
  submitted,
  onAnswer,
}: {
  item: SkillExerciseItem
  submitted: boolean
  onAnswer: (v: SkillAnswer) => void
}) {
  const c = useTheme().colors
  const words = item.words ?? []
  const [order, setOrder] = useState<number[]>([])
  const used = new Set(order)

  function tap(i: number) {
    if (submitted) return
    const next = used.has(i) ? order.filter((x) => x !== i) : [...order, i]
    setOrder(next)
    onAnswer(next.map((x) => words[x]).join(' '))
  }

  // Mẫu `.answer-line` + `.ro-bank`: từ đã chọn nằm trong khung nét đứt (chạm để bỏ), từ chưa chọn
  // nằm dưới (chạm để thêm). Cùng một hàm `tap` như trước nên câu ghép gửi đi không đổi.
  const tile = (i: number, inLine: boolean) => (
    <Pressable
      key={`${inLine ? 'l' : 'b'}${i}`}
      accessibilityRole="button"
      accessibilityLabel={inLine ? `Bỏ từ ${words[i]}` : `Thêm từ ${words[i]}`}
      accessibilityState={{ disabled: submitted }}
      accessibilityLanguage="de-DE"
      disabled={submitted}
      onPress={() => tap(i)}
      style={{
        height: 42,
        paddingHorizontal: 14,
        justifyContent: 'center',
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: c.borderStrong,
        backgroundColor: c.surface,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 2 },
        opacity: submitted ? 0.7 : 1,
      }}
    >
      <ThemedText variant="title" style={{ fontWeight: '500' }}>
        {words[i]}
      </ThemedText>
    </Pressable>
  )

  return (
    <View style={{ gap: space[3] }}>
      <View
        style={{
          minHeight: 96,
          padding: 10,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderStyle: order.length > 0 && submitted ? 'solid' : 'dashed',
          borderColor: c.borderStrong,
          backgroundColor: c.surface,
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignContent: 'flex-start',
          gap: space[2],
        }}
      >
        {order.length > 0 ? (
          order.map((x) => tile(x, true))
        ) : (
          <ThemedText variant="body" color="muted" style={{ padding: space[2] }}>
            Chạm từ bên dưới để xếp câu
          </ThemedText>
        )}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {words.map((_, i) => (used.has(i) ? null : tile(i, false)))}
      </View>
      {submitted && item.correct_answer != null ? (
        <ThemedText variant="caption">
          <ThemedText variant="caption" color="muted">
            Đúng:{' '}
          </ThemedText>
          <ThemedText variant="caption" style={{ color: c.success }}>
            {String(item.correct_answer)}
          </ThemedText>
        </ThemedText>
      ) : null}
    </View>
  )
}

// Speaking drill: the learner hears the model (TTS), records themselves saying it, then plays
// their own take back to compare. Recording marks the "spoken" sentinel (counts as attempted —
// pronunciation is AI-graded elsewhere). No PRO gate: this is a free CORE practice aid (record +
// listen back), no server call. Mirrors the recorder/permission flow in app/(student)/speaking.tsx.
function SpeakingInput({
  item,
  value,
  submitted,
  onAnswer,
}: {
  item: SkillExerciseItem
  value: SkillAnswer
  submitted: boolean
  onAnswer: (v: SkillAnswer) => void
}) {
  const c = useTheme().colors
  // Defensive: fall back to `prompt` if the German model sentence is authored under that key
  // (the card header already renders instruction_vi/question_vi, so a broken item is never
  // answer-only). gloss stays the Vietnamese translation of the model line.
  const model = item.sentence_de ?? item.question_de ?? item.prompt ?? ''
  const gloss = item.sentence_vi ?? item.question_vi ?? ''
  const done = value === 'spoken'

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const [recording, setRecording] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [recordedUri, setRecordedUri] = useState<string | null>(null)
  const [playingBack, setPlayingBack] = useState(false)
  const playerRef = useRef<AudioPlayer | null>(null)
  const recordingRef = useRef(false)
  // Gương của recordedUri cho cleanup unmount (closure của effect [] không thấy
  // state mới nhất). Màn này KHÔNG transcribe nên file không được dọn ở
  // speakingApi.transcribe như 4 màn kia — tự dọn khi ghi đè / rời màn (F-17).
  const recordedUriRef = useRef<string | null>(null)
  recordedUriRef.current = recordedUri

  function stopPlayback() {
    const p = playerRef.current
    if (p) {
      playerRef.current = null
      try {
        p.remove()
      } catch {
        // already released
      }
    }
    setPlayingBack(false)
  }

  // Clean up any live player / recording when the card unmounts.
  useEffect(
    () => () => {
      const p = playerRef.current
      if (p) {
        try {
          p.remove()
        } catch {
          // already released
        }
      }
      if (recordingRef.current) {
        setGermanRecordingActive(false)
        void recorder
          .stop()
          .catch(() => undefined)
          .finally(() => {
            // Audio mode là cấu hình toàn app — không thoát record mode ở đây thì
            // TTS/phát lại sau đó ra loa trong rất nhỏ (F-11 soát 02/09).
            void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {})
          })
      }
      // Bản ghi phát-lại chỉ có nghĩa khi còn ở màn này — rời màn là dọn file (F-17).
      if (recordedUriRef.current) {
        void FileSystem.deleteAsync(recordedUriRef.current, { idempotent: true }).catch(() => {})
      }
    },
    [recorder],
  )

  // Cleanup unmount ở trên chỉ chạy khi ĐỔI card/bài — chuyển tab thì card còn
  // nguyên (Tabs không unmount) nên TTS mẫu, bản phát lại và cả mic cứ chạy
  // tiếp. Blur = tắt hết; bản ghi dở bị bỏ (không chấm), người dùng đã rời màn.
  useBlurGuard(() => {
    void stopGermanSpeech()
    stopPlayback()
    if (recordingRef.current) {
      recordingRef.current = false
      setRecording(false)
      setPreparing(false)
      setGermanRecordingActive(false)
      void recorder
        .stop()
        .catch(() => undefined)
        .finally(() => {
          void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {})
        })
    }
  })

  async function playRecording(uri: string) {
    stopPlayback()
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true })
      const player = createAudioPlayer({ uri })
      playerRef.current = player
      setPlayingBack(true)
      player.addListener('playbackStatusUpdate', (st) => {
        if (st.didJustFinish) stopPlayback()
      })
      player.play()
    } catch {
      setPlayingBack(false)
    }
  }

  async function startRecording() {
    if (submitted || recording || preparing) return
    // 5.1.1(i): the recording is transcribed by a third-party AI — disclose & get consent first.
    if (!(await ensureAiConsent())) return
    try {
      const { status, canAskAgain } = await AudioModule.requestRecordingPermissionsAsync()
      if (status !== 'granted') {
        if (!canAskAgain) {
          Alert.alert('Cần quyền microphone', 'Hãy bật microphone trong Cài đặt để luyện nói.', [
            { text: 'Để sau', style: 'cancel' },
            { text: 'Mở Cài đặt', onPress: () => void Linking.openSettings() },
          ])
        } else {
          Alert.alert('Không có quyền microphone', 'Bạn cần cấp quyền để ghi âm.')
        }
        return
      }
      await stopGermanSpeech() // don't record over the model TTS
      stopPlayback()
      // Ghi lượt mới = bản cũ hết việc: dọn file kẻo mỗi lần thử lại rơi rớt
      // thêm một .m4a trong cache (F-17).
      if (recordedUri) {
        void FileSystem.deleteAsync(recordedUri, { idempotent: true }).catch(() => {})
        setRecordedUri(null)
      }
      setPreparing(true)
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()
      recorder.record()
      recordingRef.current = true
      setGermanRecordingActive(true) // block model TTS from stealing the audio session mid-record
      setRecording(true)
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    } catch {
      Alert.alert('Lỗi', 'Không thể khởi động microphone. Vui lòng kiểm tra quyền truy cập.')
    } finally {
      setPreparing(false)
    }
  }

  async function stopRecording() {
    if (!recording) return
    setRecording(false)
    recordingRef.current = false
    setGermanRecordingActive(false)
    try {
      await recorder.stop()
      // Leave record mode so playback routes to the loud speaker, not the earpiece.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true })
      const uri = recorder.uri
      if (uri) {
        setRecordedUri(uri)
        onAnswer('spoken')
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        void playRecording(uri) // let them hear themselves right away
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu bản ghi. Bạn thử lại nhé.')
    }
  }

  return (
    <View style={{ gap: space[2] }}>
      {model ? (
        <ThemedText variant="titleLg" style={{ fontWeight: '400' }} accessibilityLanguage="de-DE">
          {model}
        </ThemedText>
      ) : null}
      {gloss ? (
        <ThemedText variant="caption" color="muted">
          {gloss}
        </ThemedText>
      ) : null}
      {submitted && item.expected_answer ? (
        <ThemedText variant="caption" color="muted">
          Gợi ý: {item.expected_answer}
        </ThemedText>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[1] }}>
        {model ? <PlayButton text={model} label="Nghe mẫu" disabled={recording || preparing} /> : null}
        {recordedUri && !recording ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Nghe lại bản ghi của bạn"
            onPress={() => void playRecording(recordedUri)}
            hitSlop={{ top: 4, bottom: 4 }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              height: 36,
              paddingHorizontal: 14,
              borderRadius: radius.full,
              backgroundColor: c.surfaceSunken,
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            {playingBack ? (
              <ActivityIndicator size="small" color={c.textPrimary} />
            ) : (
              <Icon icon={Play} size={14} color="secondary" />
            )}
            <ThemedText variant="label" color="secondary">
              Nghe lại bản ghi
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      {/* Mẫu `.micbtn`: nút micro tròn 84pt, đỏ khi đang ghi. */}
      <View style={{ alignItems: 'center', gap: space[2], marginTop: space[4] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={recording ? 'Dừng ghi âm' : done ? 'Ghi âm lại' : 'Ghi âm và nói theo'}
          accessibilityState={{ selected: done, busy: preparing, disabled: submitted }}
          disabled={submitted || preparing}
          onPress={() => (recording ? void stopRecording() : void startRecording())}
          style={({ pressed }) => ({
            width: 84,
            height: 84,
            borderRadius: radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: recording ? c.danger : preparing ? c.borderStrong : c.inkSurface,
            borderWidth: 3,
            borderColor: recording ? c.dangerSoft : done ? c.success : c.accent,
            opacity: submitted ? 0.6 : 1,
            transform: [{ scale: pressed ? 0.94 : 1 }],
          })}
        >
          {preparing ? (
            <ActivityIndicator size="small" color={c.onInk} />
          ) : recording ? (
            <Icon icon={Square} size={26} color="onInk" />
          ) : (
            <GaGlyph name="noi" size={30} ink="onInk" />
          )}
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {done && !recording ? <Icon icon={Check} size={14} color="success" /> : null}
          <ThemedText variant="label" color={recording ? 'danger' : done ? 'success' : 'primary'}>
            {recording ? 'Đang ghi… Chạm để dừng' : done ? 'Đã ghi âm — chạm để ghi lại' : 'Nhấn để nói theo'}
          </ThemedText>
        </View>
      </View>
    </View>
  )
}
