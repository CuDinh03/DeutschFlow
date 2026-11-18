// Luyện một Teil telc (giao diện v3.4, Đợt 4, 19/11/2026) — bản app của
// /v2/student/mock-exam/practice/teil: không ép giờ (đồng hồ chỉ đếm lên), tự lưu nháp, kiểm tra xong
// có phân tích từng câu; bài Viết gửi AI chấm theo phiếu telc. Dựng câu hỏi bằng đúng linh kiện của
// màn thi thử (`ExamTeilBody`). `mode=diag`: một phần của bài chẩn đoán — không làm lại, không thẻ
// chiến thuật, kiểm tra xong về màn bài chẩn đoán.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, AppState, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { apiMessage } from '@/lib/api'
import { space, useTheme } from '@/lib/theme'
import { AppHeader, Button, Card, EmptyState, ErrorState, Screen, Skeleton, ThemedText } from '@/components/ui'
import { ObjGroupView, WritingTaskView } from '@/components/exam/ExamTeilBody'
import { WritingResultCard } from '@/components/exam/WritingResultCard'
import type { HoerenGatePhase } from '@/components/exam/HoerenGate'
import { parseExamSections } from '@/lib/examApi'
import { checkPracticeTeil, getPracticeOverview, gradePracticeWriting, resetPracticeTeil, type PracticeTeilResult, type WritingEvaluation } from '@/lib/telcPracticeApi'
import { answeredCount, formatClock, locateTeil, nextTeilKey, objectiveResult, practiceOverviewKey, scoreSummary, teilTitle, WRITING_TEXT_KEY, writingResult } from '@/lib/practiceTeil'
import { asHref, diagnosticRoute, examSetRoute, teilRoute } from '@/lib/examRoutes'
import { EXAM_HUB_QUERY_KEY } from '@/hooks/useExamHub'
import { usePracticeDraft } from '@/hooks/usePracticeDraft'
import { useBackTo } from '@/hooks/useBackTo'
import { captureEvent } from '@/lib/analytics'

export default function ExamTeilScreen() {
  // Màn ẩn trong Tabs không unmount khi đổi tham số: remount theo đề + Teil để không mang state cũ.
  const { examId, teil, mode } = useLocalSearchParams<{ examId: string; teil: string; mode?: string }>()
  return <TeilRunner key={`${examId}-${teil}-${mode ?? ''}`} examId={Number(examId)} teilKey={String(teil ?? '')} diag={mode === 'diag'} />
}

function TeilRunner({ examId, teilKey, diag }: { examId: number; teilKey: string; diag: boolean }) {
  const c = useTheme().colors
  const queryClient = useQueryClient()
  const goBack = useBackTo(() => asHref(diag ? diagnosticRoute : examSetRoute(examId)))

  const { data: overview, isLoading, isError, refetch } = useQuery({
    queryKey: practiceOverviewKey(examId),
    queryFn: () => getPracticeOverview(examId),
    enabled: Number.isFinite(examId),
  })
  const parsed = useMemo(() => (overview?.sectionsJson ? parseExamSections(overview.sectionsJson) : null), [overview?.sectionsJson])
  const located = useMemo(() => locateTeil(parsed, teilKey), [parsed, teilKey])
  const meta = overview?.teile.find((t) => t.key === teilKey)

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [seconds, setSeconds] = useState(0)
  const [result, setResult] = useState<PracticeTeilResult | null>(null)
  const [evaluation, setEvaluation] = useState<WritingEvaluation | null>(null)
  const [phase, setPhase] = useState<HoerenGatePhase>('idle')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const checked = !!result || !!evaluation
  const draft = usePracticeDraft(examId, teilKey, !checked)

  // Nạp tiến độ đã lưu một lần (nháp, đồng hồ, kết quả đã kiểm tra).
  useEffect(() => {
    if (!meta || loaded) return
    const p = meta.progress
    setAnswers(p?.answers ?? {})
    setSeconds(p?.elapsedSeconds ?? 0)
    if (p?.checked) {
      setResult(objectiveResult(p.result))
      setEvaluation(writingResult(p.result))
    }
    setLoaded(true)
  }, [meta, loaded])

  // Đồng hồ đếm lên mỗi giây khi màn đang mở, app đang dùng và chưa kiểm tra. Không bao giờ tự nộp.
  const [focused, setFocused] = useState(true)
  useFocusEffect(
    useCallback(() => {
      setFocused(true)
      return () => setFocused(false)
    }, []),
  )
  const [active, setActive] = useState(AppState.currentState === 'active')
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'))
    return () => sub.remove()
  }, [])
  useEffect(() => {
    if (!loaded || checked || !focused || !active) return
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [loaded, checked, focused, active])

  const setAnswer = (id: string, value: string) => {
    if (checked) return
    const next = { ...answers, [id]: value }
    setAnswers(next)
    draft.schedule(next, seconds)
  }

  const refreshAfterCheck = () => {
    void queryClient.invalidateQueries({ queryKey: practiceOverviewKey(examId) })
    void queryClient.invalidateQueries({ queryKey: EXAM_HUB_QUERY_KEY })
  }

  async function doCheck() {
    if (located?.kind !== 'objective') return
    setBusy(true)
    try {
      draft.reset()
      const p = await checkPracticeTeil(examId, teilKey, answers, seconds)
      setResult(objectiveResult(p.result))
      captureEvent('practice_teil_checked', { teil: teilKey, score: p.score ?? null, max: p.max ?? null, diag })
      refreshAfterCheck()
      if (diag) router.replace(asHref(diagnosticRoute))
    } catch (e) {
      Alert.alert('Chưa kiểm tra được', apiMessage(e) || 'Thử lại sau ít phút.')
    } finally {
      setBusy(false)
    }
  }

  function onCheck() {
    if (located?.kind !== 'objective') return
    const missing = located.group.items.length - answeredCount(located.group, answers)
    if (missing > 0) {
      Alert.alert('Còn câu chưa trả lời', `Bạn còn ${missing} câu bỏ trống. Câu trống tính sai.`, [
        { text: 'Làm tiếp', style: 'cancel' },
        { text: 'Vẫn kiểm tra', onPress: () => void doCheck() },
      ])
      return
    }
    void doCheck()
  }

  async function onGradeWriting() {
    const text = answers[WRITING_TEXT_KEY] ?? ''
    if (!text.trim()) return
    setBusy(true)
    try {
      await draft.flush()
      const ev = await gradePracticeWriting(examId, text, seconds)
      setEvaluation(ev)
      captureEvent('practice_writing_graded', { total: ev.total, max: ev.max, diag })
      refreshAfterCheck()
      if (diag) router.replace(asHref(diagnosticRoute))
    } catch (e) {
      Alert.alert('Chưa chấm được bài viết', apiMessage(e) || (e instanceof Error ? e.message : 'Thử lại sau ít phút.'))
    } finally {
      setBusy(false)
    }
  }

  function onRedo() {
    Alert.alert('Làm lại Teil này?', 'Câu trả lời và điểm của lần này sẽ bị xoá để làm lại từ đầu.', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Làm lại',
        style: 'destructive',
        onPress: async () => {
          try {
            await resetPracticeTeil(examId, teilKey)
            draft.reset()
            setAnswers({})
            setResult(null)
            setEvaluation(null)
            setSeconds(0)
            setPhase('idle')
            refreshAfterCheck()
          } catch (e) {
            Alert.alert('Chưa làm lại được', apiMessage(e) || 'Thử lại sau ít phút.')
          }
        },
      },
    ])
  }

  const next = overview ? nextTeilKey(overview, teilKey) : null
  const goNext = () => router.replace(asHref(next ? teilRoute(examId, next) : examSetRoute(examId)))
  const review = useMemo(() => (result ? new Map(result.items.map((r) => [r.id, r])) : undefined), [result])
  const summary = result ? scoreSummary(result.score, result.max) : null

  return (
    <Screen edges={['top']}>
      <AppHeader title={teilTitle(teilKey)} subtitle={diag ? 'Bài chẩn đoán' : overview?.title} onBack={goBack} />
      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <Skeleton height={120} radius="lg" />
          <Skeleton height={220} radius="lg" />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : !located ? (
        <EmptyState glyph="thithu" title="Không tìm thấy Teil này" message="Đề này không có Teil bạn mở. Quay lại màn Đề để chọn Teil khác." />
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[12], gap: space[4] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <ThemedText variant="caption" color="muted" style={{ flex: 1 }}>
              {meta?.suggestMinutes ? `Gợi ý ${meta.suggestMinutes} phút · không giới hạn giờ` : 'Không giới hạn giờ'}
            </ThemedText>
            <ThemedText variant="label" color="secondary" style={{ fontVariant: ['tabular-nums'] }} accessibilityLabel={`Đã làm ${Math.floor(seconds / 60)} phút`}>
              {formatClock(seconds)}
            </ThemedText>
          </View>

          {summary ? (
            <Card style={{ gap: space[1], borderColor: summary.passed ? c.success : c.danger, borderWidth: 1.5 }}>
              <ThemedText variant="titleLg" style={{ fontVariant: ['tabular-nums'] }}>
                {summary.score}/{summary.max} điểm · {result?.correctCount}/{result?.total} câu đúng
              </ThemedText>
              <ThemedText variant="bodyStrong" style={{ color: summary.passed ? c.success : c.danger }}>
                {summary.pct}% · {summary.label}
              </ThemedText>
              <ThemedText variant="caption" color="muted">Xem giải thích ngay dưới từng câu. Nghe lại không giới hạn.</ThemedText>
            </Card>
          ) : null}

          {located.kind === 'objective' ? (
            <ObjGroupView
              group={located.group}
              section={located.section}
              format={parsed?.format}
              level={overview?.level}
              answers={answers}
              onAnswer={setAnswer}
              gatePhase={located.group.ansage ? phase : undefined}
              onGatePhaseChange={setPhase}
              review={review}
              unlimitedPlays={checked}
              hideStrategy={diag}
            />
          ) : evaluation ? (
            <WritingResultCard evaluation={evaluation} />
          ) : (
            <WritingTaskView
              task={located.task}
              section={located.section}
              format={parsed?.format}
              level={overview?.level}
              value={answers[WRITING_TEXT_KEY] ?? ''}
              onChange={(text) => setAnswer(WRITING_TEXT_KEY, text)}
              hideStrategy={diag}
            />
          )}

          {!checked ? (
            located.kind === 'objective' ? (
              <Button
                label={busy ? 'Đang kiểm tra…' : `Kiểm tra (${answeredCount(located.group, answers)}/${located.group.items.length} câu)`}
                onPress={onCheck}
                loading={busy}
                disabled={answeredCount(located.group, answers) === 0}
              />
            ) : (
              <View style={{ gap: space[2] }}>
                <Button label={busy ? 'AI đang chấm, có thể mất 1–2 phút…' : 'Gửi chấm bài viết'} onPress={() => void onGradeWriting()} loading={busy} disabled={!(answers[WRITING_TEXT_KEY] ?? '').trim()} />
                <ThemedText variant="caption" color="muted" align="center">Bài tự lưu trên máy chủ, đóng app vẫn còn. Chấm dùng một lượt AI.</ThemedText>
              </View>
            )
          ) : (
            <View style={{ gap: space[2] }}>
              <Button label={next ? `Sang ${teilTitle(next)}` : 'Về màn Đề'} onPress={goNext} />
              {diag ? null : <Button label="Làm lại Teil này" variant="secondary" onPress={onRedo} />}
            </View>
          )}
        </Screen>
      )}
    </Screen>
  )
}
