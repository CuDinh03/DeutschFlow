// Kiểm tra micro trước khi vào phòng thi nói (mẫu v3.4 `oralmic`, Đợt 5 phần B, 19/11/2026).
// Thi thử chỉ nhận lượt nói bằng giọng và đồng hồ Teil là giờ thật, nên phải chứng minh micro mở
// được TRƯỚC khi tạo phiên — đồng hồ thi chỉ chạy khi đã vào phòng. Bản ghi thử không gửi đi đâu:
// đo mức âm tại máy rồi xoá file.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Linking, Pressable, View } from 'react-native'
import {
  AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState,
} from 'expo-audio'
import * as FileSystem from 'expo-file-system/legacy'
import { ArrowLeft } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { BrushMark, Button, GaGlyph, IconButton, Pill, Screen, ThemedText } from '@/components/ui'
import type { GlyphName } from '@/lib/galerieGlyphs'
import { useRecorderBlurGuard } from '@/hooks/useRecorderBlurGuard'
import { SPEECH_LEVEL, litBars, meterLevel } from '@/lib/oralRoom'
import { speakExamLine, stopExamTts } from '@/lib/examTts'

const BARS = 14
/** Nghe thấy tiếng rồi thì đo thêm chừng này để người học thấy thanh nhảy theo giọng mình. */
const AFTER_HEARD_MS = 900
/** Không nghe thấy gì sau chừng này thì dừng, báo "chưa nghe rõ" (vẫn cho vào phòng). */
const CHECK_TIMEOUT_MS = 8000

type MicCheckStatus = 'checking' | 'heard' | 'quiet' | 'denied' | 'error'

const METER_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true }

export function OralMicCheck({
  level,
  entering,
  onEnter,
  onBack,
}: {
  level: string
  entering: boolean
  onEnter: () => void
  onBack: () => void
}) {
  const c = useTheme().colors
  const recorder = useAudioRecorder(METER_OPTIONS)
  const state = useAudioRecorderState(recorder, 80)
  const [status, setStatus] = useState<MicCheckStatus>('checking')
  const [speakerPlaying, setSpeakerPlaying] = useState(false)
  const heardAtRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const stoppingRef = useRef(false)

  const stopCheck = useCallback(async (next: MicCheckStatus) => {
    if (stoppingRef.current) return
    stoppingRef.current = true
    setStatus(next)
    try {
      if (recorder.isRecording) await recorder.stop()
    } catch { /* đã dừng */ }
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {})
    const uri = recorder.uri
    if (uri) void FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {})
  }, [recorder])

  const startCheck = useCallback(async () => {
    stopExamTts()
    stoppingRef.current = false
    heardAtRef.current = null
    setStatus('checking')
    try {
      const { status: perm, canAskAgain } = await AudioModule.requestRecordingPermissionsAsync()
      if (perm !== 'granted') {
        setStatus(canAskAgain ? 'error' : 'denied')
        return
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()
      recorder.record()
      startedAtRef.current = Date.now()
    } catch {
      setStatus('error')
    }
  }, [recorder])

  // Tự kiểm ngay khi mở: người học vừa bấm "Bắt đầu thi thử" nên xin quyền micro lúc này là đúng chỗ.
  useEffect(() => {
    void startCheck()
    return () => {
      stopExamTts()
      if (recorder.isRecording) void recorder.stop().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useRecorderBlurGuard(recorder, () => setStatus('quiet'))

  const meter = status === 'checking' ? meterLevel(state.metering) : 0
  useEffect(() => {
    if (status !== 'checking' || !state.isRecording) return
    const now = Date.now()
    if (heardAtRef.current == null && meter >= SPEECH_LEVEL) heardAtRef.current = now
    if (heardAtRef.current != null && now - heardAtRef.current >= AFTER_HEARD_MS) void stopCheck('heard')
    else if (now - startedAtRef.current >= CHECK_TIMEOUT_MS) void stopCheck(heardAtRef.current != null ? 'heard' : 'quiet')
  }, [meter, state.isRecording, state.durationMillis, status, stopCheck])

  async function playSpeaker() {
    if (speakerPlaying || status === 'checking') return
    setSpeakerPlaying(true)
    try {
      await speakExamLine('PRUEFER', 'Guten Tag. Können Sie mich gut hören?')
    } finally {
      setSpeakerPlaying(false)
    }
  }

  const lit = status === 'heard' ? BARS : litBars(meter, BARS)
  const badge =
    status === 'heard' ? { label: 'Micro nghe rõ', tone: 'success' as const }
    : status === 'quiet' ? { label: 'Chưa nghe thấy tiếng', tone: 'accent' as const }
    : status === 'denied' ? { label: 'Chưa có quyền micro', tone: 'danger' as const }
    : status === 'error' ? { label: 'Không mở được micro', tone: 'danger' as const }
    : { label: 'Đang nghe…', tone: 'neutral' as const }
  const canEnter = status === 'heard' || status === 'quiet'

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: space[5], paddingTop: space[2] }}>
        <IconButton icon={ArrowLeft} accessibilityLabel="Quay lại" onPress={onBack} />
      </View>
      <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[6] }}>
        <ThemedText variant="label" color="muted" style={{ marginTop: space[4], letterSpacing: 1, textTransform: 'uppercase' }}>
          {`Mündliche Prüfung · telc ${level}`}
        </ThemedText>
        <View style={{ marginTop: space[1], flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: space[2] }} accessible accessibilityRole="header" accessibilityLabel="Kiểm tra micro">
          <ThemedText variant="display">Kiểm tra</ThemedText>
          <BrushMark>micro</BrushMark>
        </View>
        <ThemedText variant="body" color="secondary" style={{ marginTop: space[2] }}>
          Làm một lần trước khi vào phòng. Đồng hồ thi chỉ chạy khi bạn vào phòng.
        </ThemedText>

        <View
          style={{
            marginTop: space[5], padding: space[5], alignItems: 'center', gap: space[3],
            borderRadius: radius['2xl'], backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
          }}
        >
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Mức âm micro"
            accessibilityValue={{ min: 0, max: BARS, now: lit }}
            style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 44 }}
          >
            {Array.from({ length: BARS }, (_, i) => (
              <View
                key={i}
                style={{
                  width: 8,
                  height: 10 + Math.round((i / (BARS - 1)) * 34),
                  borderRadius: 3,
                  backgroundColor: i < lit ? c.success : c.surfaceSunken,
                }}
              />
            ))}
          </View>
          <ThemedText variant="title" align="center">„Guten Tag, ich komme aus Vietnam.“</ThemedText>
          <ThemedText variant="caption" color="secondary" align="center">
            Đọc to câu trên. Thanh nhảy là micro nghe rõ.
          </ThemedText>
          <Pill label={badge.label} tone={badge.tone} />
          {status === 'quiet' && (
            <ThemedText variant="caption" color="secondary" align="center">
              Nói to hơn hoặc đưa máy lại gần. Vẫn vào phòng được, nhưng giám khảo có thể không nghe rõ.
            </ThemedText>
          )}
          {status === 'denied' && (
            <Button label="Mở Cài đặt" variant="secondary" size="sm" onPress={() => void Linking.openSettings()} />
          )}
          {(status === 'quiet' || status === 'error') && (
            <Button label="Kiểm tra lại" variant="ghost" size="sm" onPress={() => void startCheck()} />
          )}
        </View>

        <View style={{ marginTop: space[4], borderRadius: radius.xl, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
          <TipRow glyph="nghe" title="Nghe thử loa" desc="Giọng giám khảo">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Phát thử giọng giám khảo"
              accessibilityState={{ disabled: status === 'checking', busy: speakerPlaying }}
              onPress={() => void playSpeaker()}
              disabled={status === 'checking'}
              hitSlop={6}
              style={{
                paddingHorizontal: space[3], height: 32, borderRadius: radius.full, justifyContent: 'center',
                borderWidth: 1, borderColor: c.borderStrong, opacity: status === 'checking' ? 0.4 : 1,
              }}
            >
              <ThemedText variant="label">{speakerPlaying ? 'Đang phát' : 'Phát'}</ThemedText>
            </Pressable>
          </TipRow>
          <TipRow glyph="canhbao" title="Tắt chế độ im lặng" desc="Gạt nút bên hông iPhone, tăng âm lượng" divider />
          <TipRow glyph="noi" title="Đeo tai nghe" desc="Để giọng giám khảo không lọt vào micro" divider />
        </View>
      </Screen>
      <View style={{ paddingHorizontal: space[5], paddingTop: space[3], paddingBottom: space[2], borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface }}>
        <Button
          label={entering ? 'Đang mở phòng thi nói…' : 'Vào phòng thi'}
          onPress={onEnter}
          loading={entering}
          disabled={!canEnter || entering}
        />
      </View>
    </Screen>
  )
}

function TipRow({
  glyph, title, desc, divider = false, children,
}: { glyph: GlyphName; title: string; desc: string; divider?: boolean; children?: React.ReactNode }) {
  const c = useTheme().colors
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3],
        borderTopWidth: divider ? 1 : 0, borderTopColor: c.border,
      }}
    >
      <GaGlyph name={glyph} size={20} ink="primary" />
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText variant="bodyStrong">{title}</ThemedText>
        <ThemedText variant="caption" color="secondary">{desc}</ThemedText>
      </View>
      {children}
    </View>
  )
}
