import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Linking, Pressable, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio'
import * as FileSystem from 'expo-file-system/legacy'
import * as Haptics from 'expo-haptics'
import { Check, Flag, Mic, Square, RotateCcw, ChevronRight, X } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { ensureAiConsent } from '@/lib/aiConsent'
import { radius, space, useTheme } from '@/lib/theme'
import {
  AppHeader, Button, Caption, Card, ErrorState, Icon, Pill, Screen, Skeleton, ThemedText, YellowSquare,
} from '@/components/ui'
import { useRecorderBlurGuard } from '@/hooks/useRecorderBlurGuard'
import {
  examSpeakingApi, type ExamSessionView, type TurnResponse,
} from '@/lib/examSpeakingApi'
import { formatClock, remainingSec, stateLabel, stimulusDisplay } from '@/lib/examSpeakingUi'
import { speakExamSequence, stopExamTts } from '@/lib/examTts'
import { trackFeatureAction } from '@/lib/analytics'

const GRADING_POLL_MS = 3000

/** Một dòng hội thoại trong phòng thi (client giữ để render; server là nguồn sự thật). */
interface RoomLine {
  id: number
  role: 'CANDIDATE' | 'PRUEFER' | 'PARTNER'
  text: string
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
  const lineSeq = useRef(0)
  const spokenRef = useRef<string | null>(null)

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  useRecorderBlurGuard(recorder, () => setRecording(false))

  const pushLine = useCallback((role: RoomLine['role'], text: string) => {
    lineSeq.current += 1
    setLines((prev) => [...prev.slice(-11), { id: lineSeq.current, role, text }])
  }, [])

  /** Cập nhật snapshot + nói/ghi lời giám khảo khi sang Teil/câu dẫn mới. */
  const applySession = useCallback((data: ExamSessionView, speak: boolean) => {
    setSession(data)
    if (data.state === 'RESULTS') {
      stopExamTts()
      router.replace({ pathname: '/(student)/speaking-exam-result', params: { id: String(data.id) } })
      return
    }
    const d = data.directive
    if (d?.prueferText && data.state === 'IN_PART') {
      const key = `${d.teilNo}:${d.stepIndex}:${d.prueferText}`
      if (spokenRef.current !== key) {
        spokenRef.current = key
        pushLine('PRUEFER', d.prueferText)
        if (speak) void speakExamSequence([{ role: 'PRUEFER', text: d.prueferText }])
      }
    }
  }, [pushLine])

  // Nạp phiên lần đầu.
  useEffect(() => {
    let alive = true
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

  async function doFinish() {
    if (busy || uploading) return
    Alert.alert('Kết thúc bài thi?', 'Bài của bạn sẽ được chấm theo rubric Goethe. Không quay lại nói tiếp được.', [
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
      let turn: TurnResponse
      try {
        turn = await examSpeakingApi.audioTurn(sessionId, uri)
      } finally {
        // Server đã (hoặc đã cố) nhận audio — file tạm hết việc (F-17).
        void FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {})
      }
      if (turn.transcript?.trim()) pushLine('CANDIDATE', turn.transcript.trim())
      const aiTurns = (turn.aiTurns ?? []).filter((t) => t.text?.trim())
      for (const t of aiTurns) pushLine(t.role === 'PARTNER' ? 'PARTNER' : 'PRUEFER', t.text)
      // Snapshot mới TRƯỚC rồi mới đọc thoại — spokenRef chặn đọc trùng câu dẫn.
      applySession(turn.session, false)
      if (aiTurns.length > 0) void speakExamSequence(aiTurns)
    } catch (e) {
      Alert.alert('Lỗi lượt nói', apiMessage(e))
    } finally {
      setUploading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <Screen edges={['top']}>
        <AppHeader title="Phòng thi" onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ErrorState onRetry={() => { setLoadError(false); void examSpeakingApi.getSession(sessionId).then((d) => applySession(d, true)).catch(() => setLoadError(true)) }} />
        </View>
      </Screen>
    )
  }

  if (!session) {
    return (
      <Screen edges={['top']}>
        <AppHeader title="Phòng thi" onBack={() => router.back()} />
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
        onBack={() => {
          stopExamTts()
          router.back()
        }}
        right={
          inPart || session.state === 'BETWEEN' ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Kết thúc và chấm bài" onPress={() => void doFinish()} hitSlop={8}>
              <Icon icon={Flag} size={20} color="secondary" />
            </Pressable>
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
                      {disp.bullets.slice(0, 6).map((b, bi) => (
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
              </View>
            ))}

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

      {/* ── DONE (đã nói xong, chưa chấm) ── */}
      {session.state === 'DONE' && (
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space[5], gap: space[4] }}>
          <Card style={{ alignItems: 'center', gap: space[3], paddingVertical: space[7] }}>
            <Icon icon={Check} size={28} color="success" />
            <ThemedText variant="title">Bạn đã nói xong bài thi</ThemedText>
            <ThemedText variant="caption" color="secondary" align="center">
              Gửi bài để giám khảo AI chấm theo rubric 4 tiêu chí Goethe.
            </ThemedText>
            <Button label="Chấm bài" onPress={() => void doFinish()} loading={busy} />
          </Card>
        </View>
      )}

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

      {/* ── GRADING_FAILED ── */}
      {session.state === 'GRADING_FAILED' && (
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space[5] }}>
          <Card style={{ gap: space[3], borderColor: c.danger }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <Icon icon={X} size={20} color="danger" />
              <ThemedText variant="title">Chấm bài gặp lỗi</ThemedText>
            </View>
            <ThemedText variant="caption" color="secondary">
              Bài nói của bạn vẫn còn nguyên — chỉ khâu chấm bị lỗi. Bấm chấm lại, không phải thi lại.
            </ThemedText>
            <Button label="Chấm lại" onPress={() => void doRegrade()} loading={busy} />
          </Card>
        </View>
      )}

      {/* ── ABORTED ── */}
      {session.state === 'ABORTED' && (
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space[5] }}>
          <Card style={{ alignItems: 'center', gap: space[3], paddingVertical: space[6] }}>
            <Icon icon={RotateCcw} size={22} color="secondary" />
            <ThemedText variant="title">Phiên đã kết thúc</ThemedText>
            <Button label="Về Luyện thi Nói" variant="ghost" onPress={() => router.back()} />
          </Card>
        </View>
      )}
    </Screen>
  )
}
