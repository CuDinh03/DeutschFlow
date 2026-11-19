import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Linking, Pressable, ScrollView, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio'
import * as FileSystem from 'expo-file-system/legacy'
import * as Haptics from 'expo-haptics'
import { Check, RotateCcw, X, Volume2, VolumeX } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { ensureAiConsent } from '@/lib/aiConsent'
import { presentMinorAudioBlocked } from '@/lib/minorAudio'
import { PAYWALL_ENABLED } from '@/lib/paywall'
import { hasRenewingAiAllowance, usePlanStore } from '@/stores/usePlanStore'
import { radius, space, useTheme } from '@/lib/theme'
import {
  AppHeader, Button, Caption, Card, ErrorState, Icon, Pill, Screen, Skeleton, ThemedText } from '@/components/ui'
import { useRecorderBlurGuard } from '@/hooks/useRecorderBlurGuard'
import { useBlurGuard } from '@/hooks/useBlurGuard'
import {
  examSpeakingApi, type ExamSessionView, type TurnResponse,
} from '@/lib/examSpeakingApi'
import {
  drillSummary, formatClock, gradingFailedCopy, isRetryableTurnError, newClientTurnId, nextPrueferAnnouncement,
  providerName, remainingSec, stateLabel, type DrillTurnEval,
} from '@/lib/examSpeakingUi'
import {
  createSerialQueue, createSilenceDetector, findBlueprint, meterLevel, micStatus, oralSpeaker, roomNotes,
} from '@/lib/oralRoom'
import { readOralAutoStop, writeOralAutoStop } from '@/lib/oralAutoStop'
import { OralMicDock, OralPeople, OralStages, OralTaskCard } from '@/components/exam/OralRoomParts'
import { OralPrep, type NotesSaveState } from '@/components/exam/OralPrep'
import { isExamTtsMuted, setExamTtsMuted, speakExamSequence, stopExamTts } from '@/lib/examTts'
import { trackFeatureAction } from '@/lib/analytics'
import { examParentHref } from '@/lib/examSpeakingNav'
import { useHardwareBack } from '@/hooks/useHardwareBack'
import { TeilStrategyCard } from '@/components/exam/TeilStrategyCard'

const GRADING_POLL_MS = 3000
/** Ngừng gõ ghi chú chừng này thì tự lưu (mẫu v3.4 `oralprep`). */
const NOTES_SAVE_DEBOUNCE_MS = 1200
/** Ghi âm có đo mức âm để tự dừng khi im (Đợt 5 phần B). */
const ROOM_RECORDING_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true }

/** Một dòng hội thoại trong phòng thi (client giữ để render; server là nguồn sự thật). */
interface RoomLine {
  id: number
  role: 'CANDIDATE' | 'PRUEFER' | 'PARTNER'
  text: string
  /** Chấm nhanh của lượt DRILL (điểm 0–10, sửa lỗi, Redemittel) — web hiện từ Đợt 1, mobile trước đây bỏ. */
  eval?: DrillTurnEval | null
}

/** Lượt nói gửi thất bại mà server có thể đã xử lý: giữ file + khoá idempotency để gửi lại đúng lượt đó (F-06). */
interface PendingTurn {
  uri: string
  clientTurnId: string
}

/** Đồng hồ đếm ngược neo theo giờ SERVER (đồng hồ máy lệch không làm sai giờ thi). */
function useServerCountdown(deadlineAt: string | null, serverNow: string | undefined, onExpire?: () => void) {
  const [sec, setSec] = useState<number | null>(null)
  const anchorRef = useRef<{ deadlineAt: string; serverNow: string; clientAtFetch: number } | null>(null)
  const firedRef = useRef<string | null>(null)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    if (!deadlineAt || !serverNow) {
      anchorRef.current = null
      setSec(null)
      return
    }
    anchorRef.current = { deadlineAt, serverNow, clientAtFetch: Date.now() }
    const tick = () => {
      const a = anchorRef.current
      if (!a) return
      const left = remainingSec(a.deadlineAt, a.serverNow, a.clientAtFetch, Date.now())
      setSec(left)
      if (left === 0 && firedRef.current !== a.deadlineAt) {
        firedRef.current = a.deadlineAt
        onExpireRef.current?.()
      }
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [deadlineAt, serverNow])

  return sec
}

export default function SpeakingExamRoomScreen() {
  const theme = useTheme()
  const c = theme.colors
  const params = useLocalSearchParams<{ id: string }>()
  const sessionId = Number(params.id)

  const [session, setSession] = useState<ExamSessionView | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [lines, setLines] = useState<RoomLine[]>([])
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingTurn, setPendingTurn] = useState<PendingTurn | null>(null)
  const [muted, setMuted] = useState(isExamTtsMuted())
  const [notes, setNotes] = useState('')
  const [notesState, setNotesState] = useState<NotesSaveState>('idle')
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Lệnh đổi phiên (lưu ghi chú, chọn chủ đề, sang phần) chạy NỐI ĐUÔI nhau: backend lưu cả dòng phiên
  // (không khoá phiên bản), hai lệnh chồng nhau thì lệnh về sau ghi đè trạng thái lệnh kia vừa đổi.
  const sessionOpsRef = useRef(createSerialQueue())
  // Chặn gửi đôi một lượt khi tự dừng và bấm tay rơi vào cùng một khung hình.
  const stopRequestedRef = useRef(false)
  const notesSeededRef = useRef(false)
  // Vai AI đang phát tiếng (PRUEFER/PARTNER) — để hàng người sáng đúng người.
  const [aiSpeaker, setAiSpeaker] = useState<string | null>(null)
  const [autoStop, setAutoStop] = useState(true)
  const silenceRef = useRef<ReturnType<typeof createSilenceDetector> | null>(null)
  const scrollRef = useRef<ScrollView>(null)
  const lineSeq = useRef(0)
  // Lời PRUEFER cuối cùng ĐÃ vào transcript (trim) — bất kể tới từ aiTurns hay
  // từ directive echo. Là chốt chặn duy nhất cho lỗi lặp câu dẫn giám khảo:
  // directive.prueferText lặp nguyên văn qua các step (xem nextPrueferAnnouncement).
  const lastPrueferRef = useRef<string | null>(null)

  const recorder = useAudioRecorder(ROOM_RECORDING_OPTIONS)
  const recState = useAudioRecorderState(recorder, 100)
  useRecorderBlurGuard(recorder, () => setRecording(false))

  useEffect(() => {
    let alive = true
    void readOralAutoStop().then((on) => { if (alive) setAutoStop(on) })
    return () => { alive = false }
  }, [])

  /** Dừng giọng giám khảo/bạn thi và tắt đèn người đang nói. */
  const stopVoice = useCallback(() => {
    stopExamTts()
    setAiSpeaker(null)
  }, [])

  // Tabs không unmount khi rời màn: giọng giám khảo phải dừng theo BLUR (cleanup
  // unmount ở effect nạp phiên không chạy khi chỉ chuyển tab). Đồng hồ thi vẫn
  // chạy theo server — chỉ tắt tiếng, không tạm dừng bài thi hộ người dùng.
  const pendingResultsNav = useRef(false)
  const focusedRef = useBlurGuard(
    () => stopVoice(),
    () => {
      // Poll chấm xong trong lúc blur → đã hoãn điều hướng; giờ màn sáng lại mới đi.
      if (pendingResultsNav.current) {
        pendingResultsNav.current = false
        router.replace({ pathname: '/(student)/speaking-exam-result', params: { id: String(sessionId) } })
      }
    },
  )

  // Rời phòng thi = về hub Luyện thi Nói (màn cha) và tắt giọng giám khảo. Điều hướng tường minh:
  // GO_BACK của Tabs (student) (backBehavior=firstRoute) đẩy về Heute. Back cứng Android đi cùng đường.
  const leaveRoom = useCallback(() => {
    stopVoice()
    router.navigate(examParentHref('room'))
  }, [stopVoice])
  useHardwareBack(leaveRoom)

  const pushLine = useCallback((role: RoomLine['role'], text: string, evalJson?: DrillTurnEval | null) => {
    lineSeq.current += 1
    setLines((prev) => [...prev.slice(-11), { id: lineSeq.current, role, text, eval: evalJson ?? null }])
  }, [])

  /** Cập nhật snapshot + nói/ghi lời giám khảo khi sang Teil/câu dẫn mới. */
  const applySession = useCallback((data: ExamSessionView, speak: boolean) => {
    setSession(data)
    if (!notesSeededRef.current) {
      notesSeededRef.current = true
      setNotes(data.notesText ?? '')
    }
    if (data.state === 'RESULTS') {
      stopVoice()
      // Người dùng đang ở tab khác thì KHÔNG giật họ sang màn kết quả giữa
      // chừng — ghi nhớ, quay lại phòng thi mới điều hướng (onFocus ở trên).
      if (focusedRef.current) {
        router.replace({ pathname: '/(student)/speaking-exam-result', params: { id: String(data.id) } })
      } else {
        pendingResultsNav.current = true
      }
      return
    }
    if (data.state === 'IN_PART') {
      // Trước đây khoá theo `teil:stepIndex:text` → mỗi step mới trong CÙNG Teil
      // (partner vừa đáp xong) lại chèn nguyên câu dẫn Teil thêm một lần nữa.
      // Giờ so theo lời PRUEFER cuối đã hiển thị — echo lặp thì bỏ qua.
      const announce = nextPrueferAnnouncement(lastPrueferRef.current, data.directive?.prueferText)
      if (announce) {
        lastPrueferRef.current = announce
        pushLine('PRUEFER', announce)
        // Blur mà đồng hồ server hết hạn tự advance: dòng mới vẫn vào transcript
        // (đọc lại được), chỉ không phát tiếng khi màn không hiển thị.
        if (speak && focusedRef.current) void speakExamSequence([{ role: 'PRUEFER', text: announce }], setAiSpeaker)
      }
    }
  }, [pushLine, stopVoice])

  // Nạp phiên lần đầu. Màn nằm dưới Tabs nên KHÔNG unmount giữa hai bài thi —
  // mở phiên mới trên màn cũ phải xoá sạch dấu vết phiên trước (transcript,
  // chốt chặn lặp lời giám khảo, điều hướng đã hoãn), kẻo thiếu câu dẫn mở màn.
  useEffect(() => {
    let alive = true
    setSession(null)
    setLines([])
    setLoadError(false)
    setPendingTurn(null)
    setMuted(isExamTtsMuted()) // màn kiểm micro có thể đã bật lại tiếng giữa hai phiên
    setNotesState('idle')
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current)
    notesTimerRef.current = null
    lastPrueferRef.current = null
    pendingResultsNav.current = false
    notesSeededRef.current = false
    void (async () => {
      try {
        const data = await examSpeakingApi.getSession(sessionId)
        if (alive) applySession(data, true)
      } catch {
        if (alive) setLoadError(true)
      }
    })()
    return () => {
      alive = false
      stopVoice()
      if (notesTimerRef.current) clearTimeout(notesTimerRef.current)
      notesTimerRef.current = null
    }
  }, [sessionId, applySession, stopVoice])

  // GRADING: poll tới khi server đổi trạng thái (RESULTS → màn kết quả; FAILED → nút chấm lại).
  useEffect(() => {
    if (session?.state !== 'GRADING') return
    const t = setInterval(() => {
      void examSpeakingApi
        .getSession(sessionId)
        .then((data) => {
          if (data.state !== 'GRADING') applySession(data, false)
        })
        .catch(() => { /* poll — lỗi thoáng qua thì lượt sau thử tiếp */ })
    }, GRADING_POLL_MS)
    return () => clearInterval(t)
  }, [session?.state, sessionId, applySession])

  // Tên Teil, thời lượng, có bạn thi hay không — lấy từ blueprint (cùng khoá cache với sảnh).
  const blueprintsQ = useQuery({
    queryKey: ['exam-speaking-blueprints', session?.provider],
    queryFn: () => examSpeakingApi.listBlueprints({ provider: session?.provider }),
    enabled: !!session,
    staleTime: 60_000 * 30,
  })
  const blueprint = findBlueprint(blueprintsQ.data, session?.provider, session?.level)

  // Tự dừng khi im: đọc mức âm của chính bản ghi đang thu. Đã nói rồi im liền 2 giây → dừng và
  // gửi như bấm tay; chưa nói gì thì không cắt; máy không đo được mức âm thì không bao giờ cắt.
  useEffect(() => {
    if (!recording) {
      silenceRef.current = null
      return
    }
    if (!autoStop) return
    if (!silenceRef.current) silenceRef.current = createSilenceDetector()
    if (silenceRef.current.update(meterLevel(recState.metering), Date.now())) {
      silenceRef.current = null
      void stopAndSubmitTurn()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, autoStop, recState.metering, recState.durationMillis])

  function toggleAutoStop(on: boolean) {
    setAutoStop(on)
    silenceRef.current = null
    void writeOralAutoStop(on)
  }

  const prepSecLeft = useServerCountdown(
    session?.state === 'PREP' ? session.prepDeadlineAt : null,
    session?.serverNow,
    () => { void doAdvance() },
  )
  const partSecLeft = useServerCountdown(
    session?.state === 'IN_PART' ? session.partDeadlineAt : null,
    session?.serverNow,
    () => { void doAdvance() },
  )

  /** Xếp một lệnh đổi phiên sau các lệnh đang chạy (lỗi của lệnh trước không chặn lệnh sau). */
  function queueSessionOp<T>(op: () => Promise<T>): Promise<T> {
    return sessionOpsRef.current.run(op)
  }

  async function doAdvance() {
    if (busy || uploading || recording) return
    setBusy(true)
    stopVoice()
    try {
      // Ghi chú đang chờ tự lưu: lưu ngay trước khi rời phòng chuẩn bị, kẻo mất mấy chữ cuối.
      // Lỗi thì thử lại một lần; vẫn lỗi thì phòng thi hiện bản trên máy (xem OralTaskCard).
      if (notesTimerRef.current) {
        clearTimeout(notesTimerRef.current)
        notesTimerRef.current = null
        if (!(await persistNotes(notes))) await persistNotes(notes)
      }
      applySession(await queueSessionOp(() => examSpeakingApi.advance(sessionId)), true)
    } catch (e) {
      Alert.alert('Lỗi', apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  /** Lưu ghi chú; chỉ cập nhật `notesText` của snapshot (không đè trạng thái phiên bằng bản cũ hơn). */
  async function persistNotes(text: string): Promise<boolean> {
    setNotesState('saving')
    try {
      const v = await queueSessionOp(() => examSpeakingApi.saveNotes(sessionId, text.trim()))
      setSession((prev) => (prev && prev.id === v.id ? { ...prev, notesText: v.notesText } : prev))
      setNotesState('saved')
      return true
    } catch {
      setNotesState('error')
      return false
    }
  }

  function changeNotes(text: string) {
    setNotes(text)
    setNotesState('idle')
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current)
    notesTimerRef.current = setTimeout(() => {
      notesTimerRef.current = null
      void persistNotes(text)
    }, NOTES_SAVE_DEBOUNCE_MS)
  }

  function toggleMute() {
    const next = !muted
    setExamTtsMuted(next)
    if (next) stopVoice() // chuỗi đang đọc bị cắt không tự báo xong — tắt đèn người đang nói tại đây
    setMuted(next)
  }

  async function finishNow() {
    if (busy || uploading) return
    setBusy(true)
    stopVoice()
    try {
      trackFeatureAction('exam_speaking', 'completed', { level: session?.level ?? '?' })
      applySession(await examSpeakingApi.finish(sessionId), false)
    } catch (e) {
      Alert.alert('Lỗi', apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  function confirmFinish() {
    if (busy || uploading || recording) return
    Alert.alert(
      'Kết thúc phần nói?',
      `Bài được chấm theo bộ tiêu chí ${providerName(session?.provider ?? 'TELC')}, theo những gì bạn đã nói. Kết thúc rồi thì không vào lại phòng thi này được.`,
      [
        { text: 'Thi tiếp', style: 'cancel' },
        { text: 'Kết thúc và chấm', style: 'destructive', onPress: () => { void finishNow() } },
      ],
    )
  }

  /** Sang Teil kế (thi thử) hoặc kết thúc phần luyện (một Teil) — không quay lại được. */
  function confirmAdvance() {
    if (busy || uploading || recording || !session) return
    const drill = session.mode === 'DRILL'
    const next = session.currentPart + 1
    Alert.alert(
      drill ? 'Kết thúc phần luyện?' : `Sang Teil ${next}?`,
      drill ? 'Bạn sẽ thấy điểm chấm nhanh của các lượt vừa nói.' : `Không quay lại Teil ${session.currentPart} được nữa.`,
      [
        { text: 'Ở lại', style: 'cancel' },
        { text: drill ? 'Kết thúc' : `Sang Teil ${next}`, onPress: () => { void doAdvance() } },
      ],
    )
  }

  /** Nút X: rời phòng (đồng hồ server vẫn chạy) hoặc kết thúc ngay. */
  function confirmLeave() {
    if (!session) return leaveRoom()
    if (session.state === 'PREP') {
      Alert.alert('Rời phòng chuẩn bị?', 'Đồng hồ chuẩn bị vẫn chạy. Hết giờ thì bài thi tự bắt đầu.', [
        { text: 'Ở lại', style: 'cancel' },
        { text: 'Rời phòng', onPress: leaveRoom },
      ])
      return
    }
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
      { text: 'Thi tiếp', style: 'cancel' },
      { text: 'Rời phòng', onPress: leaveRoom },
    ]
    if (session.mode === 'MOCK' && !busy && !uploading && !recording) {
      buttons.push({ text: 'Kết thúc và chấm', style: 'destructive', onPress: () => { void finishNow() } })
    }
    Alert.alert('Rời phòng thi?', 'Đồng hồ thi vẫn chạy khi bạn rời phòng.', buttons)
  }

  async function doRegrade() {
    setBusy(true)
    try {
      applySession(await examSpeakingApi.regrade(sessionId), false)
    } catch (e) {
      Alert.alert('Lỗi', apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function chooseTopic(teilNo: number, index: number) {
    if (busy) return
    setBusy(true)
    try {
      const v = await queueSessionOp(() => examSpeakingApi.choose(sessionId, teilNo, index))
      // Giữ ghi chú vừa lưu xong trong lúc chờ (bản `choose` có thể đọc trước lượt lưu đó).
      setSession((prev) => ({ ...v, notesText: prev?.id === v.id ? prev.notesText ?? v.notesText : v.notesText }))
      void Haptics.selectionAsync()
    } catch (e) {
      Alert.alert('Lỗi', apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function startRecording() {
    if (recording || uploading || busy) return
    // 5.1.1(i): bản ghi được server phiên âm + chấm bởi AI bên thứ ba — consent trước.
    if (!(await ensureAiConsent())) return
    try {
      const { status, canAskAgain } = await AudioModule.requestRecordingPermissionsAsync()
      if (status !== 'granted') {
        if (!canAskAgain) {
          Alert.alert('Cần quyền microphone', 'Hãy bật microphone trong Cài đặt để thi nói.', [
            { text: 'Để sau', style: 'cancel' },
            { text: 'Mở Cài đặt', onPress: () => { void Linking.openSettings() } },
          ])
        } else {
          Alert.alert('Không có quyền microphone', 'Bạn cần cấp quyền để thi nói.')
        }
        return
      }
      stopVoice() // giọng giám khảo không được lọt vào bản ghi
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()
      recorder.record()
      stopRequestedRef.current = false
      setRecording(true)
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    } catch {
      Alert.alert('Lỗi', 'Không thể khởi động microphone. Vui lòng kiểm tra quyền truy cập.')
    }
  }

  async function stopAndSubmitTurn() {
    if (!recording || stopRequestedRef.current) return
    stopRequestedRef.current = true
    setRecording(false)
    setUploading(true)
    try {
      await recorder.stop()
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true })
      const uri = recorder.uri
      if (!uri) throw new Error('no_uri')
      await submitTurnFile({ uri, clientTurnId: newClientTurnId() })
    } catch (e) {
      // 403 MINOR_AUDIO_BLOCKED (D8): sheet giải thích + lối liên hệ trung tâm — không phải lỗi lượt,
      // gửi lại không mở được (submitTurnFile đã xoá file vì 403 không retryable).
      if (presentMinorAudioBlocked(e)) return
      Alert.alert('Lỗi lượt nói', apiMessage(e))
    } finally {
      setUploading(false)
    }
  }

  /** "Gửi lại" đúng lượt vừa thất bại — cùng clientTurnId nên backend không bao giờ tính thành lượt thứ hai. */
  async function retryPendingTurn() {
    const p = pendingTurn
    if (!p || uploading || busy) return
    setUploading(true)
    try {
      await submitTurnFile(p)
    } finally {
      setUploading(false)
    }
  }

  function discardPendingTurn() {
    const p = pendingTurn
    setPendingTurn(null)
    if (p) void FileSystem.deleteAsync(p.uri, { idempotent: true }).catch(() => {})
  }

  async function submitTurnFile(p: PendingTurn) {
    let turn: TurnResponse
    try {
      turn = await examSpeakingApi.audioTurn(sessionId, p.uri, p.clientTurnId)
    } catch (e) {
      if (isRetryableTurnError(e)) {
        // Timeout/rớt mạng/5xx/"đang xử lý": server có thể đã xử lý xong — GIỮ file + khoá để gửi lại,
        // không xoá (trước đây xoá vô điều kiện → phải thu lại = lượt mới, trừ quota đôi).
        setPendingTurn(p)
        Alert.alert('Chưa gửi được lượt nói', `${apiMessage(e)}\n\nBản ghi vẫn còn trên máy — gửi lại sẽ không bị tính thành lượt mới.`, [
          { text: 'Bỏ lượt này', style: 'destructive', onPress: () => discardPendingTurn() },
          { text: 'Gửi lại', onPress: () => { void retryPendingTurn() } },
        ])
        return
      }
      void FileSystem.deleteAsync(p.uri, { idempotent: true }).catch(() => {})
      throw e
    }
    // Server đã nhận audio — file tạm hết việc (F-17).
    setPendingTurn(null)
    void FileSystem.deleteAsync(p.uri, { idempotent: true }).catch(() => {})
    try {
      if (turn.transcript?.trim()) pushLine('CANDIDATE', turn.transcript.trim(), turn.turnEval as DrillTurnEval | null)
      const aiTurns = (turn.aiTurns ?? []).filter((t) => t.text?.trim())
      for (const t of aiTurns) {
        const role = t.role === 'PARTNER' ? 'PARTNER' : 'PRUEFER'
        // Ghi nhận lời PRUEFER mới NGAY tại đây — directive của snapshot kế tiếp
        // sẽ echo đúng câu này, applySession phải biết nó đã hiển thị rồi.
        if (role === 'PRUEFER') lastPrueferRef.current = t.text.trim()
        pushLine(role, t.text)
      }
      // Snapshot mới TRƯỚC rồi mới đọc thoại — lastPrueferRef chặn chèn trùng câu dẫn.
      applySession(turn.session, false)
      // Phản hồi về muộn sau khi người dùng đã rời màn (back/chuyển tab giữa lúc
      // đang gửi): KHÔNG bắt đầu phát tiếng — stopExamTts lúc blur chỉ dừng được
      // thứ ĐANG kêu, không chặn được chuỗi mới khởi phát sau đó.
      if (aiTurns.length > 0 && focusedRef.current) void speakExamSequence(aiTurns, setAiSpeaker)
    } catch (e) {
      Alert.alert('Lỗi lượt nói', apiMessage(e))
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <Screen edges={['top']}>
        <AppHeader title="Phòng thi" onBack={leaveRoom} />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ErrorState onRetry={() => { setLoadError(false); void examSpeakingApi.getSession(sessionId).then((d) => applySession(d, true)).catch(() => setLoadError(true)) }} />
        </View>
      </Screen>
    )
  }

  if (!session) {
    return (
      <Screen edges={['top']}>
        <AppHeader title="Phòng thi" onBack={leaveRoom} />
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <Skeleton height={90} radius="2xl" />
          <Skeleton height={240} radius="2xl" />
        </View>
      </Screen>
    )
  }

  const d = session.directive
  const inPart = session.state === 'IN_PART'
  const live = inPart || session.state === 'PREP'
  const currentBpPart = blueprint?.parts.find((p) => p.teilNo === session.currentPart)
  const hasPartner = currentBpPart?.hasPartner ?? lines.some((l) => l.role === 'PARTNER')
  const isLastPart = session.currentPart >= session.totalParts
  const clock = session.state === 'PREP' ? prepSecLeft : partSecLeft
  const prepParts = session.mode === 'MOCK' ? blueprint?.parts ?? [] : []

  return (
    <Screen edges={['top']}>
      {live ? (
        // Đầu phòng thi theo mẫu v3.4: X · tên Teil (hoặc "Chuẩn bị") · đồng hồ · tắt tiếng.
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[3] }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={session.state === 'PREP' ? 'Rời phòng chuẩn bị' : 'Rời phòng hoặc kết thúc phần nói'}
            onPress={confirmLeave}
            hitSlop={8}
            style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon icon={X} size={20} color="primary" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <ThemedText variant="label" numberOfLines={1}>
              {inPart && d ? `Teil ${d.teilNo} · ${d.title}` : 'Chuẩn bị'}
            </ThemedText>
            <ThemedText variant="caption" color="muted" numberOfLines={1}>
              {inPart && d
                ? `Bước ${d.stepIndex + 1}/${d.stepCount}`
                : `${session.mode === 'MOCK' ? 'Thi thử' : 'Luyện'} phần nói · ${providerName(session.provider)} ${session.level}`}
            </ThemedText>
          </View>
          {clock != null && (
            <Pill label={formatClock(clock)} tone={inPart && clock <= 20 ? 'danger' : 'neutral'} />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={muted ? 'Bật tiếng giám khảo' : 'Tắt tiếng giám khảo'}
            accessibilityState={{ selected: muted }}
            onPress={toggleMute}
            hitSlop={8}
          >
            <Icon icon={muted ? VolumeX : Volume2} size={20} color="secondary" />
          </Pressable>
        </View>
      ) : (
        <AppHeader
          title={stateLabel(session.state)}
          subtitle={`Sprechen ${session.level} · ${session.mode === 'MOCK' ? 'thi thử' : 'luyện Teil'}`}
          onBack={leaveRoom}
        />
      )}

      {/* retainAudio: phiên hiệu chuẩn — bắt buộc nói rõ (hợp đồng ExamSessionView) */}
      {session.retainAudio && (
        <View style={{ marginHorizontal: space[5], marginBottom: space[3], backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: space[3] }}>
          <ThemedText variant="caption" color="secondary">
            Phiên này có lưu bản ghi âm để hiệu chuẩn chấm điểm (bạn đã đồng ý chia sẻ dữ liệu AI).
          </ThemedText>
        </View>
      )}

      {/* ── PREP ── */}
      {session.state === 'PREP' && (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], paddingTop: space[2] }}>
          <OralPrep
            session={session}
            parts={prepParts}
            notes={notes}
            onChangeNotes={changeNotes}
            notesState={notesState}
            busy={busy}
            onChoose={(teilNo, idx) => { void chooseTopic(teilNo, idx) }}
            onEnter={() => { void doAdvance() }}
          />
        </Screen>
      )}

      {/* ── IN_PART ── */}
      {inPart && (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: space[5], gap: space[3], paddingBottom: space[3] }}>
            {session.mode === 'MOCK' && <OralStages totalParts={session.totalParts} currentPart={session.currentPart} />}
            <OralPeople speaker={oralSpeaker(aiSpeaker, recording)} hasPartner={hasPartner} />
          </View>
          <ScrollView
            ref={scrollRef}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: space[4], gap: space[3] }}
            keyboardShouldPersistTaps="handled"
          >
            {d ? <OralTaskCard directive={d} notesText={roomNotes(session.notesText, notes, notesState === 'error')} /> : null}
            {d ? <TeilStrategyCard provider={session.provider} level={session.level} section="SPRECHEN" teil={d.teilNo} /> : null}

            {lines.map((l) => (
              <View
                key={l.id}
                style={{
                  maxWidth: 300,
                  alignSelf: l.role === 'CANDIDATE' ? 'flex-end' : 'flex-start',
                  backgroundColor: l.role === 'CANDIDATE' ? c.inkSurface : c.surface,
                  borderWidth: l.role === 'CANDIDATE' ? 0 : 1,
                  borderColor: c.border,
                  borderRadius: radius['2xl'],
                  padding: space[3],
                  gap: 2,
                }}
              >
                <Caption color={l.role === 'CANDIDATE' ? c.onInkMuted : c.textSecondary}>
                  {l.role === 'CANDIDATE' ? 'Bạn' : l.role === 'PARTNER' ? 'Bạn thi' : 'Giám khảo'}
                </Caption>
                <ThemedText variant="body" style={l.role === 'CANDIDATE' ? { color: c.onInk } : undefined}>
                  {l.text}
                </ThemedText>
                {l.eval ? <DrillEvalBlock ev={l.eval} /> : null}
              </View>
            ))}

            {pendingTurn && !uploading && (
              <Card style={{ gap: space[2], borderColor: c.danger }}>
                <ThemedText variant="bodyStrong">Lượt vừa rồi chưa gửi được</ThemedText>
                <ThemedText variant="caption" color="secondary">Bản ghi vẫn còn trên máy — gửi lại sẽ không bị tính thành lượt mới.</ThemedText>
                <View style={{ flexDirection: 'row', gap: space[2] }}>
                  <Button label="Gửi lại" size="sm" onPress={() => void retryPendingTurn()} />
                  <Button label="Bỏ lượt này" size="sm" variant="ghost" onPress={discardPendingTurn} />
                </View>
              </Card>
            )}
          </ScrollView>

          <OralMicDock
            status={micStatus({ recording, uploading, aiSpeaking: aiSpeaker, busy })}
            recording={recording}
            disabled={uploading || busy}
            onMic={() => void (recording ? stopAndSubmitTurn() : startRecording())}
            autoStop={autoStop}
            onAutoStop={toggleAutoStop}
            actionLabel={session.mode === 'DRILL' ? 'Kết thúc luyện' : isLastPart ? 'Kết thúc và chấm' : `Sang Teil ${session.currentPart + 1}`}
            actionPrimary={session.mode === 'MOCK' && isLastPart}
            actionDisabled={busy || uploading || recording}
            onAction={session.mode === 'MOCK' && isLastPart ? confirmFinish : confirmAdvance}
          />
        </View>
      )}

      {/* ── DONE: chỉ xảy ra với DRILL (mock đi thẳng GRADING) → tổng kết luyện, parity web DrillSummary.
             Trước đây màn này mời "Chấm bài" và gọi finish trên phiên đã đóng — nút không làm gì. ── */}
      {session.state === 'DONE' && (() => {
        const summary = drillSummary(lines.filter((l) => l.role === 'CANDIDATE').map((l) => l.eval))
        return (
          <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[4], paddingTop: space[2] }}>
            <Card style={{ alignItems: 'center', gap: space[3], paddingVertical: space[6] }}>
              <Icon icon={Check} size={28} color="success" />
              <ThemedText variant="title">Xong phần luyện</ThemedText>
              <ThemedText variant="displayLg">{summary.avgScore != null ? `${summary.avgScore}/10` : '—'}</ThemedText>
              <ThemedText variant="caption" color="secondary" align="center">
                {summary.turns > 0
                  ? `Điểm chấm nhanh trung bình của ${summary.turns} lượt nói (0–10, không phải điểm thi).`
                  : 'Chưa có lượt nào được chấm nhanh — hãy nói thêm ở lần luyện sau.'}
              </ThemedText>
            </Card>
            {summary.corrections.length > 0 && (
              <View style={{ gap: space[2] }}>
                <Caption>{`Lỗi cần xem lại · ${summary.corrections.length}`}</Caption>
                <Card padded={false}>
                  {summary.corrections.slice(0, 12).map((cx, i) => (
                    <View key={`${cx.code}-${i}`} style={{ paddingHorizontal: space[4], paddingVertical: space[3], borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.border, gap: 2 }}>
                      <ThemedText variant="body">
                        <ThemedText variant="body" style={{ textDecorationLine: 'line-through' }} color="muted">{cx.original}</ThemedText>
                        {'  →  '}
                        <ThemedText variant="bodyStrong">{cx.correction}</ThemedText>
                      </ThemedText>
                    </View>
                  ))}
                </Card>
              </View>
            )}
            <View style={{ gap: space[2] }}>
              <Button label="Luyện lại Teil này" onPress={leaveRoom} />
              <Button label="Ôn yếu điểm + Redemittel" variant="ghost" onPress={() => router.push('/(student)/speaking-exam-weakness')} />
            </View>
            <ThemedText variant="caption" color="faint">
              Chấm nhanh chỉ để luyện; điểm thi thử theo bộ tiêu chí của hệ chỉ có ở chế độ thi thử trọn gói.
            </ThemedText>
          </Screen>
        )
      })()}

      {/* ── GRADING ── */}
      {session.state === 'GRADING' && (
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space[5] }}>
          <Card style={{ alignItems: 'center', gap: space[3], paddingVertical: space[7] }}>
            <ThemedText variant="title">Đang chấm bài…</ThemedText>
            <ThemedText variant="caption" color="secondary" align="center">
              Thường mất dưới một phút. Màn hình tự cập nhật khi có kết quả.
            </ThemedText>
          </Card>
        </View>
      )}

      {/* ── GRADING_FAILED — F-08: hết quota ≠ job chết ── */}
      {session.state === 'GRADING_FAILED' && (() => {
        // M-8 + 10/11/2026: gói còn hạn (dùng thử / trả tiền) → "mai có lượt mới", không mời nạp thêm.
        const copy = gradingFailedCopy(session.gradingError, hasRenewingAiAllowance(usePlanStore.getState().plan))
        return (
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space[5] }}>
            <Card style={{ gap: space[3], borderColor: c.danger }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <Icon icon={X} size={20} color="danger" />
                <ThemedText variant="title">{copy.title}</ThemedText>
              </View>
              <ThemedText variant="caption" color="secondary">{copy.message}</ThemedText>
              {copy.topUp && PAYWALL_ENABLED && (
                <Button label="Xem gói / nạp thêm" variant="secondary" onPress={() => router.push('/(student)/upgrade')} />
              )}
              <Button label="Chấm lại" onPress={() => void doRegrade()} loading={busy} />
            </Card>
          </View>
        )
      })()}

      {/* ── ABORTED ── */}
      {session.state === 'ABORTED' && (
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space[5] }}>
          <Card style={{ alignItems: 'center', gap: space[3], paddingVertical: space[6] }}>
            <Icon icon={RotateCcw} size={22} color="secondary" />
            <ThemedText variant="title">Phiên đã kết thúc</ThemedText>
            <Button label="Về Luyện thi Nói" variant="ghost" onPress={leaveRoom} />
          </Card>
        </View>
      )}
    </Screen>
  )
}

/** Chấm nhanh một lượt DRILL dưới bong bóng thí sinh (parity web `drill-eval`): điểm, nhận xét, sửa lỗi, Redemittel. */
function DrillEvalBlock({ ev }: { ev: DrillTurnEval }) {
  const theme = useTheme()
  const c = theme.colors
  if (ev.error) {
    return <ThemedText variant="caption" style={{ color: c.onInkMuted }}>{ev.error}</ThemedText>
  }
  return (
    <View style={{ gap: 4, marginTop: 4 }}>
      {typeof ev.score === 'number' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Pill label={`${ev.score}/10`} tone={ev.score >= 8 ? 'success' : ev.score >= 5 ? 'accent' : 'danger'} solid />
          {ev.feedbackVi ? (
            <ThemedText variant="caption" style={{ color: c.onInkMuted, flex: 1 }}>{ev.feedbackVi}</ThemedText>
          ) : null}
        </View>
      )}
      {(ev.corrections ?? []).slice(0, 3).map((cx, i) => (
        <ThemedText key={i} variant="caption" style={{ color: c.onInk }}>
          <ThemedText variant="caption" style={{ color: c.onInkMuted, textDecorationLine: 'line-through' }}>{cx.original}</ThemedText>
          {'  →  '}
          <ThemedText variant="caption" style={{ color: c.onInk, fontWeight: '700' }}>{cx.correction}</ThemedText>
        </ThemedText>
      ))}
      {(ev.redemittel ?? []).length > 0 && (
        <ThemedText variant="caption" style={{ color: c.onInkMuted }}>{`Gợi ý cách nói: ${(ev.redemittel ?? []).slice(0, 2).join(' · ')}`}</ThemedText>
      )}
    </View>
  )
}
