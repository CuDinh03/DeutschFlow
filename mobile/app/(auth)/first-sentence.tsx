// Wow moment "Câu tiếng Đức đầu tiên" (onboarding v1 §4) — chèn NGAY SAU khi
// signup + replay draft xong (transcribe/TTS server cần auth). Một màn, 4 trạng
// thái: mentor chào (TTS) → mời nói (mic) → đang nghe/xử lý → ăn mừng.
//
// Nguyên tắc đã chốt: KHÔNG BAO GIỜ có trạng thái fail — sai thì động viên thử
// lại đúng 1 lần, lần 2 (hoặc timeout/lỗi mạng) vẫn chuyển success-tone. Từ chối
// AI-consent hoặc mic → biến thể "nghe–lặp lại" (chỉ TTS, không thu âm), không
// chặn, không hỏi lại (App Store 5.1.1: ensureAiConsent TRƯỚC mọi thu âm).

import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { MotiView } from 'moti'
import * as Haptics from 'expo-haptics'
import { useAudioRecorder, AudioModule, RecordingPresets, setAudioModeAsync } from 'expo-audio'
import { BookOpen, Compass, Flame, Mic, Square, Volume2 } from 'lucide-react-native'
import type { LucideIcon as LucideIconType } from 'lucide-react-native'
import api from '@/lib/api'
import { speakingApi } from '@/lib/speakingApi'
import { speakGerman, stopGermanSpeech, setGermanRecordingActive } from '@/lib/germanTts'
import { ensureAiConsent } from '@/lib/aiConsent'
import { evaluateFirstSentence } from '@/lib/firstSentence'
import { MENTOR_META, mentorFirstName, type OnboardingMentor } from '@/lib/onboardingMentor'
import { useAuthStore } from '@/stores/useAuthStore'
import { useTourStore } from '@/stores/useTourStore'
import { useBlockBackNavigation } from '@/hooks/useBlockBackNavigation'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useStarterStore } from '@/stores/useStarterStore'
import { captureEvent } from '@/lib/analytics'
import { fonts, motion, radius, space, useTheme } from '@/lib/theme'
import { Button, Caption, Card, Icon, Screen, ThemedText, YellowSquare } from '@/components/ui'
import { MentorMonogram } from '@/components/onboarding/MentorMonogram'
import { ConfettiBurst } from '@/components/guide/ConfettiBurst'

const TRANSCRIBE_TIMEOUT_MS = 6000

type CelebrateKind = 'real' | 'soft' | 'echo'

// `no_mic_choice`: user chủ động chọn đường "chỉ nghe — lặp lại" (UI v2) — khác
// `mic` (bị hệ thống từ chối quyền) để phễu phân biệt được hai chuyện.
type SkipReason = 'consent' | 'mic' | 'later' | 'error' | 'no_mic_choice'

function transcribeWithTimeout(uri: string): Promise<string> {
  return Promise.race([
    speakingApi.transcribe(uri),
    new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('transcribe-timeout')), TRANSCRIBE_TIMEOUT_MS),
    ),
  ])
}

export default function FirstSentenceScreen() {
  const theme = useTheme()
  const c = theme.colors
  const user = useAuthStore((s) => s.user)
  const firstName = user?.displayName?.split(' ').at(-1) ?? 'bạn'

  const [mentor, setMentor] = useState<OnboardingMentor | null>(null)
  // Chờ fetch mentor xong (kể cả fail) rồi mới chào — tránh TTS 2 lần 2 tên.
  const [mentorReady, setMentorReady] = useState(false)
  const [celebrate, setCelebrate] = useState<CelebrateKind | null>(null)
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [retryMsg, setRetryMsg] = useState<string | null>(null)
  const attemptsRef = useRef(0)
  const recordingRef = useRef(false)
  const doneRef = useRef(false)

  // Màn này chỉ tới được sau khi đã lưu hồ sơ ⇒ luôn đang đăng nhập. Lùi khỏi đây
  // là rơi vào màn Đăng nhập (F-5). Muốn bỏ qua thì đã có nút "Để sau".
  useBlockBackNavigation(true)

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)

  const mName = mentorFirstName(mentor)
  const greeting = `Hallo! Ich bin ${mName}. Und wie heißt du?`
  const sentence = `Hallo, ich bin ${firstName}!`

  // Mentor thật của user (đã chọn trong survey) — best-effort, fallback generic.
  useEffect(() => {
    let active = true
    captureEvent('onb_first_sentence_started', {})
    api
      .get<OnboardingMentor>('/onboarding/mentor')
      .then(({ data }) => {
        if (active) setMentor(data)
      })
      .catch(() => {
        /* generic mentor is fine */
      })
      .finally(() => {
        if (active) setMentorReady(true)
      })
    return () => {
      active = false
    }
  }, [])

  // Mentor chào bằng giọng nói khi vào màn (câu template cố định, không LLM).
  useEffect(() => {
    if (!mentorReady || celebrate) return
    const t = setTimeout(() => void speakGerman(greeting), 450)
    return () => clearTimeout(t)
    // Chỉ chào 1 lần sau khi biết mentor; greeting lúc này đã ổn định.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentorReady])

  // Dọn audio khi rời màn: dừng TTS + recorder, nhả guard audio session.
  useEffect(
    () => () => {
      void stopGermanSpeech()
      if (recordingRef.current) {
        setGermanRecordingActive(false)
        void recorder
          .stop()
          .catch(() => undefined)
          .finally(() => {
            // Thoát record mode kẻo audio mode toàn app kẹt allowsRecording và
            // mọi phát lại sau đó ra loa trong rất nhỏ (F-11 soát 02/09).
            void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {})
          })
      }
    },
    [recorder],
  )

  function finishToHome() {
    if (doneRef.current) return
    doneRef.current = true
    void useTourStore.getState().markDone('first_sentence')
    // Idempotent — che ca user vào lại màn này từ checklist mà cờ profile_done
    // chưa từng được đặt (tài khoản tạo trước bản vá F-2).
    void useTourStore.getState().markDone('profile_done')
    // Checklist "Bắt đầu" (§7.1): tick "Nói câu đầu tiên" khi user đã đi tới
    // màn ăn mừng (kể cả biến thể nghe–lặp lại) — skip "Để sau" không tính,
    // checklist sẽ mời làm lại.
    if (celebrate) useStarterStore.getState().markSpokeFirstSentence()
    router.replace('/(student)')
  }

  function skip(reason: SkipReason, kind?: CelebrateKind) {
    captureEvent('onb_first_sentence_skipped', { reason })
    if (kind) {
      // Không chặn: từ chối consent/mic → biến thể nghe–lặp lại, vẫn ăn mừng.
      setCelebrate(kind)
      return
    }
    finishToHome()
  }

  function succeed(kind: 'real' | 'soft') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    captureEvent('onb_first_sentence_succeeded', {
      attempts: attemptsRef.current + 1,
      soft: kind === 'soft',
    })
    setCelebrate(kind)
  }

  async function startRecording() {
    if (recording || processing) return
    // 5.1.1: bản ghi được gửi tới AI bên thứ ba — BẮT BUỘC consent trước thu âm.
    if (!(await ensureAiConsent())) {
      skip('consent', 'echo')
      return
    }
    try {
      const { status } = await AudioModule.requestRecordingPermissionsAsync()
      if (status !== 'granted') {
        skip('mic', 'echo')
        return
      }
      await stopGermanSpeech()
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()
      recorder.record()
      recordingRef.current = true
      setGermanRecordingActive(true)
      setRecording(true)
      setRetryMsg(null)
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    } catch {
      // Mic không khởi động được — coi như biến thể nghe–lặp lại, không lộ lỗi.
      skip('mic', 'echo')
    }
  }

  async function stopRecording() {
    if (!recording) return
    setRecording(false)
    recordingRef.current = false
    setGermanRecordingActive(false)
    setProcessing(true)
    captureEvent('onb_first_sentence_spoken', { attempt: attemptsRef.current + 1 })
    try {
      await recorder.stop()
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true })
      const uri = recorder.uri
      if (!uri) throw new Error('no-recording')
      const transcript = await transcribeWithTimeout(uri)
      const verdict = evaluateFirstSentence(transcript, firstName)
      if (verdict === 'pass') {
        succeed('real')
      } else if (attemptsRef.current === 0) {
        attemptsRef.current = 1
        captureEvent('onb_first_sentence_retried', {})
        setRetryMsg('Gần lắm rồi! Nghe lại rồi thử thêm lần nữa nhé.')
        void speakGerman(sentence)
      } else {
        // Lần 2 bất kể kết quả → success-tone. Không bao giờ fail.
        succeed('soft')
      }
    } catch {
      // Timeout 6s / lỗi mạng → success-tone generic, không lộ lỗi.
      captureEvent('onb_first_sentence_skipped', { reason: 'error' satisfies SkipReason })
      setCelebrate('soft')
    } finally {
      setProcessing(false)
    }
  }

  // ── Ăn mừng ────────────────────────────────────────────────────────────────
  if (celebrate) {
    const isEcho = celebrate === 'echo'
    return (
      <Screen edges={['top', 'bottom']}>
        <ConfettiBurst />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: space[6],
            paddingVertical: space[5],
          }}
          showsVerticalScrollIndicator={false}
        >
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', ...motion.spring.bouncy }}
            style={{ alignItems: 'center', gap: space[4] }}
          >
            <MentorAvatar mentor={mentor} />
            <ThemedText variant="display" style={{ textAlign: 'center' }}>
              Du hast es geschafft!
            </ThemedText>
            <ThemedText variant="body" color="secondary" style={{ textAlign: 'center' }}>
              {isEcho
                ? `Nghe ${mName} nói rồi lặp lại thành tiếng — thế là bạn đã có câu tiếng Đức đầu tiên.`
                : 'Bạn vừa nói câu tiếng Đức đầu tiên của mình.'}
            </ThemedText>
            <SentenceCard sentence={sentence} onPlay={() => void speakGerman(sentence)} />

            {/* Thành quả đầu tiên — chuỗi ngày + câu đầu (artboard 08) */}
            <View style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap', justifyContent: 'center' }}>
              <AchievementPill icon={Flame} color={c.orange} label="Chuỗi ngày 1 bắt đầu" />
              <AchievementPill color={c.accentText} label="Câu đầu: Hallo" />
            </View>

            {/* Tuần đầu của bạn — nối thẳng vào tour + checklist ở Trang chủ */}
            <Card padded={false} style={{ alignSelf: 'stretch' }}>
              <View style={{ paddingHorizontal: space[4], paddingVertical: space[3], borderBottomWidth: 1, borderBottomColor: c.border }}>
                <Caption>Tuần đầu của bạn</Caption>
              </View>
              <NextStepRow icon={Compass} title="Tour trang chủ — 1 phút" sub="Biết chỗ học, chỗ luyện nói, chỗ xem chuỗi ngày" />
              <NextStepRow icon={Mic} title={`Buổi luyện nói đầu với ${mName}`} sub="Tình huống chào hỏi ngắn" />
              <NextStepRow icon={BookOpen} title="Chặng 1 trên lộ trình của bạn" sub="Bắt đầu từ Trang chủ" last />
            </Card>
          </MotiView>
        </ScrollView>
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: c.border,
            backgroundColor: c.surface,
            paddingHorizontal: space[6],
            paddingTop: space[4],
            paddingBottom: space[2],
          }}
        >
          <Button label="Vào hành trình của tôi" onPress={finishToHome} />
        </View>
      </Screen>
    )
  }

  // ── Mentor chào + mời nói ──────────────────────────────────────────────────
  return (
    <Screen edges={['top', 'bottom']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: space[5],
          paddingTop: space[2],
        }}
      >
        <Caption>Khoảnh khắc đầu tiên</Caption>
        <Pressable accessibilityRole="button" accessibilityLabel="Để sau" hitSlop={8} onPress={() => skip('later')}>
          <ThemedText variant="bodyStrong" color="faint">
            Để sau
          </ThemedText>
        </Pressable>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space[6], gap: space[6] }}>
        <MotiView
          from={{ opacity: 0, translateY: 14 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: motion.duration.slow }}
          style={{ alignItems: 'center', gap: space[4] }}
        >
          <MentorAvatar mentor={mentor} speaking={!recording && !processing} />
          <View style={{ gap: space[1], alignItems: 'center' }}>
            <ThemedText variant="caption" color="muted">
              {mentor ? MENTOR_META[mentor.code]?.tagline ?? 'Mentor của bạn' : 'Mentor của bạn'}
            </ThemedText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <ThemedText variant="titleLg">{greeting}</ThemedText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Nghe lại lời chào"
              hitSlop={8}
              onPress={() => void speakGerman(greeting)}
              style={{ padding: space[2] }}
            >
              <Icon icon={Volume2} size={20} color="accent" />
            </Pressable>
          </View>
        </MotiView>

        <View style={{ gap: space[3] }}>
          <ThemedText variant="bodyStrong" style={{ textAlign: 'center' }}>
            Nói lại câu này nhé:
          </ThemedText>
          <SentenceCard sentence={sentence} hint="ha-LÔ, ích bin…" onPlay={() => void speakGerman(sentence)} />
          {retryMsg ? (
            <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ThemedText variant="bodyStrong" color="accent" style={{ textAlign: 'center' }}>
                {retryMsg}
              </ThemedText>
            </MotiView>
          ) : null}
        </View>

        <View style={{ alignItems: 'center', gap: space[3] }}>
          {processing ? (
            <View style={{ alignItems: 'center', gap: space[2], height: 132, justifyContent: 'center' }}>
              <ActivityIndicator size="large" color={c.accent} />
              <ThemedText variant="caption" color="muted">
                {`${mName} đang lắng nghe…`}
              </ThemedText>
            </View>
          ) : (
            <>
              <View
                style={{
                  width: 108,
                  height: 108,
                  borderRadius: radius.full,
                  backgroundColor: c.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={recording ? 'Dừng ghi âm' : 'Bấm để nói'}
                  onPress={() => void (recording ? stopRecording() : startRecording())}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: radius.full,
                    backgroundColor: recording ? c.danger : c.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {recording ? (
                    <Square size={28} color={c.onBrand} fill={c.onBrand} />
                  ) : (
                    <Mic size={32} color={c.onAccent} strokeWidth={2.2} />
                  )}
                </Pressable>
              </View>
              <View style={{ alignItems: 'center', gap: 2 }}>
                <ThemedText variant="bodyStrong">
                  {recording ? 'Đang nghe… bấm để dừng' : 'Chạm & nói câu trên'}
                </ThemedText>
                <ThemedText variant="caption" color="muted">
                  Sai cũng không sao — cứ thử thoải mái.
                </ThemedText>
              </View>
              {/* Đường chủ động không dùng micro (UI v2) — cùng biến thể nghe–lặp
                  lại như khi bị từ chối quyền, nhưng phễu tách được hai lý do. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Chỉ nghe rồi lặp lại, không dùng micro"
                hitSlop={8}
                onPress={() => skip('no_mic_choice', 'echo')}
                style={{ paddingVertical: space[1] }}
              >
                <ThemedText
                  variant="label"
                  color="secondary"
                  style={{ borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: 2 }}
                >
                  Chỉ nghe — lặp lại (không dùng micro)
                </ThemedText>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Screen>
  )
}

function MentorAvatar({ mentor, speaking }: { mentor: OnboardingMentor | null; speaking?: boolean }) {
  const c = useTheme().colors
  // Vòng sáng lặp vô hạn: chạm WCAG 2.2.2 (chuyển động > 5 giây, không nút dừng).
  // Giảm chuyển động → avatar tĩnh (F-7).
  // Gọi hook vô điều kiện: `speaking && !useReducedMotion()` sẽ đoản mạch và bỏ
  // qua lời gọi hook khi speaking falsy — vi phạm rules-of-hooks.
  const reducedMotion = useReducedMotion()
  const pulsing = speaking && !reducedMotion
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {pulsing ? (
        <MotiView
          from={{ scale: 1, opacity: 0.45 }}
          animate={{ scale: 1.35, opacity: 0 }}
          transition={{ type: 'timing', duration: 1400, loop: true }}
          style={{
            position: 'absolute',
            width: 96,
            height: 96,
            borderRadius: radius.full,
            backgroundColor: c.accentSoft,
          }}
        />
      ) : null}
      {/* UI v2: monogram serif trên ô mực (bỏ avatar emoji — icon system v2). */}
      <MentorMonogram mentor={mentor} size={84} />
    </View>
  )
}

/** Pill thành quả trên màn ăn mừng — nền dịu lấy từ chính màu token (hex + alpha). */
function AchievementPill({ icon, color, label }: { icon?: LucideIconType; color: string; label: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[1],
        backgroundColor: `${color}24`,
        borderRadius: radius.sm,
        paddingHorizontal: space[2] + 2,
        paddingVertical: space[2],
      }}
    >
      {icon ? <IconGlyph icon={icon} color={color} /> : <YellowSquare size={7} color={color} />}
      <ThemedText
        variant="caption"
        style={{ fontFamily: fonts.bodySemi, fontSize: 10, lineHeight: 12, letterSpacing: 0.9, textTransform: 'uppercase', color }}
      >
        {label}
      </ThemedText>
    </View>
  )
}

/** Một dòng trong thẻ "Tuần đầu của bạn". */
function NextStepRow({
  icon,
  title,
  sub,
  last = false,
}: {
  icon: LucideIconType
  title: string
  sub: string
  last?: boolean
}) {
  const c = useTheme().colors
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        paddingHorizontal: space[4],
        paddingVertical: space[3],
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.border,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: radius.md,
          backgroundColor: c.surfaceSunken,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon icon={icon} size={17} color="secondary" strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <ThemedText variant="bodyStrong">{title}</ThemedText>
        <ThemedText variant="caption" color="secondary">
          {sub}
        </ThemedText>
      </View>
    </View>
  )
}

/** Icon nhỏ tô màu tuỳ ý (ngoài các role của <Icon/>). */
function IconGlyph({ icon: LucideComponent, color }: { icon: LucideIconType; color: string }) {
  return <LucideComponent size={13} color={color} strokeWidth={2} />
}

function SentenceCard({ sentence, hint, onPlay }: { sentence: string; hint?: string; onPlay: () => void }) {
  const c = useTheme().colors
  return (
    <View
      style={{
        backgroundColor: c.inkSurface,
        borderRadius: radius['3xl'],
        padding: space[5],
        gap: space[2],
        alignItems: 'center',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <ThemedText variant="titleLg" style={{ color: c.onInk, textAlign: 'center', flexShrink: 1 }}>
          {sentence}
        </ThemedText>
        <Pressable accessibilityRole="button" accessibilityLabel="Nghe câu mẫu" hitSlop={8} onPress={onPlay}>
          <Icon icon={Volume2} size={22} color="accent" />
        </Pressable>
      </View>
      {hint ? (
        <ThemedText variant="caption" style={{ color: c.onInkMuted }}>
          Đọc là: {hint}
        </ThemedText>
      ) : null}
    </View>
  )
}
