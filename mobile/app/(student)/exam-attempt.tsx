import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, AppState, View, type ScrollView } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useFocusEffect, useLocalSearchParams, useNavigation, type Href } from 'expo-router'
import api, { apiMessage } from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Button, AppHeader, EmptyState, ErrorState, Skeleton, GaGlyph } from '@/components/ui'
import { attemptTotalScore, finishPayload, isAttemptAlreadyFinished, parseExamSections, skippedSectionsLabel, type AttemptResultDto, type ExamBudget, type ExamGate } from '@/lib/examApi'
import type { HoerenGatePhase } from '@/components/exam/HoerenGate'
import { ObjGroupView, WritingTaskView } from '@/components/exam/ExamTeilBody'
import { MockRunBar, SaveStatus, type TeilChip } from '@/components/exam/mock/MockRunBar'
import { MockResultView } from '@/components/exam/mock/MockResultView'
import { MockStoppedView } from '@/components/exam/mock/MockStoppedView'
import { FlaggedNav } from '@/components/exam/mock/FlaggedNav'
import { useSpotlightScrollHost } from '@/components/guide/spotlightScrollHost'
import { flaggedEntries } from '@/lib/mockFlags'
import { stopPreview, stopPreviewMessage, stopResultFromDetailed, touchedAny, type RunTeil, type StopResult } from '@/lib/mockStop'
import { pollAsyncJob, AsyncJobFailedError, AsyncJobTimeoutError } from '@/lib/asyncJobs'
import { trackFeatureAction } from '@/lib/analytics'
import { useHardwareBack } from '@/hooks/useHardwareBack'
import { PARENT_OF } from '@/lib/screenParents'
import { parseDraftAnswers, takeAttemptDraft, takeAttemptStart } from '@/lib/attemptDraft'
import { answeredCount as groupAnswered } from '@/lib/practiceTeil'
import { asHref, oralRoute } from '@/lib/examRoutes'
import { saveAttemptDraft, stopAttempt } from '@/lib/mockAttemptApi'
import {
  anchorFromServer,
  createDraftAutosaver,
  mergeConflict,
  mergeFlags,
  nextStage,
  rawSectionNames,
  resumeStage,
  secondsLeft,
  sectionIndexForStage,
  shouldAutoSubmit,
  stageName,
  stageOf,
  stagesIn,
  teilChipLabel,
  toggleFlag,
  unansweredCount,
  type ClockAnchor,
  type DraftAutosaver,
  type SaveState,
} from '@/lib/mockRun'

// Thi thử trọn đề telc (mẫu v3.4 `mockrun` + `mockres`, Đợt 4 rồi 4b 19/11/2026). Mở từ màn giới thiệu
// `exam-full` sau `/start`: đồng hồ đếm ngược theo giờ server, chặng Lesen + Sprachbausteine → Hören →
// Schreiben (sang chặng sau là khoá chặng trước), tự lưu nháp lên máy chủ (`PATCH …/draft`, như web) và
// hết giờ thì tự nộp. Nộp xong chờ job chấm rồi hiện kết quả có phân tích từng câu.
/** Chờ lưu nháp tối đa bao lâu trước khi hỏi rời bài / trước khi nộp. */
const LEAVE_FLUSH_WAIT_MS = 3_000

/** Kết quả lưu (`true` = đã lưu hết), hoặc `false` khi quá `ms` mà chưa xong. */
function waitAtMost(p: Promise<boolean>, ms: number): Promise<boolean> {
  return Promise.race([p, new Promise<boolean>((r) => setTimeout(() => r(false), ms))])
}

export default function ExamAttemptScreen() {
  // Màn sống trong Tabs nên KHÔNG unmount khi đổi tham số. Remount theo lượt + nonce `t` mỗi lần mở
  // từ màn giới thiệu: lượt dở mở lại phải nạp nháp mới nhất của server (có thể vừa làm trên web),
  // không giữ state của lần mở trước.
  const { attemptId, t } = useLocalSearchParams<{ attemptId: string; t?: string }>()
  return <ExamAttemptRunner key={`${attemptId ?? 'none'}:${t ?? ''}`} />
}

function ExamAttemptRunner() {
  const theme = useTheme()
  const c = theme.colors
  const params = useLocalSearchParams<{ examId: string; attemptId: string; title?: string; level?: string }>()
  const examId = Number(params.examId)
  const attemptId = Number(params.attemptId)

  const navigation = useNavigation()
  // Trạng thái lượt từ `/start` (nháp, phiên bản, phần đang làm, mốc giờ). Mở không qua `/start` thì
  // không có đồng hồ và nháp đi từ phiên bản 0 (lệch thì server trả 409 và app gộp).
  const [start] = useState(() => takeAttemptStart(attemptId))
  const [answers, setAnswers] = useState<Record<string, string>>(() => start?.answers ?? takeAttemptDraft(attemptId))
  const [submitting, setSubmitting] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [result, setResult] = useState<AttemptResultDto | null>(null)
  const [gates, setGates] = useState<ExamGate[] | undefined>(undefined)
  const [budget, setBudget] = useState<ExamBudget | undefined>(undefined)
  // Pha cổng nghi thức từng Teil nghe (đề telc) — khoá theo phần + Teil, sống suốt bài thi.
  const [hoerenPhases, setHoerenPhases] = useState<Record<string, HoerenGatePhase>>({})
  // Bài ĐÃ nộp lên server (202 nhận job) — kể cả khi poll điểm sau đó quá hạn.
  const [finishAccepted, setFinishAccepted] = useState(false)
  const [clock, setClock] = useState<ClockAnchor | null>(start?.clock ?? null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  // Server báo quá hạn (410 khi lưu nháp) — coi như đồng hồ về 0 dù đồng hồ máy chưa.
  const [serverExpired, setServerExpired] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [stagePicked, setStagePicked] = useState<number | null>(null)
  const [focused, setFocused] = useState(true)
  // Cờ "đánh dấu xem lại" (V374) — lưu cùng nháp như web, nên đánh dấu trên web thì app thấy.
  const [flags, setFlags] = useState<string[]>(() => start?.flags ?? [])
  // Dừng giữa chừng (Đợt 4e): đang gọi /stop, và kết quả khi đã dừng.
  const [stopping, setStopping] = useState(false)
  const [stopped, setStopped] = useState<StopResult | null>(null)

  const answersRef = useRef(answers)
  answersRef.current = answers
  // Bản server đã xác nhận gần nhất (gốc của phép gộp ba chiều khi lệch phiên bản) + bản đang gửi.
  const ackedRef = useRef<Record<string, string>>(answers)
  const sendingRef = useRef<Record<string, string> | null>(null)
  const flagsRef = useRef(flags)
  flagsRef.current = flags
  const ackedFlagsRef = useRef<string[]>(flags)
  const sendingFlagsRef = useRef<string[] | undefined>(undefined)
  // Chỉ gửi `flags` khi đã biết cờ trên server (mở qua /start, hoặc 409 mang bản nháp) hoặc người học vừa
  // đổi cờ — không thì gửi mảng rỗng sẽ xoá cờ đã đặt trên web. Server BỎ trường `flags` khi không có cờ
  // nào (`MockExamDraftService.parseFlags` trả null cho mảng rỗng), nên vắng = rỗng.
  const flagsKnownRef = useRef(start != null)
  // Vị trí trong ScrollView để nhảy tới Teil / câu đánh dấu: phần → nhóm/Teil → câu.
  const scrollHostRef = useRef<ScrollView | null>(null)
  const sectionYRef = useRef<Record<string, number>>({})
  const blockYRef = useRef<Record<string, { section: string; y: number }>>({})
  const itemYRef = useRef<Record<string, { block: string; y: number }>>({})
  const blockOfItemRef = useRef<Record<string, string>>({})
  const saverRef = useRef<DraftAutosaver | null>(null)
  // Đang nộp (từ lúc bấm, kể cả lúc chờ lưu nốt nháp): chặn bấm nộp lần hai và tự nộp.
  const finishingRef = useRef(false)
  // Đã gọi /finish: chặn mọi lần lưu nháp (PATCH sau /finish chỉ nhận 409).
  const submittingRef = useRef(false)
  const autoFiredRef = useRef(false)
  // Có thay đổi do người học (câu trả lời, chặng) — nạp nháp ban đầu không tính là thay đổi.
  const touchedRef = useRef(false)
  // Set right before a confirmed navigation so the beforeRemove guard lets it through.
  const allowLeaveRef = useRef(false)

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
  const rawNames = useMemo(() => rawSectionNames(data?.sections_json), [data?.sections_json])
  const stages = useMemo(() => stagesIn((parsed?.sections ?? []).map((s) => s.name)), [parsed])
  const stage = stagePicked ?? resumeStage(rawNames, start?.sectionIndex, stages)
  const sectionIndex = sectionIndexForStage(rawNames, stage, start?.sectionIndex)
  const after = nextStage(stages, stage)

  const answerKeys = useMemo(
    () => (parsed?.sections ?? []).flatMap((sec) => [...sec.groups.flatMap((g) => g.items.map((it) => it.id)), ...sec.writing.map((w) => w.answerKey)]),
    [parsed],
  )
  // Bài viết cũng là một "câu" trong tiến độ: đề telc có 45/225 điểm nằm ở đó.
  const totalItems = answerKeys.length
  const answeredCount = Object.keys(answers).filter((k) => (answers[k] ?? '').trim().length > 0).length
  // Đúng những phần đề NÀY có mà app không dựng được — không phải câu liệt kê cứng "Nghe/Viết/Nói".
  const skippedLabel = skippedSectionsLabel(parsed?.skippedSections ?? [])
  const finished = score != null || finishAccepted || stopped != null
  const inProgress = !finished && !!parsed && parsed.sections.length > 0
  const remaining = serverExpired ? 0 : secondsLeft(clock, nowMs)

  // ── tự lưu nháp ──────────────────────────────────────────────────────────────
  const showExistingResult = useCallback(async () => {
    try {
      const res = await api.get<AttemptResultDto>(`/mock-exams/attempts/${attemptId}/result`)
      // Lượt đã "Dừng giữa chừng" ở nơi khác: không có tổng điểm — hiện điểm từng Teil, đừng hiện "0 điểm".
      if (res.data.status === 'PARTIAL') {
        setStopped(stopResultFromDetailed(attemptId, res.data.detailed_scores_json) ?? {
          attemptId, status: 'PARTIAL', alreadyClosed: true, teileDone: null, teileCounted: null, teileTotal: null, teile: [],
        })
        return
      }
      setResult(res.data)
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
  }, [attemptId])
  const showExistingRef = useRef(showExistingResult)
  showExistingRef.current = showExistingResult
  const sectionIndexRef = useRef(sectionIndex)
  sectionIndexRef.current = sectionIndex

  useEffect(() => {
    const saver = createDraftAutosaver({
      save: (payload, base) => {
        // Đang nộp: KHÔNG giả "đã lưu" (nộp lỗi thì hộp Tạm rời sẽ báo sai là đã lưu) — coi như chưa lưu.
        if (submittingRef.current) return Promise.resolve({ kind: 'error' as const })
        sendingRef.current = payload.answers
        sendingFlagsRef.current = payload.flags
        return saveAttemptDraft(attemptId, payload, base)
      },
      onSaved: ({ clock: body }) => {
        if (sendingRef.current) ackedRef.current = sendingRef.current
        if (sendingFlagsRef.current) ackedFlagsRef.current = sendingFlagsRef.current
        // Mỗi lần lưu kéo đồng hồ về sự thật của server.
        const a = anchorFromServer(body, Date.now())
        if (a) setClock(a)
      },
      onConflict: ({ serverVersion, draft }) => {
        if (submittingRef.current) return
        // Lượt được lưu ở nơi khác (web, hoặc lần lưu trước tới server mà mất phản hồi): gộp rồi lưu lại.
        saver.adoptVersion(draft?.version ?? serverVersion)
        const serverAnswers = parseDraftAnswers(draft?.answersJson)
        const merged = mergeConflict(answersRef.current, serverAnswers, ackedRef.current)
        ackedRef.current = serverAnswers
        answersRef.current = merged
        setAnswers(merged)
        // Cờ gộp cùng luật. Có bản nháp mà vắng `flags` = server không còn cờ nào (web vừa bỏ hết).
        let mergedFlags = flagsRef.current
        if (draft) {
          const serverFlags = draft.flags ?? []
          mergedFlags = mergeFlags(flagsRef.current, serverFlags, ackedFlagsRef.current)
          ackedFlagsRef.current = serverFlags
          flagsKnownRef.current = true
          flagsRef.current = mergedFlags
          setFlags(mergedFlags)
        }
        saver.notifyChange({
          answers: merged,
          sectionIndex: sectionIndexRef.current,
          ...(flagsKnownRef.current ? { flags: mergedFlags } : {}),
        })
      },
      onExpired: () => setServerExpired(true),
      onClosed: () => {
        if (!finishingRef.current) void showExistingRef.current()
      },
      onState: setSaveState,
    })
    saver.adoptVersion(start?.version ?? 0)
    saverRef.current = saver
    return () => {
      saver.dispose()
      if (saverRef.current === saver) saverRef.current = null
    }
  }, [attemptId, start])

  useEffect(() => {
    if (!touchedRef.current || finished) return
    saverRef.current?.notifyChange({ answers, sectionIndex, ...(flagsKnownRef.current ? { flags } : {}) })
  }, [answers, sectionIndex, flags, finished])

  // App xuống nền: lưu ngay (iOS chỉ cho vài giây). Lên lại: cập nhật đồng hồ ngay, không chờ nhịp.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setNowMs(Date.now())
      else void saverRef.current?.flush()
    })
    return () => sub.remove()
  }, [])

  // Rời màn (màn ẩn dưới Tabs không unmount): lưu ngay; quay lại thì đồng hồ tính lại ngay.
  useFocusEffect(
    useCallback(() => {
      setFocused(true)
      setNowMs(Date.now())
      allowLeaveRef.current = false
      return () => {
        setFocused(false)
        void saverRef.current?.flush()
      }
    }, []),
  )

  // ── đồng hồ ──────────────────────────────────────────────────────────────────
  // Màn ẩn thì không cần nhịp mỗi giây; quay lại màn là tính lại ngay (focus effect bên trên).
  const ticking = clock != null && !finished && focused
  useEffect(() => {
    if (!ticking) return
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [ticking])

  // ── nộp ─────────────────────────────────────────────────────────────────────
  async function submit(opts?: { auto?: boolean }) {
    if (finishingRef.current) return
    if (!opts?.auto && answeredCount === 0) return
    finishingRef.current = true
    setSubmitting(true)
    try {
      // Lưu nốt nháp (và chờ lần lưu đang bay) TRƯỚC khi chặn lưu, để không có PATCH đua với /finish và
      // để server giữ bản mới nhất nếu /finish lỗi rồi học viên rời đi. Mạng treo thì không chờ quá lâu:
      // thân /finish vẫn mang đủ câu trả lời (trong hạn + 120 giây ân hạn server chấm theo thân này).
      await waitAtMost(saverRef.current?.flush().catch(() => false) ?? Promise.resolve(true), LEAVE_FLUSH_WAIT_MS)
      submittingRef.current = true
      // Chấm chạy NỀN (S-5): finish trả 202 + jobId ngay, KHÔNG có điểm. Trước
      // đây màn này GET result ngay sau 202 nên đọc bản ghi chưa chấm (điểm null
      // → hiện 0), thêm lỗi đọc `totalScore` trong khi backend trả `total_score`
      // — hai lỗi che nhau (soát 02/09, F-10). Phải chờ job xong rồi mới đọc.
      // Khai luôn những phần app không dựng được: server loại chúng khỏi MẪU SỐ thay vì chấm 0.
      // Trước bản này một bài làm đúng hết phần Đọc vẫn ra ~33/100 vì Nghe/Viết bị tính 0 vào tổng.
      const finishRes = await api.post<{ jobId: string; status: string; attemptId: number }>(
        `/mock-exams/attempts/${attemptId}/finish`,
        finishPayload(answersRef.current, parsed),
      )
      saverRef.current?.dispose()
      setFinishAccepted(true)
      await pollAsyncJob(finishRes.data.jobId)
      const res = await api.get<AttemptResultDto>(`/mock-exams/attempts/${attemptId}/result`)
      const total = attemptTotalScore(res.data)
      trackFeatureAction('mock_exam', 'completed', { score: total })
      setResult(res.data)
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
        saverRef.current?.dispose()
        await showExistingResult()
      } else {
        // Chưa nộp được (hoặc nộp rồi mà đọc điểm lỗi): mở lại bài để nộp lại — nộp lại một lượt đã
        // nhận thì server trả 409 và nhánh trên hiện kết quả có sẵn. Chưa nộp thì tự lưu chạy tiếp.
        submittingRef.current = false
        finishingRef.current = false
        if (e instanceof AsyncJobFailedError) {
          Alert.alert('Chấm bài thất bại', 'Hệ thống chấm gặp lỗi. Bạn hãy thử nộp lại.')
        } else if (opts?.auto) {
          // Hết giờ mà mất mạng: không để học viên kẹt ở bài đã hết giờ.
          Alert.alert('Chưa nộp được bài', `${apiMessage(e) || 'Mất kết nối.'} Bài vẫn được lưu, hãy thử nộp lại.`, [
            { text: 'Thử nộp lại', onPress: () => void submitRef.current({ auto: true }) },
          ])
        } else {
          Alert.alert('Lỗi', apiMessage(e))
        }
      }
    } finally {
      setSubmitting(false)
    }
  }
  const submitRef = useRef(submit)
  submitRef.current = submit

  // Hết giờ: tự nộp như web — một lần, chỉ khi đang ở màn thi (rời màn thì nộp khi quay lại).
  useEffect(() => {
    if (!inProgress) return
    if (!shouldAutoSubmit({ secondsLeft: remaining, focused, finished, submitting: finishingRef.current, fired: autoFiredRef.current })) return
    autoFiredRef.current = true
    setTimedOut(true)
    void submitRef.current({ auto: true })
  }, [remaining, focused, finished, inProgress])

  function confirmSubmit() {
    const left = unansweredCount(answerKeys, answers)
    Alert.alert(
      'Nộp bài thi thử?',
      left > 0 ? `Còn ${left} câu chưa làm. Nộp rồi thì không sửa được nữa.` : 'Bạn đã làm hết các câu. Nộp rồi thì không sửa được nữa.',
      [
        { text: 'Làm tiếp', style: 'cancel' },
        { text: 'Nộp bài', onPress: () => void submit() },
      ],
    )
  }

  function goNextStage() {
    if (after == null) return
    const toHoeren = after === stageOf('HOEREN')
    Alert.alert(
      `Sang ${stageName(after)}?`,
      toHoeren
        ? 'Bắt đầu rồi thì không quay lại Lesen và Sprachbausteine.'
        : `Câu ${stageName(stage)} đã làm được giữ, nhưng không quay lại ${stageName(stage)} được nữa.`,
      [
        { text: 'Ở lại', style: 'cancel' },
        {
          text: `Sang ${stageName(after)}`,
          onPress: () => {
            touchedRef.current = true
            setStagePicked(after)
          },
        },
      ],
    )
  }

  // ── rời màn ─────────────────────────────────────────────────────────────────
  // Lượt KHÔNG dừng khi rời: đồng hồ server vẫn chạy (như web, như thi thật). Lưu nháp trước rồi mới hỏi;
  // lưu không được (mất mạng) thì nói thẳng là câu vừa làm có thể mất.
  const confirmLeave = useCallback((proceed: () => void) => {
    void (async () => {
      // Chờ lưu tối đa vài giây: mạng treo thì vẫn hỏi ngay, nói rõ là chưa lưu được.
      const saved = await waitAtMost(saverRef.current?.flush().catch(() => false) ?? Promise.resolve(true), LEAVE_FLUSH_WAIT_MS)
      Alert.alert(
        saved ? 'Tạm rời bài thi?' : 'Chưa lưu được bài',
        saved
          ? 'Câu trả lời đã lưu lên máy chủ. Đồng hồ vẫn chạy khi bạn rời đi; mở lại đề để làm tiếp.'
          : 'Mạng đang chập chờn nên các câu vừa làm chưa lên máy chủ. Rời bây giờ có thể mất những câu đó.',
        [
          { text: 'Ở lại', style: 'cancel' },
          { text: 'Rời bài thi', style: saved ? 'default' : 'destructive', onPress: proceed },
        ],
      )
    })()
  }, [])

  const handleBack = useCallback(() => {
    const leave = () => {
      allowLeaveRef.current = true
      router.navigate(PARENT_OF['exam-attempt'])
    }
    if (inProgress && !submitting) confirmLeave(leave)
    else leave()
  }, [inProgress, submitting, confirmLeave])
  // Back cứng Android cũng qua hộp xác nhận rời bài (Tabs không có stack nên beforeRemove không bắn).
  useHardwareBack(handleBack)

  // Guard the swipe-back / hardware-back gesture too, not just the header button.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!inProgress || allowLeaveRef.current) return
      e.preventDefault()
      confirmLeave(() => {
        allowLeaveRef.current = true
        navigation.dispatch(e.data.action)
      })
    })
    return unsubscribe
  }, [navigation, inProgress, confirmLeave])

  const onAnswer = useCallback((id: string, val: string) => {
    touchedRef.current = true
    setAnswers((prev) => ({ ...prev, [id]: val }))
  }, [])

  const onToggleFlag = useCallback((id: string) => {
    touchedRef.current = true
    flagsKnownRef.current = true
    setFlags((prev) => toggleFlag(prev, id))
  }, [])

  // ── nhảy tới Teil / câu ─────────────────────────────────────────────────────
  const scrollToY = useCallback((y: number) => {
    scrollHostRef.current?.scrollTo({ y: Math.max(0, y - space[3]), animated: true })
  }, [])
  const jumpToBlock = useCallback((key: string) => {
    const b = blockYRef.current[key]
    if (b) scrollToY((sectionYRef.current[b.section] ?? 0) + b.y)
  }, [scrollToY])
  const jumpToItem = useCallback((id: string) => {
    const it = itemYRef.current[id]
    const b = it ? blockYRef.current[it.block] : undefined
    if (it && b) scrollToY((sectionYRef.current[b.section] ?? 0) + b.y + it.y)
    // Câu đang ẩn (Teil nghe chưa bấm bắt đầu) không có vị trí: tới đầu Teil chứa nó.
    else if (blockOfItemRef.current[id]) jumpToBlock(blockOfItemRef.current[id])
  }, [scrollToY, jumpToBlock])

  // ── dừng giữa chừng ─────────────────────────────────────────────────────────
  // Như web (owner chốt 07/11/2026): server chấm theo Teil những Teil đã chạm, Viết dở không chấm, đồng hồ
  // dừng; lượt ghi "Dừng giữa chừng". Chưa chạm câu nào ⇒ huỷ lượt (không vào lịch sử) rồi rời, không hỏi.
  const leaveToParent = useCallback(() => {
    allowLeaveRef.current = true
    router.navigate(PARENT_OF['exam-attempt'])
  }, [])

  async function stopNow() {
    if (finishingRef.current) return
    finishingRef.current = true
    submittingRef.current = true
    setStopping(true)
    try {
      const r = await stopAttempt(attemptId, answersRef.current)
      saverRef.current?.dispose()
      trackFeatureAction('mock_exam', 'quit', { status: r.status })
      if (r.alreadyClosed && r.status !== 'CANCELLED') {
        // Lượt đã đóng ở nơi khác (web, hoặc hết giờ): /stop không kèm điểm — đọc kết quả có sẵn.
        await showExistingResult()
      } else if (r.status === 'PARTIAL') {
        setStopped(r)
      } else {
        // CANCELLED: không câu nào được tính (ví dụ chỉ làm phần server không chấm).
        Alert.alert('Đã huỷ lượt thi', 'Chưa có câu nào được tính điểm nên lượt này bị huỷ, không vào lịch sử thi.', [
          { text: 'Đã hiểu', onPress: leaveToParent },
        ])
      }
    } catch (e) {
      // Chưa dừng được: lượt vẫn mở như cũ, tự lưu chạy tiếp.
      submittingRef.current = false
      finishingRef.current = false
      Alert.alert('Chưa dừng được bài thi', `${apiMessage(e) || 'Mất kết nối.'} Bài vẫn mở, bạn có thể làm tiếp hoặc thử dừng lại.`)
    } finally {
      setStopping(false)
    }
  }
  const stopNowRef = useRef(stopNow)
  stopNowRef.current = stopNow

  // ── khung ──────────────────────────────────────────────────────────────────
  if (stopped) {
    return (
      <Screen edges={['top']}>
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], paddingTop: space[4] }}>
          <MockStoppedView result={stopped} title={params.title ?? 'Thi thử trọn đề'} onBack={leaveToParent} />
        </Screen>
      </Screen>
    )
  }

  if (score != null) {
    return (
      <Screen edges={['top']}>
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], paddingTop: space[2] }}>
          <MockResultView
            attemptId={attemptId}
            title={params.title ?? ''}
            level={params.level}
            format={parsed?.format}
            score={score}
            passed={result?.passed}
            gates={gates}
            budget={budget}
            detailedJson={result?.detailed_scores_json}
            finishedAt={result?.finished_at}
            skippedLabel={skippedLabel}
            onBack={handleBack}
            onOral={() => router.navigate(asHref(oralRoute({ level: params.level ?? 'B1' })))}
            onReviewLegacy={() =>
              router.replace({
                pathname: '/(student)/exam-review',
                params: { attemptId: String(attemptId), title: params.title ?? 'Bài thi' },
              } as unknown as Href)
            }
          />
        </Screen>
      </Screen>
    )
  }

  if (isLoading || isError || !parsed || parsed.sections.length === 0) {
    return (
      <Screen edges={['top']}>
        <AppHeader title={params.title ?? 'Bài thi'} subtitle="Thi thử trọn đề" onBack={handleBack} />
        {isLoading ? (
          <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
            <Skeleton height={90} radius="2xl" />
            <Skeleton height={90} radius="2xl" />
          </View>
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
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
        )}
      </Screen>
    )
  }

  if (submitting || stopping) {
    return (
      <Screen edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space[5] }}>
          <Card style={{ gap: space[3], alignItems: 'center', paddingVertical: space[8] }}>
            <ActivityIndicator color={c.textPrimary} />
            <ThemedText variant="title" align="center" accessibilityRole="header" accessibilityLiveRegion="polite">
              {stopping ? 'Đang dừng và chấm phần đã làm…' : timedOut ? 'Hết giờ. Bài đang được nộp' : 'Đang nộp và chấm bài…'}
            </ThemedText>
            <ThemedText variant="caption" color="muted" align="center">
              {stopping ? 'Teil đã làm được chấm ngay; bài viết dở không chấm.' : 'Trắc nghiệm chấm ngay; bài viết AI chấm khoảng một phút.'}
            </ThemedText>
          </Card>
        </View>
      </Screen>
    )
  }

  const stageSections = parsed.sections.filter((sec) => stages.length <= 1 || stageOf(sec.name) === stage)
  const chips: TeilChip[] = stageSections.flatMap((sec) => [
    ...sec.groups.map((g, i) => {
      const done = groupAnswered(g, answers)
      return { key: `${sec.name}-${g.teilNo ?? i + 1}`, label: teilChipLabel(sec.name, g.teilNo ?? i + 1, done, g.items.length), complete: g.items.length > 0 && done === g.items.length }
    }),
    ...sec.writing.map((w) => {
      const done = (answers[w.answerKey] ?? '').trim() ? 1 : 0
      return { key: w.answerKey, label: teilChipLabel('SCHREIBEN', w.teil, done, 1), complete: done === 1 }
    }),
  ])
  // Teil của cả lượt (mọi chặng) theo cách server chấm khi dừng: trắc nghiệm theo câu, Viết theo bài.
  const runTeile: RunTeil[] = parsed.sections.flatMap((sec) => [
    ...sec.groups.map((g, i): RunTeil => ({ key: `${sec.name}-${g.teilNo ?? i + 1}`, writing: false, answered: groupAnswered(g, answers), total: g.items.length })),
    ...sec.writing.map((w): RunTeil => ({ key: `SCHREIBEN-${w.teil}`, writing: true, answered: (answers[w.answerKey] ?? '').trim() ? 1 : 0, total: 1 })),
  ])
  const flagged = flaggedEntries(stageSections, flags)

  // Tạm rời từ hộp Dừng: lưu rồi rời ngay; chỉ hỏi lại khi chưa lưu được (mất mạng).
  async function leaveAfterSave() {
    const saved = await waitAtMost(saverRef.current?.flush().catch(() => false) ?? Promise.resolve(true), LEAVE_FLUSH_WAIT_MS)
    if (saved) leaveToParent()
    else confirmLeave(leaveToParent)
  }

  // Nút X (mẫu `mockrun`: "Dừng thi thử"): dừng và chấm phần đã làm, hoặc tạm rời giữ lượt.
  function requestExit() {
    if (!inProgress || stopping) {
      handleBack()
      return
    }
    // Chỉ khi mở qua /start (đã nạp nháp server): mở không qua /start thì máy có thể chưa thấy câu đã làm trên web.
    if (start != null && !touchedAny(answersRef.current)) {
      // Như web: chưa làm câu nào thì huỷ lượt rồi rời, không hỏi. Huỷ lỗi vẫn rời — lượt rỗng được chốt
      // khi quá giờ.
      finishingRef.current = true
      submittingRef.current = true
      saverRef.current?.dispose()
      void stopAttempt(attemptId, {}).catch(() => undefined)
      leaveToParent()
      return
    }
    Alert.alert(
      'Dừng bài thi thử?',
      `${stopPreviewMessage(stopPreview(runTeile))}\n\nTạm rời thì giữ lượt, nhưng đồng hồ vẫn chạy.`,
      [
        { text: 'Làm tiếp', style: 'cancel' },
        { text: 'Tạm rời', onPress: () => void leaveAfterSave() },
        { text: 'Dừng và chấm', style: 'destructive', onPress: () => void stopNowRef.current() },
      ],
    )
  }

  const notices = [
    start?.closedPrevious ? 'Lượt thi trước của đề này đã hết giờ khi bạn rời đi; phần đã làm được lưu vào lịch sử với nhãn “Dừng giữa chừng”.' : null,
    start && Object.keys(start.answers).length > 0 ? `Đã khôi phục ${Object.keys(start.answers).length} câu đã làm.` : null,
    skippedLabel ? `Phần ${skippedLabel} của đề này làm trên web — điểm của bạn không bị trừ vì những phần đó.` : null,
    clock == null ? 'Lượt này không có đồng hồ trên app: tự canh giờ theo từng khối.' : null,
  ].filter((x): x is string => !!x)

  return (
    <Screen edges={['top']}>
      <MockRunBar
        title={params.title ?? 'Bài thi'}
        stage={stage}
        stages={stages}
        secondsLeft={remaining}
        chips={chips}
        onExit={requestExit}
        onChipPress={jumpToBlock}
      />
      {/* key theo chặng: sang chặng mới thì cuộn về đầu chặng. */}
      <Screen key={`stage-${stage}`} scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[4], paddingTop: space[2] }}>
        <ScrollHostBridge target={scrollHostRef} />
        {notices.length > 0 ? (
          <View style={{ flexDirection: 'row', gap: space[3], backgroundColor: c.infoSoft, borderRadius: radius.md, padding: space[3] }}>
            <GaGlyph name="thithu" size={18} ink="info" gold="info" />
            <View style={{ flex: 1, gap: space[1] }}>
              {notices.map((n) => (
                <ThemedText key={n} variant="caption" color="info">{n}</ThemedText>
              ))}
            </View>
          </View>
        ) : null}

        {stageSections.map((section) => (
          <View key={section.name} style={{ gap: space[4] }} onLayout={(e) => { sectionYRef.current[section.name] = e.nativeEvent.layout.y }}>
            {/* Đầu phần — học viên phải biết mình đang ở phần nào và phần đó bao nhiêu điểm. */}
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space[2] }}>
              <ThemedText variant="title" accessibilityRole="header">{section.label}</ThemedText>
              {section.maxPoints != null ? <ThemedText variant="caption" color="muted">{section.maxPoints} điểm</ThemedText> : null}
            </View>

            {section.groups.map((group, gi) => {
              // Cổng nghi thức (đề telc): Ansage → đọc câu hỏi → nghe được. Đề Goethe không khai ⇒ không cổng.
              const gateKey = `${section.name}-${group.title}`
              const blockKey = `${section.name}-${group.teilNo ?? gi + 1}`
              for (const it of group.items) blockOfItemRef.current[it.id] = blockKey
              return (
                <View key={gi} onLayout={(e) => { blockYRef.current[blockKey] = { section: section.name, y: e.nativeEvent.layout.y } }}>
                  <ObjGroupView
                    group={group}
                    section={section.name}
                    format={parsed.format}
                    level={params.level}
                    answers={answers}
                    onAnswer={onAnswer}
                    gatePhase={group.ansage ? (hoerenPhases[gateKey] ?? 'idle') : undefined}
                    onGatePhaseChange={(phase) => setHoerenPhases((prev) => ({ ...prev, [gateKey]: phase }))}
                    flags={flags}
                    onToggleFlag={onToggleFlag}
                    onItemLayout={(id, y) => { itemYRef.current[id] = { block: blockKey, y } }}
                  />
                </View>
              )
            })}

            {section.writing.map((task) => (
              <View key={task.answerKey} onLayout={(e) => { blockYRef.current[task.answerKey] = { section: section.name, y: e.nativeEvent.layout.y } }}>
                <WritingTaskView
                  task={task}
                  section={section.name}
                  format={parsed.format}
                  level={params.level}
                  value={answers[task.answerKey] ?? ''}
                  onChange={(val) => onAnswer(task.answerKey, val)}
                />
              </View>
            ))}
          </View>
        ))}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
          <ThemedText variant="caption" color="muted" style={{ fontVariant: ['tabular-nums'] }}>
            {`Đã làm ${answeredCount}/${totalItems}`}
          </ThemedText>
          <SaveStatus state={saveState} />
        </View>
        <FlaggedNav entries={flagged} onJump={jumpToItem} />

        <View style={{ gap: space[2] }}>
          {after != null ? (
            <>
              <Button label={`Sang ${stageName(after)}`} onPress={goNextStage} />
              <Button label="Nộp bài sớm" variant="secondary" onPress={confirmSubmit} disabled={answeredCount === 0} />
            </>
          ) : (
            <Button label="Nộp bài" onPress={confirmSubmit} disabled={answeredCount === 0} />
          )}
        </View>
      </Screen>
    </Screen>
  )
}

/** Lấy ScrollView của `Screen scroll` (qua context có sẵn của tour) để màn cuộn tới Teil / câu. */
function ScrollHostBridge({ target }: { target: { current: ScrollView | null } }) {
  const host = useSpotlightScrollHost()
  useEffect(() => {
    target.current = host?.current ?? null
  })
  return null
}
