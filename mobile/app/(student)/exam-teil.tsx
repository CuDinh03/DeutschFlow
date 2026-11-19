// Luyện một Teil telc (giao diện v3.4, Đợt 4, 19/11/2026) — bản app của
// /v2/student/mock-exam/practice/teil: không ép giờ (đồng hồ chỉ đếm lên), tự lưu nháp, kiểm tra xong
// có phân tích từng câu; bài Viết gửi AI chấm theo phiếu telc. Dựng câu hỏi bằng đúng linh kiện của
// màn thi thử (`ExamTeilBody`). `mode=diag`: một phần của bài chẩn đoán — không làm lại, không thẻ
// chiến thuật, kiểm tra xong về màn bài chẩn đoán.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, AppState, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { apiMessage } from '@/lib/api'
import { space, useTheme } from '@/lib/theme'
import { AppHeader, Button, Card, EmptyState, ErrorState, Screen, Skeleton, ThemedText } from '@/components/ui'
import { ObjGroupView, WritingTaskView } from '@/components/exam/ExamTeilBody'
import { WritingResultCard } from '@/components/exam/WritingResultCard'
import type { HoerenGatePhase } from '@/components/exam/HoerenGate'
import { parseExamSections, type ExamObjItem } from '@/lib/examApi'
import { askPracticeItemAi, checkPracticeTeil, getPracticeOverview, gradePracticeWriting, resetPracticeTeil, type PracticeOverview, type PracticeProgress, type PracticeTeilResult, type WritingEvaluation } from '@/lib/telcPracticeApi'
import { normalizeBlock, teilContext } from '@/lib/passageMarks'
import { MarkablePassage } from '@/components/exam/MarkablePassage'
import { AskAiPanel, MyNote, NoteField } from '@/components/exam/ItemAssist'
import { usePassageMarks } from '@/hooks/usePassageMarks'
import { useLeitpunktChecks } from '@/hooks/useLeitpunktChecks'
import { stopExamTts } from '@/lib/examTts'
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

  // Luôn tải lại khi mở: nạp tiến độ từ bản mới nhất của máy chủ, không từ bộ nhớ đệm cũ.
  const { data: overview, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: practiceOverviewKey(examId),
    queryFn: () => getPracticeOverview(examId),
    enabled: Number.isFinite(examId),
    refetchOnMount: 'always',
  })
  const parsed = useMemo(() => (overview?.sectionsJson ? parseExamSections(overview.sectionsJson) : null), [overview?.sectionsJson])
  const located = useMemo(() => locateTeil(parsed, teilKey), [parsed, teilKey])
  const meta = overview?.teile.find((t) => t.key === teilKey)

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [seconds, setSeconds] = useState(0)
  // "Vì sao tôi chọn" theo câu (như web): chỉ khi luyện Teil trắc nghiệm, không ở bài chẩn đoán.
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [result, setResult] = useState<PracticeTeilResult | null>(null)
  const [evaluation, setEvaluation] = useState<WritingEvaluation | null>(null)
  const [phase, setPhase] = useState<HoerenGatePhase>('idle')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const checked = !!result || !!evaluation
  const isWriting = teilKey.startsWith('SCHREIBEN')
  const withNotes = !diag && !isWriting
  const snapshot = (a: Record<string, string>, sec: number, n: Record<string, string>) => (withNotes ? { answers: a, seconds: sec, notes: n } : { answers: a, seconds: sec })
  const latest = useRef(snapshot(answers, seconds, notes))
  latest.current = snapshot(answers, seconds, notes)
  // Lưu nháp xong thì ghi tiến độ vào bộ nhớ đệm: mở lại Teil (hoặc màn Đề) thấy ngay bản mới.
  const onSaved = useCallback(
    (progress: PracticeProgress) =>
      queryClient.setQueryData<PracticeOverview>(practiceOverviewKey(examId), (old) =>
        old ? { ...old, teile: old.teile.map((t) => (t.key === teilKey ? { ...t, progress } : t)) } : old,
      ),
    [queryClient, examId, teilKey],
  )
  const draft = usePracticeDraft({ examId, teilKey, enabled: loaded && !checked, latest, onSaved })

  // Bài đọc có bút đánh dấu (như web): chỉ khi luyện Teil Lesen (không ở bài chẩn đoán) và bài đọc trên
  // màn đúng là `teil.context` — khối `ctx` mà server kiểm vị trí.
  const markContext = useMemo(() => {
    if (diag || located?.kind !== 'objective' || located.section !== 'LESEN' || !located.group.passage) return null
    const ctx = teilContext(overview?.sectionsJson, teilKey)
    return ctx && ctx === normalizeBlock(located.group.passage) ? ctx : null
  }, [diag, located, overview?.sectionsJson, teilKey])
  const marks = usePassageMarks({ examId, teilKey, context: markContext })
  const flushMarks = marks.flush
  // Ô "đã viết ý này" của bài Viết — chỉ lưu trên máy.
  const leitpunkte = useLeitpunktChecks(examId, teilKey, !diag && located?.kind === 'writing' ? located.task.points : undefined)

  // Nạp tiến độ đã lưu một lần, SAU lượt tải lại lúc mở (nháp, đồng hồ, kết quả đã kiểm tra).
  // Kết quả là trắc nghiệm hay phiếu chấm Viết quyết định theo phần thi, không đoán theo hình dạng.
  useEffect(() => {
    if (!meta || loaded || isFetching) return
    const p = meta.progress
    const a = p?.answers ?? {}
    const sec = p?.elapsedSeconds ?? 0
    const n = p?.notes ?? {}
    setAnswers(a)
    setSeconds(sec)
    setNotes(n)
    latest.current = snapshot(a, sec, n)
    draft.baseline()
    if (p?.checked) {
      if (isWriting) setEvaluation(writingResult(p.result))
      else setResult(objectiveResult(p.result))
    }
    setLoaded(true)
    // `snapshot` chỉ đọc `withNotes` (cố định theo Teil) — không cần chạy lại khi hàm đổi danh tính.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, loaded, isFetching, isWriting, draft])

  // Đồng hồ đếm lên mỗi giây khi màn đang mở, app đang dùng và chưa kiểm tra. Không bao giờ tự nộp.
  const [focused, setFocused] = useState(true)
  const focusedRef = useRef(true)
  useFocusEffect(
    useCallback(() => {
      setFocused(true)
      focusedRef.current = true
      return () => {
        setFocused(false)
        focusedRef.current = false
        // Rời màn thì thôi đọc Ansage / phát bài nghe; cổng nghe chưa mở thì làm lại từ đầu khi quay lại.
        stopExamTts()
        setPhase((ph) => (ph === 'ready' ? ph : 'idle'))
        void draft.flush()
        void flushMarks()
      }
    }, [draft, flushMarks]),
  )
  /** Chế độ chẩn đoán xong một phần thì về màn bài chẩn đoán — chỉ khi học viên còn ở màn này. */
  const backToDiagnostic = () => {
    if (focusedRef.current) router.replace(asHref(diagnosticRoute))
  }
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
    latest.current = snapshot(next, seconds, notes)
    draft.schedule()
  }

  const setNote = (id: string, text: string) => {
    if (checked || !withNotes) return
    const next = { ...notes }
    if (text.trim()) next[id] = text
    else delete next[id]
    setNotes(next)
    latest.current = snapshot(answers, seconds, next)
    draft.schedule()
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
      const p = await checkPracticeTeil(examId, teilKey, answers, seconds, withNotes ? notes : undefined)
      setResult(objectiveResult(p.result))
      if (p.notes) setNotes(p.notes)
      captureEvent('practice_teil_checked', { teil: teilKey, score: p.score ?? null, max: p.max ?? null, diag })
      refreshAfterCheck()
      if (diag) backToDiagnostic()
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
      if (diag) backToDiagnostic()
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
            setNotes({})
            if (isWriting) leitpunkte.clear()
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

  /** Cuối thẻ từng câu: "Vì sao tôi chọn" lúc làm, ghi chú + "Hỏi AI về câu này" sau khi kiểm tra. */
  const itemExtra = (item: ExamObjItem) => {
    if (!withNotes) return null
    if (!checked) return <NoteField label="câu này" value={notes[item.id] ?? ''} onChange={(text) => setNote(item.id, text)} />
    const mine = notes[item.id]?.trim()
    return (
      <View style={{ gap: space[3] }}>
        {mine ? <MyNote text={mine} /> : null}
        <AskAiPanel itemLabel={item.question} ask={() => askPracticeItemAi(examId, teilKey, item.id, 'vi')} />
      </View>
    )
  }
  const markablePassage =
    markContext && located?.kind === 'objective' ? (
      <MarkablePassage
        context={markContext}
        title={located.group.passageTitle}
        vorspann={located.group.vorspann}
        numbered={located.group.passageLines === true}
        glossary={located.group.glossary}
        quelle={located.group.quelle}
        pack={marks.pack}
        status={marks.status}
        dropped={marks.dropped}
        saveFailed={marks.saveFailed}
        onApply={marks.apply}
        onRetry={marks.retry}
      />
    ) : null

  return (
    <Screen edges={['top']}>
      <AppHeader title={teilTitle(teilKey)} subtitle={diag ? 'Bài chẩn đoán' : overview?.title} onBack={goBack} />
      {/* Chưa nạp xong tiến độ (kể cả lượt tải lại khi đã có bộ nhớ đệm) thì chưa cho thao tác:
          chọn câu lúc này sẽ bị bản nạp xoá, còn "Kiểm tra" sẽ đè điểm cũ trên máy chủ. */}
      {isLoading || (!loaded && !isError && !!meta) ? (
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
              passageOverride={markablePassage}
              renderItemExtra={itemExtra}
            />
          ) : evaluation ? (
            <WritingResultCard evaluation={evaluation} essay={answers[WRITING_TEXT_KEY]} />
          ) : (
            <WritingTaskView
              task={located.task}
              section={located.section}
              format={parsed?.format}
              level={overview?.level}
              value={answers[WRITING_TEXT_KEY] ?? ''}
              onChange={(text) => setAnswer(WRITING_TEXT_KEY, text)}
              editable={!busy}
              hideStrategy={diag}
              checkedPoints={diag ? undefined : leitpunkte.checked}
              onTogglePoint={diag ? undefined : leitpunkte.toggle}
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
