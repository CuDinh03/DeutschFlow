import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Linking, Pressable, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio'
import * as FileSystem from 'expo-file-system/legacy'
import * as Haptics from 'expo-haptics'
import { Check, Flag, Mic, Square, RotateCcw, ChevronRight, X, Volume2, VolumeX } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { ensureAiConsent } from '@/lib/aiConsent'
import { PAYWALL_ENABLED } from '@/lib/paywall'
import { radius, space, useTheme } from '@/lib/theme'
import {
  AppHeader, Button, Caption, Card, ErrorState, Icon, Pill, Screen, Skeleton, TextField, ThemedText, YellowSquare,
} from '@/components/ui'
import { useRecorderBlurGuard } from '@/hooks/useRecorderBlurGuard'
import { useBlurGuard } from '@/hooks/useBlurGuard'
import {
  examSpeakingApi, type ExamSessionView, type TurnResponse,
} from '@/lib/examSpeakingApi'
import {
  drillSummary, formatClock, gradingFailedCopy, isRetryableTurnError, newClientTurnId, nextPrueferAnnouncement,
  providerName, remainingSec, stateLabel, stimulusDisplay, type DrillTurnEval,
} from '@/lib/examSpeakingUi'
import { isExamTtsMuted, setExamTtsMuted, speakExamSequence, stopExamTts } from '@/lib/examTts'
import { trackFeatureAction } from '@/lib/analytics'
import { examParentHref } from '@/lib/examSpeakingNav'
import { useHardwareBack } from '@/hooks/useHardwareBack'

const GRADING_POLL_MS = 3000

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
  const [savingNotes, setSavingNotes] = useState(false)
  const notesSeededRef = useRef(false)
  const lineSeq = useRef(0)
  // Lời PRUEFER cuối cùng ĐÃ vào transcript (trim) — bất kể tới từ aiTurns hay
  // từ directive echo. Là chốt chặn duy nhất cho lỗi lặp câu dẫn giám khảo:
  // directive.prueferText lặp nguyên văn qua các step (xem nextPrueferAnnouncement).
  const lastPrueferRef = useRef<string | null>(null)

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  useRecorderBlurGuard(recorder, () => setRecording(false))

  // Tabs không unmount khi rời màn: giọng giám khảo phải dừng theo BLUR (cleanup
  // unmount ở effect nạp phiên không chạy khi chỉ chuyển tab). Đồng hồ thi vẫn
  // chạy theo server — chỉ tắt tiếng, không tạm dừng bài thi hộ người dùng.
  const pendingResultsNav = useRef(false)
  const focusedRef = useBlurGuard(
    () => stopExamTts(),
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
    stopExamTts()
    router.navigate(examParentHref('room'))
  }, [])
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
      stopExamTts()
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
        if (speak && focusedRef.current) void speakExamSequence([{ role: 'PRUEFER', text: announce }])
      }
    }
  }, [pushLine])

  // Nạp phiên lần đầu. Màn nằm dưới Tabs nên KHÔNG unmount giữa hai bài thi —
  // mở phiên mới trên màn cũ phải xoá sạch dấu vết phiên trước (transcript,
  // chốt chặn lặp lời giám khảo, điều hướng đã hoãn), kẻo thiếu câu dẫn mở màn.
  useEffect(() => {
    let alive = true
    setSession(null)
    setLines([])
    setLoadError(false)
    setPendingTurn(null)
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
      stopExamTts()
    }
  }, [sessionId, applySession])

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

  async function doAdvance() {
    if (busy || uploading || recording) return
    setBusy(true)
    stopExamTts()
    try {
      applySession(await examSpeakingApi.advance(sessionId), true)
    } catch (e) {
      Alert.alert('Lỗi', apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveNotes() {
    setSavingNotes(true)
    try {
      setSession(await examSpeakingApi.saveNotes(sessionId, notes.trim()))
    } catch (e) {
      Alert.alert('Lỗi', apiMessage(e))
    } finally {
      setSavingNotes(false)
    }
  }

  function toggleMute() {
    const next = !muted
    setExamTtsMuted(next)
    setMuted(next)
  }

  async function doFinish() {
    if (busy || uploading) return
    Alert.alert('Kết thúc bài thi?', `Bài của bạn sẽ được chấm theo bộ tiêu chí ${providerName(session?.provider ?? 'GOETHE')}. Không quay lại nói tiếp được.`, [
      { text: 'Ở lại', style: 'cancel' },
      {
        text: 'Kết thúc & chấm',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true)
            stopExamTts()
            try {
              trackFeatureAction('exam_speaking', 'completed', { level: session?.level ?? '?' })
              applySession(await examSpeakingApi.finish(sessionId), false)
            } catch (e) {
              Alert.alert('Lỗi', apiMessage(e))
            } finally {
              setBusy(false)
            }
          })()
        },
      },
    ])
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
      setSession(await examSpeakingApi.choose(sessionId, teilNo, index))
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
      stopExamTts() // giọng giám khảo không được lọt vào bản ghi
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()
      recorder.record()
      setRecording(true)
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    } catch {
      Alert.alert('Lỗi', 'Không thể khởi động microphone. Vui lòng kiểm tra quyền truy cập.')
    }
  }

  async function stopAndSubmitTurn() {
    if (!recording) return
    setRecording(false)
    setUploading(true)
    try {
      await recorder.stop()
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true })
      const uri = recorder.uri
      if (!uri) throw new Error('no_uri')
      await submitTurnFile({ uri, clientTurnId: newClientTurnId() })
    } catch (e) {
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
      if (aiTurns.length > 0 && focusedRef.current) void speakExamSequence(aiTurns)
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

  return (
    <Screen edges={['top']}>
      <AppHeader
        title={inPart && d ? `Teil ${d.teilNo} · ${d.title}` : stateLabel(session.state)}
        subtitle={`Sprechen ${session.level} · ${session.mode === 'MOCK' ? 'thi thử' : 'luyện Teil'}`}
        onBack={leaveRoom}
        right={
          inPart || session.state === 'BETWEEN' || session.state === 'PREP' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={muted ? 'Bật tiếng giám khảo' : 'Tắt tiếng giám khảo'}
                accessibilityState={{ selected: muted }}
                onPress={toggleMute}
                hitSlop={8}
              >
                <Icon icon={muted ? VolumeX : Volume2} size={20} color="secondary" />
              </Pressable>
              {session.state !== 'PREP' && (
                <Pressable accessibilityRole="button" accessibilityLabel="Kết thúc và chấm bài" onPress={() => void doFinish()} hitSlop={8}>
                  <Icon icon={Flag} size={20} color="secondary" />
                </Pressable>
              )}
            </View>
          ) : undefined
        }
      />

      {/* Tiến độ theo Teil */}
      <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: space[5], paddingBottom: space[3] }}>
        {Array.from({ length: Math.max(1, session.totalParts) }, (_, i) => {
          const teil = i + 1
          const done = teil < session.currentPart
          const current = teil === session.currentPart
          return (
            <View
              key={teil}
              style={{
                flex: 1, height: 4, borderRadius: radius.full,
                backgroundColor: done ? c.inkSurface : current ? c.accent : c.border,
              }}
            />
          )
        })}
      </View>

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
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[4] }}>
          <Card style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface, gap: space[2] }}>
            <Caption color={c.onInkMuted}>Thời gian chuẩn bị</Caption>
            <ThemedText variant="displayLg" style={{ color: c.onInk }}>
              {prepSecLeft != null ? formatClock(prepSecLeft) : '—'}
            </ThemedText>
            <ThemedText variant="caption" style={{ color: c.onInkMuted }}>
              Đọc đề, gạch ý. Hết giờ sẽ tự vào thi — hoặc vào sớm khi bạn sẵn sàng.
            </ThemedText>
          </Card>

          {(session.prepMaterials ?? []).map((m) => (
            <View key={m.teilNo} style={{ gap: space[2] }}>
              <Caption>{`Teil ${m.teilNo} · ${m.title}`}</Caption>
              <Card style={{ gap: space[3] }}>
                {m.choiceRequired && (
                  <ThemedText variant="caption" color="secondary">Chọn 1 chủ đề cho phần này:</ThemedText>
                )}
                <View style={{ gap: space[2] }}>
                  {m.stimuli.map((s, idx) => {
                    const disp = stimulusDisplay(s)
                    const chosen = m.chosenIndex === idx
                    const body = (
                      <View style={{ gap: space[1] }}>
                        {disp.headline ? (
                          <ThemedText variant={m.choiceRequired ? 'bodyStrong' : 'title'}>{disp.headline}</ThemedText>
                        ) : null}
                        {disp.lines.slice(0, 3).map((ln, li) => (
                          <ThemedText key={`l${li}`} variant="caption" color="secondary">{ln}</ThemedText>
                        ))}
                        {disp.bullets.slice(0, 6).map((b, bi) => (
                          <View key={bi} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                            <YellowSquare size={5} />
                            <ThemedText variant="caption" color="secondary" style={{ flex: 1 }}>{b}</ThemedText>
                          </View>
                        ))}
                      </View>
                    )
                    if (!m.choiceRequired) return <View key={idx}>{body}</View>
                    return (
                      <Pressable
                        key={idx}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: chosen }}
                        accessibilityLabel={disp.headline ?? `Chủ đề ${idx + 1}`}
                        onPress={() => void chooseTopic(m.teilNo, idx)}
                        style={{
                          borderWidth: chosen ? 2 : 1,
                          borderColor: chosen ? c.accent : c.border,
                          backgroundColor: chosen ? c.accentSoft : c.surface,
                          borderRadius: radius.md,
                          padding: space[3],
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: space[3],
                        }}
                      >
                        <View style={{ flex: 1 }}>{body}</View>
                        {chosen ? <Icon icon={Check} size={18} color="accent" /> : null}
                      </Pressable>
                    )
                  })}
                </View>
              </Card>
            </View>
          ))}

          {/* Konzeptpapier — parity web: ghi chú lúc chuẩn bị, dùng lại trong lúc thi */}
          <View style={{ gap: space[2] }}>
            <Caption>Ghi chú của bạn (Konzeptpapier)</Caption>
            <Card style={{ gap: space[3] }}>
              <TextField
                value={notes}
                onChangeText={setNotes}
                placeholder="Gạch ý cho bài nói…"
                multiline
              />
              <Button label={savingNotes ? 'Đang lưu…' : 'Lưu ghi chú'} variant="ghost" size="sm" onPress={() => void saveNotes()} loading={savingNotes} />
            </Card>
          </View>

          <Button
            label={busy ? 'Đang vào…' : 'Vào thi ngay'}
            onPress={() => void doAdvance()}
            loading={busy}
            disabled={(session.prepMaterials ?? []).some((m) => m.choiceRequired && m.chosenIndex == null)}
          />
        </Screen>
      )}

      {/* ── IN_PART / BETWEEN ── */}
      {(inPart || session.state === 'BETWEEN') && (
        <View style={{ flex: 1 }}>
          <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[4], gap: space[3] }}>
            {inPart && d && (
              <Card style={{ gap: space[2] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                  <YellowSquare />
                  <Caption style={{ flex: 1 }}>{`Bước ${d.stepIndex + 1}/${d.stepCount}`}</Caption>
                  {partSecLeft != null && (
                    <Pill label={formatClock(partSecLeft)} tone={partSecLeft <= 20 ? 'danger' : 'neutral'} />
                  )}
                </View>
                {(() => {
                  const disp = stimulusDisplay(d.stimulus)
                  return (
                    <View style={{ gap: space[1] }}>
                      {disp.headline ? <ThemedText variant="title">{disp.headline}</ThemedText> : null}
                      {disp.lines.slice(0, 3).map((ln, li) => (
                        <ThemedText key={`l${li}`} variant="body" color="secondary">{ln}</ThemedText>
                      ))}
                      {disp.bullets.slice(0, 8).map((b, bi) => (
                        <View key={bi} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                          <YellowSquare size={5} />
                          <ThemedText variant="caption" color="secondary" style={{ flex: 1 }}>{b}</ThemedText>
                        </View>
                      ))}
                    </View>
                  )
                })()}
                {d.hintVi ? (
                  <ThemedText variant="caption" color="muted">{d.hintVi}</ThemedText>
                ) : null}
                {session.notesText ? (
                  <View style={{ backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: space[2] + 2, gap: 2 }}>
                    <Caption>Ghi chú của bạn</Caption>
                    <ThemedText variant="caption" color="secondary">{session.notesText}</ThemedText>
                  </View>
                ) : null}
              </Card>
            )}

            {session.state === 'BETWEEN' && (
              <Card style={{ alignItems: 'center', gap: space[3], paddingVertical: space[6] }}>
                <ThemedText variant="title">Xong phần này</ThemedText>
                <ThemedText variant="caption" color="secondary">Thở một nhịp rồi vào phần tiếp theo nhé.</ThemedText>
                <Button label="Bắt đầu Teil tiếp theo" onPress={() => void doAdvance()} loading={busy} />
              </Card>
            )}

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
                  {l.role === 'CANDIDATE' ? 'Bạn' : l.role === 'PARTNER' ? 'Bạn thi cùng' : 'Giám khảo'}
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

            {uploading && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], paddingVertical: space[1] }}>
                <ThemedText variant="caption" color="muted">Giám khảo đang nghe bản ghi của bạn…</ThemedText>
              </View>
            )}
          </Screen>

          {/* Thanh mic */}
          {inPart && (
            <View style={{ borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface, paddingHorizontal: space[5], paddingVertical: space[3], gap: space[2] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sang phần tiếp theo"
                  onPress={() => void doAdvance()}
                  disabled={busy || uploading || recording}
                  style={{ width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: c.borderStrong, alignItems: 'center', justifyContent: 'center', opacity: busy || uploading || recording ? 0.4 : 1 }}
                >
                  <Icon icon={ChevronRight} size={20} color="secondary" />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={recording ? 'Dừng và gửi câu trả lời' : 'Bắt đầu nói'}
                  onPress={() => void (recording ? stopAndSubmitTurn() : startRecording())}
                  disabled={uploading || busy}
                  style={{
                    flex: 1, height: 56, borderRadius: radius.full,
                    backgroundColor: recording ? c.danger : c.accent,
                    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space[2],
                    opacity: uploading || busy ? 0.5 : 1,
                  }}
                >
                  <Icon icon={recording ? Square : Mic} size={20} color={recording ? 'onInk' : 'onAccent'} />
                  <ThemedText variant="bodyStrong" style={{ color: recording ? c.onBrand : c.onAccent }}>
                    {uploading ? 'Đang gửi…' : recording ? 'Dừng & gửi' : 'Nhấn để nói'}
                  </ThemedText>
                </Pressable>
              </View>
              <ThemedText variant="caption" color="faint" align="center">
                Nói xong bấm Dừng — server phiên âm và giám khảo đáp lại.
              </ThemedText>
            </View>
          )}
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
        const copy = gradingFailedCopy(session.gradingError)
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
