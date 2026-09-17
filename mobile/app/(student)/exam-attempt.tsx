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
  SelectableRow,
GaGlyph } from '@/components/ui'
import { attemptTotalScore, finishPayload, parseExamSections, skippedSectionsLabel, gateVerdict, gateLabel, NONE_OF_THEM, type AttemptResultDto, type ExamGate, type ExamObjItem, type ExamObjGroup, itemChoices } from '@/lib/examApi'
import { ExamAudio } from '@/components/exam/ExamAudio'
import { HoerenGate, type HoerenGatePhase } from '@/components/exam/HoerenGate'
import { TelcGapText } from '@/components/exam/TelcGapText'
import { TextInput } from 'react-native'
import { pollAsyncJob, AsyncJobFailedError, AsyncJobTimeoutError } from '@/lib/asyncJobs'
import { trackFeatureAction } from '@/lib/analytics'
import { useHardwareBack } from '@/hooks/useHardwareBack'
import { PARENT_OF } from '@/lib/screenParents'

// Auto-scored objective reading (Lesen) attempt. Listening/Writing/Speaking are
// scored on the web; the app covers the true/false + single-choice items so a
// student can practise reading and get an instant score.
export default function ExamAttemptScreen() {
  const theme = useTheme()
  const c = theme.colors
  const params = useLocalSearchParams<{ examId: string; attemptId: string; title?: string }>()
  const examId = Number(params.examId)
  const attemptId = Number(params.attemptId)

  const navigation = useNavigation()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [gates, setGates] = useState<ExamGate[] | undefined>(undefined)
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
      setScore(total)
    } catch (e) {
      if (e instanceof AsyncJobTimeoutError) {
        // Bài ĐÃ nộp — chỉ là chấm lâu hơn trần chờ. Đừng nói "lỗi" kẻo user nộp lại.
        Alert.alert(
          'Đang chấm bài',
          'Bài của bạn đã nộp thành công nhưng chấm đang lâu hơn bình thường. Điểm sẽ hiện trong Lịch sử thi ít phút nữa.',
          [{ text: 'Đã hiểu', onPress: () => router.navigate(PARENT_OF['exam-attempt']) }],
        )
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
                const gatePhase: HoerenGatePhase | undefined = group.ansage ? (hoerenPhases[gateKey] ?? 'idle') : undefined
                const audioLocked = gatePhase !== undefined && gatePhase !== 'ready'
                // Chưa bấm bắt đầu thì câu hỏi còn ẩn — cho đọc trước là vô hiệu hoá thời gian đọc của đề thật.
                const hideBody = gatePhase === 'idle'
                return (
                <View key={gi} style={{ gap: space[3] }}>
                  <Caption>{group.title}</Caption>
                  {group.instruction ? (
                    <ThemedText variant="body" color="secondary">
                      {group.instruction}
                    </ThemedText>
                  ) : null}

                  {group.ansage ? (
                    <HoerenGate
                      title={group.title}
                      ansage={group.ansage}
                      readingSeconds={group.readingSeconds ?? 0}
                      framing={group.framing}
                      phase={gatePhase ?? 'idle'}
                      onPhaseChange={(phase) => setHoerenPhases((prev) => ({ ...prev, [gateKey]: phase }))}
                    />
                  ) : null}

                  {!hideBody && group.audio ? (
                    <ExamAudio script={group.audio} label={group.title} maxPlays={group.maxPlays} locked={audioLocked} />
                  ) : null}

                  {/* Kho lựa chọn dùng chung cả Teil — in một lần ở đầu như đề giấy. */}
                  {group.pool && (group.telcType === 'MATCH_HEADLINE' || group.telcType === 'MATCH_AD_X') ? (
                    <View style={{ gap: space[2], backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: space[3] }}>
                      <Caption>{group.telcType === 'MATCH_HEADLINE' ? 'Các tiêu đề' : 'Các mẩu rao vặt'}</Caption>
                      {group.pool.map((opt) => (
                        <ThemedText key={opt.key} variant="body" color="secondary">
                          {opt.key}. {opt.label}
                        </ThemedText>
                      ))}
                      <Caption>Mỗi lựa chọn chỉ dùng một lần.</Caption>
                    </View>
                  ) : null}

                  {group.gappedText ? (
                    <TelcGapText
                      text={group.gappedText}
                      items={group.items}
                      answers={answers}
                      showWord={group.telcType === 'GAP_WORDBANK'}
                    />
                  ) : null}

                  {group.passage ? (
                    <View style={{ gap: space[2], backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: space[3] }}>
                      <Caption>Bài đọc</Caption>
                      <ThemedText variant="body" color="secondary">
                        {group.passage}
                      </ThemedText>
                    </View>
                  ) : null}

                  {!hideBody && group.items.map((item) => (
                    <View key={item.id} style={{ gap: space[2] }}>
                      {item.audio ? (
                        <ExamAudio script={item.audio} label={item.question} maxPlays={group.maxPlays} locked={audioLocked} compact />
                      ) : null}
                      <QuestionCard
                        item={item}
                        group={group}
                        answers={answers}
                        selected={answers[item.id]}
                        onSelect={(val) => setAnswers((prev) => ({ ...prev, [item.id]: val }))}
                      />
                    </View>
                  ))}
                </View>
                )
              })}

              {section.writing.map((task) => (
                <Card key={task.answerKey} style={{ gap: space[3] }}>
                  {task.instruction ? <ThemedText variant="title">{task.instruction}</ThemedText> : null}
                  {task.prompt ? (
                    <View style={{ gap: space[2], backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: space[3] }}>
                      <ThemedText variant="body" color="secondary">{task.prompt}</ThemedText>
                    </View>
                  ) : null}
                  {task.points?.map((pt, i) => (
                    <ThemedText key={i} variant="body" color="secondary">• {pt}</ThemedText>
                  ))}
                  <TextInput
                    multiline
                    value={answers[task.answerKey] ?? ''}
                    onChangeText={(val) => setAnswers((prev) => ({ ...prev, [task.answerKey]: val }))}
                    placeholder="Viết bài của bạn ở đây…"
                    placeholderTextColor={c.textFaint}
                    style={{
                      minHeight: 180, borderWidth: 1, borderColor: c.border, borderRadius: radius.sm,
                      padding: space[3], color: c.textPrimary, textAlignVertical: 'top',
                    }}
                  />
                  <Caption>{(answers[task.answerKey] ?? '').trim().split(/\s+/).filter(Boolean).length} từ</Caption>
                </Card>
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

function QuestionCard({
  item,
  group,
  answers,
  selected,
  onSelect,
}: {
  item: ExamObjItem
  /** Teil chứa câu này — cần cho luật "mỗi lựa chọn một lần" của đề telc. */
  group?: ExamObjGroup
  answers?: Record<string, string>
  selected?: string
  onSelect: (val: string) => void
}) {
  const { colors } = useTheme()
  // Giá trị nộp tách khỏi nhãn: trắc nghiệm options object nộp chữ cái A/B/C (AC-MOBFIX-03).
  const choices = itemChoices(item)

  // telc: lựa chọn đã bị câu KHÁC trong cùng Teil chiếm thì khoá lại — nhưng VẪN HIỆN, vì ẩn đi
  // là học viên mất dấu thứ tự a–l để đối chiếu với danh sách in ở đầu Teil. Đáp án `x` ("không
  // mẩu nào hợp") không bao giờ bị khoá: nhiều tình huống cùng có thể không hợp mẩu nào.
  const used = new Set<string>()
  if (group?.singleUse && answers) {
    for (const other of group.items) {
      if (other.id === item.id) continue
      const picked = answers[other.id]
      if (picked && picked !== NONE_OF_THEM) used.add(picked)
    }
  }
  const allChoices = group?.allowNone
    ? [...choices, { value: NONE_OF_THEM, label: 'không mẩu nào hợp' }]
    : choices
  return (
    <Card style={{ gap: space[4] }}>
      {item.passage ? (
        <View
          style={{
            gap: space[2],
            backgroundColor: colors.surfaceSunken,
            borderRadius: radius.md,
            padding: space[3],
          }}
        >
          <Caption>Đoạn văn</Caption>
          <ThemedText variant="body" color="secondary">
            {item.passage}
          </ThemedText>
        </View>
      ) : null}
      <ThemedText variant="title">{item.question}</ThemedText>
      <View style={{ gap: space[2] }}>
        {allChoices.map((choice) => (
          <Choice
            key={choice.value}
            label={choice.label}
            active={selected === choice.value}
            locked={used.has(choice.value) && selected !== choice.value}
            onPress={() => onSelect(choice.value)}
          />
        ))}
      </View>
    </Card>
  )
}

function Choice({ label, active, locked = false, onPress }: { label: string; active: boolean; locked?: boolean; onPress: () => void }) {
  const { colors } = useTheme()
  return (
    <SelectableRow
      role="radio"
      label={locked ? `${label} (đã dùng)` : label}
      selected={active}
      disabled={locked}
      onPress={locked ? () => {} : onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        borderWidth: active ? 2 : 1,
        borderColor: active ? colors.accent : colors.border,
        backgroundColor: active ? colors.accentSoft : colors.surface,
        borderRadius: radius.sm,
        paddingHorizontal: space[4],
        // Compensate the +1px active border so rows don't shift height.
        paddingVertical: active ? space[4] - 1 : space[4],
        // `SelectableRow` chỉ chặn thao tác và khai trợ năng; dấu hiệu NHÌN THẤY phải do đây đặt,
        // bằng không lựa chọn đã khoá trông y hệt lựa chọn còn bấm được.
        opacity: locked ? 0.45 : 1,
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: radius.full,
          borderWidth: 2,
          borderColor: active ? colors.accent : colors.borderStrong,
          backgroundColor: active ? colors.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {active ? <Icon icon={Check} size={13} color="onAccent" strokeWidth={3} /> : null}
      </View>
      <ThemedText
        variant={active ? 'bodyStrong' : 'body'}
        color={active ? 'primary' : 'secondary'}
        style={{ flex: 1 }}
      >
        {label}
      </ThemedText>
    </SelectableRow>
  )
}
