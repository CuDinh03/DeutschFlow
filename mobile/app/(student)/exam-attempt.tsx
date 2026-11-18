import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Alert } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams, useNavigation, type Href } from 'expo-router'
import { Check } from 'lucide-react-native'
import api, { apiMessage } from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import {
  Screen,
  Card,
  ThemedText,
  Icon,
  Button,
  AppHeader,
  EmptyState,
  ErrorState,
  Skeleton,
  Caption,
  ProgressBar,
  GaGlyph,
} from '@/components/ui'
import { attemptTotalScore, finishPayload, isAttemptAlreadyFinished, parseExamSections, skippedSectionsLabel, gateVerdict, gateLabel, gateMargin, type AttemptResultDto, type ExamBudget, type ExamGate } from '@/lib/examApi'
import { ExamBudgetCard } from '@/components/exam/ExamBudgetCard'
import type { HoerenGatePhase } from '@/components/exam/HoerenGate'
import { ObjGroupView, WritingTaskView } from '@/components/exam/ExamTeilBody'
import { pollAsyncJob, AsyncJobFailedError, AsyncJobTimeoutError } from '@/lib/asyncJobs'
import { trackFeatureAction } from '@/lib/analytics'
import { useHardwareBack } from '@/hooks/useHardwareBack'
import { PARENT_OF } from '@/lib/screenParents'
import { takeAttemptDraft } from '@/lib/attemptDraft'

// Auto-scored objective reading (Lesen) attempt. Listening/Writing/Speaking are
// scored on the web; the app covers the true/false + single-choice items so a
// student can practise reading and get an instant score.
export default function ExamAttemptScreen() {
  // Màn sống trong Tabs nên KHÔNG unmount khi đổi tham số: mở sang attemptId khác vẫn là bản thể cũ,
  // giữ nguyên state (nháp, câu trả lời, điểm, tệp đính kèm) của lần trước. Remount theo key
  // giống mẫu ở skill-practice.tsx.
  const { attemptId } = useLocalSearchParams<{ attemptId: string }>()
  return <ExamAttemptRunner key={attemptId ?? 'none'} />
}

function ExamAttemptRunner() {
  const theme = useTheme()
  const c = theme.colors
  const params = useLocalSearchParams<{ examId: string; attemptId: string; title?: string; level?: string }>()
  const examId = Number(params.examId)
  const attemptId = Number(params.attemptId)

  const navigation = useNavigation()
  // Lượt đang dở mở từ màn giới thiệu: nạp đúng các câu đã lưu (có thể làm trên web).
  const [answers, setAnswers] = useState<Record<string, string>>(() => takeAttemptDraft(attemptId))
  const [submitting, setSubmitting] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [gates, setGates] = useState<ExamGate[] | undefined>(undefined)
  const [budget, setBudget] = useState<ExamBudget | undefined>(undefined)
  // Pha cổng nghi thức từng Teil nghe (đề telc) — khoá theo phần + Teil, sống suốt bài thi.
  const [hoerenPhases, setHoerenPhases] = useState<Record<string, HoerenGatePhase>>({})
  // Bài ĐÃ nộp lên server (202 nhận job) — kể cả khi poll điểm sau đó quá hạn.
  const [finishAccepted, setFinishAccepted] = useState(false)

  // An attempt is "in progress" once the student has answered something and the
  // attempt has not been finished/scored yet. Leaving now silently discards the
  // answers and orphans the server-created attempt, so we confirm first.
  // Sau khi finish đã được server NHẬN thì rời màn không mất gì nữa — đừng doạ.
  const hasUnsavedAttempt = Object.keys(answers).length > 0 && score == null && !finishAccepted
  // Set right before a confirmed navigation so the beforeRemove guard lets it through.
  const allowLeaveRef = useRef(false)

  // Confirm leaving mid-attempt; runs `proceed` only if the student chooses to exit.
  const confirmLeave = useCallback((proceed: () => void) => {
    Alert.alert(
      'Thoát bài thi?',
      'Bạn chưa nộp bài. Thoát bây giờ sẽ mất các câu đã trả lời.',
      [
        { text: 'Ở lại', style: 'cancel' },
        { text: 'Thoát', style: 'destructive', onPress: proceed },
      ],
    )
  }, [])

  const handleBack = useCallback(() => {
    if (hasUnsavedAttempt) {
      confirmLeave(() => {
        allowLeaveRef.current = true
        router.navigate(PARENT_OF['exam-attempt'])
      })
      return
    }
    router.navigate(PARENT_OF['exam-attempt'])
  }, [hasUnsavedAttempt, confirmLeave])
  // Back cứng Android cũng qua hộp xác nhận rời bài (Tabs không có stack nên beforeRemove không bắn).
  useHardwareBack(handleBack)

  // Guard the swipe-back / hardware-back gesture too, not just the header button.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!hasUnsavedAttempt || allowLeaveRef.current) return
      e.preventDefault()
      confirmLeave(() => {
        allowLeaveRef.current = true
        navigation.dispatch(e.data.action)
      })
    })
    return unsubscribe
  }, [navigation, hasUnsavedAttempt, confirmLeave])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['exam-questions', examId],
    queryFn: () =>
      api.get<{ sections_json: string }>(`/mock-exams/${examId}/questions`).then((r) => r.data),
    enabled: Number.isFinite(examId),
  })

  const parsed = useMemo(
    () => (data?.sections_json ? parseExamSections(data.sections_json) : null),
    [data?.sections_json],
  )

  const writingKeys = useMemo(
    () => (parsed?.sections ?? []).flatMap((sec) => sec.writing.map((w) => w.answerKey)),
    [parsed],
  )
  // Bài viết cũng là một "câu" trong tiến độ: đề telc có 45/225 điểm nằm ở đó, không đếm thì
  // thanh tiến độ báo xong trong khi học viên chưa viết dòng nào.
  const totalItems = (parsed?.groups.reduce((n, g) => n + g.items.length, 0) ?? 0) + writingKeys.length
  const answeredCount = Object.keys(answers).filter((k) => (answers[k] ?? '').trim().length > 0).length
  // Đúng những phần đề NÀY có mà app không dựng được — không phải câu liệt kê cứng "Nghe/Viết/Nói".
  const skippedLabel = skippedSectionsLabel(parsed?.skippedSections ?? [])

  async function submit() {
    if (answeredCount === 0) return
    setSubmitting(true)
    try {
      // Chấm chạy NỀN (S-5): finish trả 202 + jobId ngay, KHÔNG có điểm. Trước
      // đây màn này GET result ngay sau 202 nên đọc bản ghi chưa chấm (điểm null
      // → hiện 0), thêm lỗi đọc `totalScore` trong khi backend trả `total_score`
      // — hai lỗi che nhau (soát 02/09, F-10). Phải chờ job xong rồi mới đọc.
      // Khai luôn những phần app không dựng được: server loại chúng khỏi MẪU SỐ thay vì chấm 0.
      // Trước bản này một bài làm đúng hết phần Đọc vẫn ra ~33/100 vì Nghe/Viết bị tính 0 vào tổng.
      const finishRes = await api.post<{ jobId: string; status: string; attemptId: number }>(
        `/mock-exams/attempts/${attemptId}/finish`,
        finishPayload(answers, parsed),
      )
      setFinishAccepted(true)
      await pollAsyncJob(finishRes.data.jobId)
      const res = await api.get<AttemptResultDto>(`/mock-exams/attempts/${attemptId}/result`)
      const total = attemptTotalScore(res.data)
      trackFeatureAction('mock_exam', 'completed', { score: total })
      setGates(res.data.gates)
      setBudget(res.data.budget)
      setScore(total)
    } catch (e) {
      if (e instanceof AsyncJobTimeoutError) {
        // Bài ĐÃ nộp — chỉ là chấm lâu hơn trần chờ. Đừng nói "lỗi" kẻo user nộp lại.
        Alert.alert(
          'Đang chấm bài',
          'Bài của bạn đã nộp thành công nhưng chấm đang lâu hơn bình thường. Điểm sẽ hiện trong Lịch sử thi ít phút nữa.',
          [{ text: 'Đã hiểu', onPress: () => router.navigate(PARENT_OF['exam-attempt']) }],
        )
      } else if (isAttemptAlreadyFinished(e)) {
        // 409 ATTEMPT_NOT_IN_PROGRESS (#704): bài đã được chấm — hiện kết quả có sẵn, đừng để học viên
        // tưởng lỗi rồi nộp lại.
        try {
          const res = await api.get<AttemptResultDto>(`/mock-exams/attempts/${attemptId}/result`)
          setGates(res.data.gates)
          setBudget(res.data.budget)
          setScore(attemptTotalScore(res.data))
        } catch {
          Alert.alert(
            'Bài đã nộp',
            'Bài thi này đã được nộp và chấm. Xem điểm trong Lịch sử thi.',
            [{ text: 'Đã hiểu', onPress: () => router.navigate(PARENT_OF['exam-attempt']) }],
          )
        }
      } else if (e instanceof AsyncJobFailedError) {
        Alert.alert('Chấm bài thất bại', 'Hệ thống chấm gặp lỗi. Bạn hãy thử nộp lại.')
      } else {
        Alert.alert('Lỗi', apiMessage(e))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Screen edges={['top']}>
      <AppHeader
        title={params.title ?? 'Bài thi'}
        subtitle={
          parsed && parsed.sections.length > 0
            ? parsed.sections.map((sec) => sec.label).join(' · ')
            : 'Bài thi thử'
        }
        onBack={handleBack}
      />

      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <Skeleton height={90} radius="2xl" />
          <Skeleton height={90} radius="2xl" />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : score != null ? (
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space[5], gap: space[5] }}>
          {/* Result hero — editorial ink card carrying the auto-scored Lesen result */}
          <Card style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: radius.md,
                  backgroundColor: c.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon icon={Check} size={30} color="accent" />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Caption color={c.accent}>
                  {gateVerdict(gates) === 'PASSED'
                    ? 'Đỗ'
                    : gateVerdict(gates) === 'FAILED'
                      ? 'Chưa đạt'
                      : gateVerdict(gates) === 'INCOMPLETE'
                        ? 'Chưa đủ để kết luận'
                        : 'Đã chấm'}
                </Caption>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
                  <ThemedText variant="displayLg" style={{ color: c.onInk }}>
                    {String(score)}
                  </ThemedText>
                  <ThemedText variant="bodyStrong" style={{ color: c.onInkMuted }}>
                    điểm
                  </ThemedText>
                </View>
                <ThemedText variant="caption" style={{ color: c.onInkMuted }}>
                  {gateVerdict(gates) === 'INCOMPLETE'
                    ? 'Bạn còn một phần chưa thi — xem bên dưới.'
                    : skippedLabel
                      ? `Phần ${skippedLabel} của đề này làm trên web.`
                      : 'Điểm này tính trên các phần bạn đã làm.'}
                </ThemedText>
              </View>
            </View>
          </Card>

          {/* Hai ngưỡng đỗ độc lập của đề telc. Vắng mặt với đề Goethe nên không thấy gì đổi. */}
          {gates && gates.length > 0 ? (
            <Card style={{ gap: space[3] }}>
              <Caption>Hai ngưỡng đỗ</Caption>
              <ThemedText variant="caption" color="muted">
                Đề telc có hai ngưỡng riêng — giỏi bên này không bù được bên kia.
              </ThemedText>
              {gates.map((gate) => (
                <View key={gate.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText variant="bodyStrong">{gateLabel(gate.id)}</ThemedText>
                    <ThemedText variant="caption" color="muted">
                      {gate.status === 'PENDING'
                        ? `Cần ${gate.min}/${gate.max} điểm`
                        : `${gate.raw}/${gate.max} điểm · cần ${gate.min}`}
                    </ThemedText>
                    {(() => {
                      // LT1: khoảng cách tới ngưỡng — đỗ sát nút và đỗ dư dả là hai tình huống ôn khác nhau.
                      const margin = gateMargin(gate)
                      if (margin === null) return null
                      return (
                        <ThemedText variant="caption" style={{ color: margin >= 0 ? c.success : c.danger }}>
                          {margin >= 0 ? `Cao hơn ngưỡng ${margin} điểm` : `Còn thiếu ${-margin} điểm để qua ngưỡng`}
                        </ThemedText>
                      )
                    })()}
                  </View>
                  <ThemedText
                    variant="bodyStrong"
                    style={{ color: gate.status === 'PASSED' ? c.success : gate.status === 'FAILED' ? c.danger : c.textMuted }}
                  >
                    {gate.status === 'PASSED' ? 'Đạt' : gate.status === 'FAILED' ? 'Chưa đạt' : 'Chưa thi'}
                  </ThemedText>
                </View>
              ))}
              {gates.some((g) => g.id === 'oral' && g.status === 'PENDING') ? (
                <Button
                  label="Thi phần nói"
                  variant="secondary"
                  onPress={() => router.navigate('/(student)/exam' as unknown as Href)}
                />
              ) : null}
            </Card>
          ) : null}

          {budget ? (
            <ExamBudgetCard budget={budget} strategyExam={{ provider: parsed?.format, level: params.level }} />
          ) : null}

          <View style={{ gap: space[2] }}>
            <Button
              label="Xem lại bài"
              onPress={() =>
                router.replace({
                  pathname: '/(student)/exam-review',
                  params: { attemptId: String(attemptId), title: params.title ?? 'Bài thi' },
                } as unknown as Href)
              }
            />
            <View style={{ alignItems: 'center', marginTop: space[1] }}>
              <ThemedText variant="label" color="muted" onPress={handleBack}>
                Xong
              </ThemedText>
            </View>
          </View>
        </View>
      ) : !parsed || parsed.sections.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            glyph="doc"
            title="Chưa hỗ trợ trên app"
            message={
              skippedLabel
                ? `Đề này chỉ gồm phần ${skippedLabel} — hãy làm trên web.`
                : 'Đề này chưa có phần nào app dựng được — hãy làm trên web.'
            }
          />
        </View>
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[4], paddingTop: space[2] }}>
          {/* Progress — answered / total, mirrors the run-view progress bar */}
          <View style={{ gap: space[2] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Caption>Tiến độ</Caption>
              <ThemedText variant="monoLg" style={{ fontSize: 16, lineHeight: 20 }}>
                {answeredCount}
                <ThemedText variant="caption" color="faint">
                  {' '}
                  / {totalItems}
                </ThemedText>
              </ThemedText>
            </View>
            <ProgressBar value={totalItems > 0 ? answeredCount / totalItems : 0} height={6} />
          </View>

          {/* Editorial info banner */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[3],
              backgroundColor: c.infoSoft,
              borderRadius: radius.md,
              padding: space[3],
            }}
          >
            <GaGlyph name="doc" size={18} ink="info" gold="info" />
            <ThemedText variant="caption" color="info" style={{ flex: 1 }}>
              {skippedLabel
                ? `Phần ${skippedLabel} của đề này làm trên web — điểm của bạn không bị trừ vì những phần đó.`
                : `App dựng đủ ${parsed.sections.length} phần của đề này.`}
            </ThemedText>
          </View>

          {parsed.sections.map((section) => (
            <View key={section.name} style={{ gap: space[4] }}>
              {/* Đầu phần — học viên phải biết mình đang ở phần nào và phần đó bao nhiêu điểm. */}
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space[2] }}>
                <ThemedText variant="title">{section.label}</ThemedText>
                {section.maxPoints != null ? <Caption>{section.maxPoints} điểm</Caption> : null}
              </View>

              {section.groups.map((group, gi) => {
                // Cổng nghi thức (đề telc): Ansage → đọc câu hỏi → nghe được. Đề Goethe không khai ⇒ không cổng.
                const gateKey = `${section.name}-${group.title}`
                return (
                  <ObjGroupView
                    key={gi}
                    group={group}
                    section={section.name}
                    format={parsed.format}
                    level={params.level}
                    answers={answers}
                    onAnswer={(id, val) => setAnswers((prev) => ({ ...prev, [id]: val }))}
                    gatePhase={group.ansage ? (hoerenPhases[gateKey] ?? 'idle') : undefined}
                    onGatePhaseChange={(phase) => setHoerenPhases((prev) => ({ ...prev, [gateKey]: phase }))}
                  />
                )
              })}

              {section.writing.map((task) => (
                <WritingTaskView
                  key={task.answerKey}
                  task={task}
                  section={section.name}
                  format={parsed.format}
                  level={params.level}
                  value={answers[task.answerKey] ?? ''}
                  onChange={(val) => setAnswers((prev) => ({ ...prev, [task.answerKey]: val }))}
                />
              ))}
            </View>
          ))}

          <Button
            label={submitting ? 'Đang chấm…' : 'Nộp bài'}
            onPress={submit}
            loading={submitting}
            disabled={answeredCount === 0}
          />
        </Screen>
      )}
    </Screen>
  )
}
