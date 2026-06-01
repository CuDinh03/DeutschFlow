import { useState, useRef, useEffect } from 'react'
import { View, ScrollView, Alert, Pressable, TextInput, ActivityIndicator } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Audio } from 'expo-av'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { Mic, Send, ChevronRight, Flame, X, Flag, RotateCcw } from 'lucide-react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated'
import { apiMessage } from '@/lib/api'
import {
  speakingApi,
  type InterviewPersona,
  type AiChatResponse,
  type AiSpeakingSession,
  type AiSpeakingMessage,
  type InterviewReport,
} from '@/lib/speakingApi'
import {
  loadActiveSession,
  saveActiveSession,
  clearActiveSession,
  type ActiveSessionRef,
} from '@/lib/activeSession'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, Pill } from '@/components/ui'
import { SessionSummary } from '@/components/speaking/SessionSummary'
import { usePlanStore } from '@/stores/usePlanStore'

const PULSE_MAX = 1.2

type ChatRole = 'user' | 'assistant'

interface ChatTurn {
  role: ChatRole
  content: string
  feedback?: AiChatResponse
}

type ScreenView = 'select' | 'chat' | 'summary'

export default function SpeakingScreen() {
  const theme = useTheme()
  const c = theme.colors
  const { isPro } = usePlanStore()

  const [view, setView] = useState<ScreenView>('select')
  const [session, setSession] = useState<AiSpeakingSession | null>(null)
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [phaseKey, setPhaseKey] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [starting, setStarting] = useState(false)
  const [sending, setSending] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [report, setReport] = useState<InterviewReport | null>(null)
  const [pendingResume, setPendingResume] = useState<ActiveSessionRef | null>(null)
  const [resuming, setResuming] = useState(false)

  const recordingRef = useRef<Audio.Recording | null>(null)
  const scrollRef = useRef<ScrollView | null>(null)
  const pulseAnim = useSharedValue(1)

  const { data: personas = [], isLoading: personasLoading } = useQuery({
    queryKey: ['interview-personas'],
    queryFn: () => speakingApi.getPersonas(),
    staleTime: 300_000,
  })

  // Offer to resume an interrupted session left over from a previous app run.
  useEffect(() => {
    let active = true
    void (async () => {
      const ref = await loadActiveSession()
      if (active && ref) setPendingResume(ref)
    })()
    return () => {
      active = false
    }
  }, [])

  const busy = starting || sending || isRecording || finishing
  const userTurns = messages.filter((m) => m.role === 'user').length

  function scrollToEnd() {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }))
  }

  async function startSession(persona: InterviewPersona) {
    if (persona.difficulty === 'ADVANCED' && !isPro) {
      Alert.alert('Cần PRO', 'Persona nâng cao thuộc gói PRO.')
      return
    }
    setStarting(true)
    try {
      const created = await speakingApi.startInterview(persona)
      const greeting = created.initialAiMessage?.aiSpeechDe ?? 'Hallo! Erzählen Sie mir von sich.'
      setSession(created)
      setPhaseKey(created.initialAiMessage?.interviewPhaseKey ?? 'INTRO')
      setMessages([{ role: 'assistant', content: greeting, feedback: created.initialAiMessage ?? undefined }])
      setReport(null)
      setPendingResume(null)
      void saveActiveSession({ id: created.id, interviewPosition: created.interviewPosition })
      setView('chat')
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    } catch (e) {
      Alert.alert('Không thể bắt đầu', apiMessage(e))
    } finally {
      setStarting(false)
    }
  }

  async function submitAnswer(text: string) {
    const trimmed = text.trim()
    if (!trimmed || !session || sending) return
    setDraft('')
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }])
    setSending(true)
    scrollToEnd()
    try {
      const res = await speakingApi.chat(session.id, trimmed)
      setMessages((prev) => [...prev, { role: 'assistant', content: res.aiSpeechDe ?? '…', feedback: res }])
      if (res.interviewPhaseKey) setPhaseKey(res.interviewPhaseKey)
      scrollToEnd()
      if (res.isSessionEnded) await finishSession()
    } catch (e) {
      Alert.alert('Lỗi', apiMessage(e))
    } finally {
      setSending(false)
    }
  }

  async function startRecording() {
    if (!isPro) {
      Alert.alert('Tính năng PRO', 'Trả lời bằng giọng nói cần PRO. Bạn vẫn có thể gõ câu trả lời.')
      return
    }
    try {
      await Audio.requestPermissionsAsync()
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      recordingRef.current = recording
      setIsRecording(true)
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      pulseAnim.value = withRepeat(withTiming(PULSE_MAX, { duration: 800 }), -1, true)
    } catch {
      Alert.alert('Lỗi', 'Không thể khởi động microphone. Vui lòng kiểm tra quyền truy cập.')
    }
  }

  async function stopRecordingAndSend() {
    if (!recordingRef.current || !session) return
    cancelAnimation(pulseAnim)
    pulseAnim.value = 1
    setIsRecording(false)
    setSending(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    try {
      const recording = recordingRef.current
      recordingRef.current = null
      await recording.stopAndUnloadAsync()
      const uri = recording.getURI()
      if (!uri) throw new Error('no_uri')
      const transcript = await speakingApi.transcribe(uri)
      setSending(false)
      await submitAnswer(transcript)
    } catch (e) {
      setSending(false)
      Alert.alert('Lỗi', apiMessage(e))
    }
  }

  async function finishSession() {
    if (!session || finishing) return
    setFinishing(true)
    try {
      await speakingApi.endSession(session.id).catch(() => undefined)
      void clearActiveSession()
      const built = await speakingApi.getReport(session.id)
      setReport(built)
      setView('summary')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (e) {
      Alert.alert('Không thể tạo báo cáo', apiMessage(e))
    } finally {
      setFinishing(false)
    }
  }

  function resetToSelect() {
    setSession(null)
    setMessages([])
    setReport(null)
    setPhaseKey(null)
    setDraft('')
    setPendingResume(null)
    void clearActiveSession()
    setView('select')
  }

  async function resumeSession(ref: ActiveSessionRef) {
    setResuming(true)
    try {
      const history = await speakingApi.getMessages(ref.id)
      const turns = mapMessagesToTurns(history)
      if (turns.length === 0) {
        await clearActiveSession()
        setPendingResume(null)
        Alert.alert('Phiên đã kết thúc', 'Không còn dữ liệu để tiếp tục.')
        return
      }
      setSession({
        id: ref.id,
        topic: ref.interviewPosition,
        cefrLevel: 'C1',
        persona: null,
        responseSchema: null,
        sessionMode: 'INTERVIEW',
        status: 'ACTIVE',
        startedAt: null,
        lastActivityAt: null,
        endedAt: null,
        messageCount: turns.length,
        initialAiMessage: null,
        interviewPosition: ref.interviewPosition,
        experienceLevel: null,
        interviewReportJson: null,
      })
      setMessages(turns)
      setPhaseKey(null)
      setReport(null)
      setPendingResume(null)
      setView('chat')
      scrollToEnd()
    } catch (e) {
      Alert.alert('Không thể tiếp tục', apiMessage(e))
      await clearActiveSession()
      setPendingResume(null)
    } finally {
      setResuming(false)
    }
  }

  async function dismissResume() {
    await clearActiveSession()
    setPendingResume(null)
  }

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
    opacity: pulseAnim.value,
  }))

  // ── Summary view ───────────────────────────────────────────────────────────
  if (view === 'summary' && report) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Kết quả phỏng vấn" onClose={resetToSelect} />
        <SessionSummary report={report} onPracticeAgain={resetToSelect} onDone={() => router.replace('/(student)/')} />
      </Screen>
    )
  }

  // ── Persona selection ────────────────────────────────────────────────────────
  if (view === 'select') {
    return (
      <Screen edges={['top']}>
        <View style={{ paddingHorizontal: space[5], paddingTop: space[3], paddingBottom: space[2], gap: 2 }}>
          <ThemedText variant="display">Phỏng vấn AI</ThemedText>
          <ThemedText variant="body" color="muted">
            Chọn nhà tuyển dụng để luyện tập
          </ThemedText>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: space[6], gap: space[3], paddingTop: space[3] }}
          showsVerticalScrollIndicator={false}
        >
          {pendingResume ? (
            <Card style={{ borderColor: c.accent + '99' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <Pressable
                  onPress={() => void resumeSession(pendingResume)}
                  disabled={resuming}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[3] }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radius.lg,
                      backgroundColor: c.accentSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon icon={RotateCcw} size={22} color="accent" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText variant="bodyStrong">Tiếp tục buổi phỏng vấn</ThemedText>
                    <ThemedText variant="caption" color="muted" numberOfLines={1}>
                      {pendingResume.interviewPosition ?? 'Phiên đang dang dở'}
                    </ThemedText>
                  </View>
                </Pressable>
                {resuming ? (
                  <ActivityIndicator color={c.accent} />
                ) : (
                  <Pressable hitSlop={8} onPress={dismissResume}>
                    <Icon icon={X} size={18} color="faint" />
                  </Pressable>
                )}
              </View>
            </Card>
          ) : null}

          {personasLoading ? <ActivityIndicator color={c.accent} style={{ marginTop: space[8] }} /> : null}

          {personas.map((persona) => {
            const locked = persona.difficulty === 'ADVANCED' && !isPro
            return (
              <Card key={persona.code} onPress={() => startSession(persona)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], flex: 1 }}>
                    <DifficultyDot difficulty={persona.difficulty} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <ThemedText variant="bodyStrong">{persona.roleTitle}</ThemedText>
                      <View style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap' }}>
                        <Pill label={difficultyLabel(persona.difficulty)} tone={difficultyTone(persona.difficulty)} />
                        {persona.industry ? <Pill label={persona.industry} tone="neutral" /> : null}
                      </View>
                    </View>
                  </View>
                  {locked ? <Pill label="PRO" tone="accent" /> : <Icon icon={ChevronRight} size={18} color="faint" />}
                </View>
              </Card>
            )
          })}

          <Card onPress={() => router.push('/(student)/weekly-speaking')} style={{ borderColor: c.info + '66' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.lg,
                  backgroundColor: c.infoSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon icon={Flame} size={22} color="info" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText variant="bodyStrong">Weekly Speaking Challenge</ThemedText>
                <ThemedText variant="caption" color="muted">
                  Nộp bài nói hàng tuần • PRO
                </ThemedText>
              </View>
              <Icon icon={ChevronRight} size={18} color="faint" />
            </View>
          </Card>
        </ScrollView>

        {starting ? (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg + 'cc' }}>
            <ActivityIndicator color={c.accent} size="large" />
            <ThemedText variant="caption" color="muted" style={{ marginTop: space[3] }}>
              Đang chuẩn bị buổi phỏng vấn…
            </ThemedText>
          </View>
        ) : null}
      </Screen>
    )
  }

  // ── Chat / practice view ─────────────────────────────────────────────────────
  return (
    <Screen edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[2],
          paddingHorizontal: space[5],
          paddingVertical: space[3],
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        }}
      >
        <Pressable hitSlop={8} onPress={resetToSelect}>
          <Icon icon={X} size={22} color="muted" />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText variant="bodyStrong" numberOfLines={1}>
            {session?.interviewPosition ?? 'Phỏng vấn'}
          </ThemedText>
          <ThemedText variant="caption" color="muted">
            {phaseKey ? `${phaseLabel(phaseKey)} • ` : ''}
            {userTurns} câu trả lời
          </ThemedText>
        </View>
        <Pressable
          hitSlop={8}
          onPress={() =>
            Alert.alert('Kết thúc phỏng vấn?', 'Bạn sẽ nhận được báo cáo đánh giá.', [
              { text: 'Tiếp tục', style: 'cancel' },
              { text: 'Kết thúc', style: 'destructive', onPress: () => void finishSession() },
            ])
          }
          disabled={finishing || userTurns === 0}
          style={{ opacity: finishing || userTurns === 0 ? 0.4 : 1 }}
        >
          <Icon icon={Flag} size={20} color="accent" />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space[5], paddingVertical: space[4], gap: space[3] }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToEnd}
      >
        {messages.map((msg, i) => (
          <MessageBubble key={i} turn={msg} />
        ))}
        {(sending || finishing) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], paddingLeft: space[2] }}>
            <ActivityIndicator color={c.textMuted} size="small" />
            <ThemedText variant="caption" color="muted">
              {finishing ? 'Đang tạo báo cáo…' : 'Đang soạn câu hỏi…'}
            </ThemedText>
          </View>
        )}
      </ScrollView>

      {/* Input dock */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: space[2],
          paddingHorizontal: space[4],
          paddingTop: space[2],
          paddingBottom: space[4],
          borderTopWidth: 1,
          borderTopColor: c.border,
          backgroundColor: c.surface,
        }}
      >
        <Animated.View style={isRecording ? pulseStyle : undefined}>
          <Pressable
            onPress={isRecording ? stopRecordingAndSend : startRecording}
            disabled={sending || finishing}
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.full,
              backgroundColor: isRecording ? c.danger : c.surfaceSunken,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon icon={Mic} size={20} color={isRecording ? 'onAccent' : 'muted'} />
          </Pressable>
        </Animated.View>

        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Nhập câu trả lời của bạn…"
          placeholderTextColor={c.textFaint}
          selectionColor={c.accent}
          multiline
          editable={!busy}
          style={{
            flex: 1,
            maxHeight: 120,
            minHeight: 44,
            backgroundColor: c.surfaceSunken,
            borderRadius: radius.lg,
            paddingHorizontal: space[4],
            paddingTop: 12,
            paddingBottom: 12,
            color: c.textPrimary,
            fontFamily: 'PlusJakartaSans_400Regular',
            fontSize: 15,
          }}
        />

        <Pressable
          onPress={() => void submitAnswer(draft)}
          disabled={!draft.trim() || busy}
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.full,
            backgroundColor: !draft.trim() || busy ? c.surfaceSunken : c.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon icon={Send} size={20} color={!draft.trim() || busy ? 'faint' : 'onAccent'} />
        </Pressable>
      </View>
    </Screen>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ScreenHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const { colors } = useTheme()
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[2],
        paddingHorizontal: space[5],
        paddingVertical: space[3],
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Pressable hitSlop={8} onPress={onClose}>
        <Icon icon={X} size={22} color="muted" />
      </Pressable>
      <ThemedText variant="bodyStrong">{title}</ThemedText>
    </View>
  )
}

function MessageBubble({ turn }: { turn: ChatTurn }) {
  const { colors } = useTheme()
  const isUser = turn.role === 'user'
  const fb = turn.feedback
  const hasFeedback = !isUser && fb && (fb.correction || fb.explanationVi || (fb.suggestions?.length ?? 0) > 0)

  return (
    <View style={{ alignItems: isUser ? 'flex-end' : 'flex-start', gap: space[2] }}>
      <View
        style={{
          maxWidth: '88%',
          backgroundColor: isUser ? colors.accent : colors.surfaceElevated,
          borderRadius: radius.lg,
          borderBottomRightRadius: isUser ? radius.sm : radius.lg,
          borderBottomLeftRadius: isUser ? radius.lg : radius.sm,
          paddingHorizontal: space[4],
          paddingVertical: space[3],
        }}
      >
        <ThemedText variant="body" color={isUser ? 'onAccent' : 'primary'}>
          {turn.content}
        </ThemedText>
      </View>

      {hasFeedback ? (
        <View
          style={{
            maxWidth: '88%',
            backgroundColor: colors.surfaceSunken,
            borderRadius: radius.md,
            borderLeftWidth: 3,
            borderLeftColor: colors.info,
            paddingHorizontal: space[3],
            paddingVertical: space[2],
            gap: space[1],
          }}
        >
          {fb?.correction ? (
            <ThemedText variant="caption" color="secondary">
              ✏️ {fb.correction}
            </ThemedText>
          ) : null}
          {fb?.explanationVi ? (
            <ThemedText variant="caption" color="muted">
              {fb.explanationVi}
            </ThemedText>
          ) : null}
          {fb?.suggestions?.slice(0, 1).map((s, i) => (
            <ThemedText key={i} variant="caption" color="info">
              💡 {s.germanText}
            </ThemedText>
          ))}
        </View>
      ) : null}
    </View>
  )
}

function DifficultyDot({ difficulty }: { difficulty: string }) {
  const { colors } = useTheme()
  const dot =
    difficulty === 'ADVANCED' ? colors.danger : difficulty === 'INTERMEDIATE' ? colors.accent : colors.success
  const soft =
    difficulty === 'ADVANCED'
      ? colors.dangerSoft
      : difficulty === 'INTERMEDIATE'
        ? colors.accentSoft
        : colors.successSoft
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: radius.lg,
        backgroundColor: soft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ width: 12, height: 12, borderRadius: radius.full, backgroundColor: dot }} />
    </View>
  )
}

function difficultyLabel(difficulty: string): string {
  switch (difficulty) {
    case 'BEGINNER':
      return 'Cơ bản'
    case 'INTERMEDIATE':
      return 'Trung cấp'
    case 'ADVANCED':
      return 'Nâng cao'
    default:
      return difficulty
  }
}

function difficultyTone(difficulty: string): 'success' | 'accent' | 'danger' {
  switch (difficulty) {
    case 'ADVANCED':
      return 'danger'
    case 'INTERMEDIATE':
      return 'accent'
    default:
      return 'success'
  }
}

function mapMessagesToTurns(messages: AiSpeakingMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = []
  for (const m of messages) {
    const isUser = (m.role ?? '').toUpperCase() === 'USER'
    if (isUser) {
      if (m.userText) turns.push({ role: 'user', content: m.userText })
    } else if (m.aiSpeechDe) {
      turns.push({
        role: 'assistant',
        content: m.aiSpeechDe,
        feedback: {
          aiSpeechDe: m.aiSpeechDe,
          correction: m.correction,
          explanationVi: m.explanationVi,
          grammarPoint: m.grammarPoint,
          feedback: m.assistantFeedback,
          action: m.assistantAction,
          suggestions: [],
        },
      })
    }
  }
  return turns
}

function phaseLabel(phaseKey: string): string {
  switch (phaseKey) {
    case 'INTRO':
      return 'Giới thiệu'
    case 'ICE_BREAKER':
      return 'Khởi động'
    case 'HARD_SKILLS':
      return 'Chuyên môn'
    case 'STAR_SOFT':
      return 'Kỹ năng mềm'
    case 'CLOSING':
      return 'Kết thúc'
    default:
      return phaseKey
  }
}
