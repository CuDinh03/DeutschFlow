import { useState, useRef, useEffect, useCallback, memo } from 'react'
import {
  View,
  ScrollView,
  Alert,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native'
import { Audio } from 'expo-av'
import * as FileSystem from 'expo-file-system'
import { MotiView } from 'moti'
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
  type AiChatResponse,
  type AiSpeakingSession,
  type AiSpeakingMessage,
  type InterviewReport,
  type ConversationReport,
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
import { ConversationSummary } from '@/components/speaking/ConversationSummary'
import { CompanionSelect, type StartArgs } from '@/components/speaking/CompanionSelect'
import { PersonaBubbleAvatar } from '@/components/speaking/PersonaBubbleAvatar'
import { RevealText } from '@/components/speaking/RevealText'
import { PersonaStage, type StageState, type Reaction } from '@/components/speaking/PersonaStage'
import { PERSONA_TOKENS, type PersonaId } from '@/lib/personas'
import { usePlanStore } from '@/stores/usePlanStore'
import { trackFeatureAction } from '@/lib/analytics'

const PULSE_MAX = 1.2

type ChatRole = 'user' | 'assistant'

interface ChatTurn {
  role: ChatRole
  content: string
  feedback?: AiChatResponse
}

type ScreenView = 'select' | 'chat' | 'summary'

// Map an AI turn to a transient persona reaction, gated by session mode.
function reactionFor(res: AiChatResponse, mode: string | null | undefined): Reaction {
  // Free conversation: no evaluation drama; grammar is surfaced as an end-of-turn note.
  if (mode === 'COMMUNICATION') return null
  // Default to 0.6 (→ "approve") when score is absent, to avoid over-praising.
  const score = res.similarityScore ?? 0.6
  const offTopic =
    (res.status ?? '').toUpperCase() === 'OFF_TOPIC' ||
    (res.action ?? '').toUpperCase().includes('OFF_TOPIC') ||
    (mode === 'INTERVIEW' && score < 0.35)
  if (offTopic) return 'offtopic'
  if (res.correction) return 'wrong'
  if (score >= 0.8) return 'praise'
  if (score >= 0.5) return 'approve'
  return null
}

export default function SpeakingScreen() {
  const theme = useTheme()
  const c = theme.colors
  const { isPro } = usePlanStore()

  const [view, setView] = useState<ScreenView>('select')
  const [session, setSession] = useState<AiSpeakingSession | null>(null)
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [phaseKey, setPhaseKey] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const [stage, setStage] = useState<StageState>('idle')
  const [reaction, setReaction] = useState<Reaction>(null)
  const [starting, setStarting] = useState(false)
  const [sending, setSending] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [report, setReport] = useState<InterviewReport | null>(null)
  const [convReport, setConvReport] = useState<ConversationReport | null>(null)
  const [pendingResume, setPendingResume] = useState<ActiveSessionRef | null>(null)
  const [resuming, setResuming] = useState(false)

  const recordingRef = useRef<Audio.Recording | null>(null)
  const soundRef = useRef<Audio.Sound | null>(null)
  const ttsSeqRef = useRef(0)
  const scrollRef = useRef<ScrollView | null>(null)
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reactionRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pulseAnim = useSharedValue(1)

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

  const busy = starting || sending || isRecording || finishing || typing || transcribing

  // Clear in-flight timers on unmount.
  useEffect(
    () => () => {
      if (typingRef.current) clearInterval(typingRef.current)
      if (reactionRef.current) clearTimeout(reactionRef.current)
      stopSpeech()
    },
    [],
  )

  // Keep the latest turn visible when the keyboard opens over the chat.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => scrollToEnd())
    return () => sub.remove()
  }, [])

  // Speak the AI's German line, cascading by availability so the flow never breaks:
  //   1. Server TTS (persona voice) → played via expo-av (no extra native module)
  //   2. On-device speech (expo-speech) if present in the binary
  //   3. Timed delay paced by text length
  // The persona "talks" for the audio duration, then runs onDone.
  async function speakGerman(text: string, onDone: () => void) {
    setStage('speaking')
    setReaction(null)
    let done = false
    const finish = () => {
      if (done) return
      done = true
      onDone()
    }
    const trimmed = text.trim()
    if (!trimmed) {
      setTimeout(finish, 600)
      return
    }

    // 1. Server TTS — persona voice, played through expo-av.
    try {
      const persona = (session?.persona ?? 'DEFAULT').toUpperCase()
      const base64 = await speakingApi.tts(trimmed, persona)
      await stopSpeech()
      const path = `${FileSystem.cacheDirectory}tts-${ttsSeqRef.current++}.mp3`
      await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 })
      // Reset out of iOS record mode so playback routes to the main speaker (loud),
      // not the earpiece. expo-av merges partial audio modes, so a prior
      // allowsRecordingIOS:true would otherwise stick app-wide and mute every reply
      // after the first recorded answer.
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true })
      const { sound } = await Audio.Sound.createAsync({ uri: path }, { shouldPlay: true })
      soundRef.current = sound
      sound.setOnPlaybackStatusUpdate((st) => {
        if (st.isLoaded && st.didJustFinish) {
          void sound.unloadAsync()
          if (soundRef.current === sound) soundRef.current = null
          finish()
        }
      })
      return
    } catch {
      // Provider not configured / playback failed — fall through.
    }

    // 2. On-device speech if the native module is in the binary.
    try {
      const Speech = require('expo-speech') as typeof import('expo-speech')
      Speech.stop()
      Speech.speak(trimmed, { language: 'de-DE', rate: 0.96, onDone: finish, onStopped: finish, onError: finish })
      return
    } catch {
      // 3. Neither available — pace by length so the flow never blocks.
      setTimeout(finish, Math.min(4200, 1200 + trimmed.length * 42))
    }
  }

  // Flash a transient reaction expression (praise/approve/wrong/offtopic) then settle.
  function flashReaction(r: Reaction) {
    if (reactionRef.current) clearTimeout(reactionRef.current)
    setStage('idle')
    setReaction(r)
    if (r) reactionRef.current = setTimeout(() => setReaction(null), 2400)
  }

  async function stopSpeech() {
    if (soundRef.current) {
      const s = soundRef.current
      soundRef.current = null
      try {
        await s.stopAsync()
        await s.unloadAsync()
      } catch {
        // already unloaded
      }
    }
    try {
      ;(require('expo-speech') as typeof import('expo-speech')).stop()
    } catch {
      // expo-speech not installed in this build — nothing to stop.
    }
  }
  const userTurns = messages.filter((m) => m.role === 'user').length

  const personaCode = session?.persona?.toLowerCase()
  const personaId: PersonaId =
    personaCode && personaCode in PERSONA_TOKENS ? (personaCode as PersonaId) : 'lukas'

  function scrollToEnd() {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }))
  }

  async function startSession(args: StartArgs) {
    setStarting(true)
    trackFeatureAction('ai_speaking', 'started', { mode: args.sessionMode })
    try {
      const created = await speakingApi.createSession({
        topic: args.topic,
        cefrLevel: args.cefrLevel,
        persona: args.persona.id.toUpperCase(),
        sessionMode: args.sessionMode,
        interviewPosition: args.interviewPosition ?? null,
        experienceLevel: args.experienceLevel ?? null,
      })
      const greeting = created.initialAiMessage?.aiSpeechDe ?? 'Hallo! Erzählen Sie mir von sich.'
      setSession(created)
      setPhaseKey(
        created.initialAiMessage?.interviewPhaseKey ??
          (args.sessionMode === 'INTERVIEW' ? 'INTRO' : null),
      )
      setMessages([{ role: 'assistant', content: greeting, feedback: created.initialAiMessage ?? undefined }])
      setReport(null)
      setPendingResume(null)
      void saveActiveSession({
        id: created.id,
        interviewPosition: created.interviewPosition,
        persona: created.persona,
        sessionMode: created.sessionMode,
        cefrLevel: created.cefrLevel,
        topic: created.topic,
      })
      setView('chat')
      speakGerman(greeting, () => flashReaction(null))
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
    setStage('thinking')
    setReaction(null)
    scrollToEnd()
    try {
      const res = await speakingApi.chat(session.id, trimmed)
      setMessages((prev) => [...prev, { role: 'assistant', content: res.aiSpeechDe ?? '…', feedback: res }])
      if (res.interviewPhaseKey) setPhaseKey(res.interviewPhaseKey)
      const r = reactionFor(res, session.sessionMode)
      speakGerman(res.aiSpeechDe ?? '', () => {
        flashReaction(r)
        if (r === 'praise') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        else if (r === 'wrong' || r === 'offtopic')
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      })
      scrollToEnd()
      if (res.isSessionEnded) await finishSession()
    } catch (e) {
      setStage('idle')
      Alert.alert('Lỗi', apiMessage(e))
    } finally {
      setSending(false)
    }
  }

  // Type a suggested reply into the input bar character-by-character, then auto-send.
  function useSuggestion(text: string) {
    if (busy || !session) return
    if (typingRef.current) clearInterval(typingRef.current)
    void Haptics.selectionAsync()
    setTyping(true)
    setDraft('')
    let i = 0
    typingRef.current = setInterval(() => {
      i += 1
      setDraft(text.slice(0, i))
      scrollToEnd()
      if (i >= text.length) {
        if (typingRef.current) clearInterval(typingRef.current)
        typingRef.current = null
        setTimeout(() => {
          setTyping(false)
          void submitAnswer(text)
        }, 450)
      }
    }, 26)
  }

  // Stable identity so memoized MessageBubbles don't re-render on every keystroke.
  const useSuggestionRef = useRef(useSuggestion)
  useSuggestionRef.current = useSuggestion
  const onUseSuggestion = useCallback((text: string) => useSuggestionRef.current(text), [])

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
      setStage('listening')
      setReaction(null)
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      pulseAnim.value = withRepeat(withTiming(PULSE_MAX, { duration: 800 }), -1, true)
    } catch {
      Alert.alert('Lỗi', 'Không thể khởi động microphone. Vui lòng kiểm tra quyền truy cập.')
    }
  }

  // Stop recording and drop the transcript into the input bar for review.
  // The user edits if needed and presses send — we never auto-submit speech.
  async function stopRecordingAndTranscribe() {
    if (!recordingRef.current || !session) return
    cancelAnimation(pulseAnim)
    pulseAnim.value = 1
    setIsRecording(false)
    setStage('idle')
    setTranscribing(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    try {
      const recording = recordingRef.current
      recordingRef.current = null
      await recording.stopAndUnloadAsync()
      // Leave record mode so the next TTS reply plays from the speaker, not the earpiece.
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true })
      const uri = recording.getURI()
      if (!uri) throw new Error('no_uri')
      const transcript = (await speakingApi.transcribe(uri)).trim()
      if (!transcript) {
        Alert.alert('Chưa nghe rõ', 'Mình chưa nhận được nội dung. Bạn thử ghi âm lại nhé.')
        return
      }
      setDraft(transcript)
      scrollToEnd()
    } catch (e) {
      Alert.alert('Lỗi', apiMessage(e))
    } finally {
      setTranscribing(false)
    }
  }

  async function finishSession() {
    if (!session || finishing) return
    setFinishing(true)
    trackFeatureAction('ai_speaking', 'completed', { mode: session.sessionMode })
    try {
      await speakingApi.endSession(session.id).catch(() => undefined)
      void clearActiveSession()
      if (session.sessionMode === 'INTERVIEW') {
        const built = await speakingApi.getReport(session.id)
        setReport(built)
        setView('summary')
      } else {
        // Conversation / lesson: show the AI evaluation summary (fall back to select if empty).
        const conv = await speakingApi.getConversationReport(session.id).catch(() => null)
        const hasContent =
          !!conv &&
          (!!conv.summary ||
            conv.strengths.length > 0 ||
            conv.improvements.length > 0 ||
            conv.overallScore != null)
        if (conv && hasContent) {
          setConvReport(conv)
          setView('summary')
        } else {
          setSession(null)
          setMessages([])
          setPhaseKey(null)
          setView('select')
        }
      }
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
    setConvReport(null)
    setPhaseKey(null)
    setDraft('')
    setPendingResume(null)
    if (reactionRef.current) clearTimeout(reactionRef.current)
    stopSpeech()
    setStage('idle')
    setReaction(null)
    void clearActiveSession()
    setView('select')
  }

  // Top-left ✕ during a chat: if the learner has already spoken, end the session
  // and take them to the post-session evaluation (the Flag button alone was too
  // easy to miss). Nothing said yet → just leave (nothing to evaluate).
  function handleClose() {
    if (finishing) return
    if (userTurns === 0) {
      resetToSelect()
      return
    }
    Alert.alert('Kết thúc buổi nói?', 'Bạn sẽ nhận được đánh giá sau khi nói.', [
      { text: 'Tiếp tục', style: 'cancel' },
      { text: 'Xem đánh giá', onPress: () => void finishSession() },
    ])
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
      // Restore the session's REAL mode/level — never assume INTERVIEW, or a resumed
      // conversation/lesson would mislabel and crash on finish (getReport is interview-only).
      const resumedMode = ref.sessionMode ?? 'COMMUNICATION'
      setSession({
        id: ref.id,
        topic: ref.topic ?? ref.interviewPosition,
        cefrLevel: ref.cefrLevel ?? 'B1',
        persona: ref.persona ?? null,
        responseSchema: null,
        sessionMode: resumedMode,
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
        <SessionSummary report={report} onPracticeAgain={resetToSelect} onDone={() => router.replace('/(student)')} />
      </Screen>
    )
  }

  if (view === 'summary' && convReport) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Kết quả luyện nói" onClose={resetToSelect} />
        <ConversationSummary report={convReport} onPracticeAgain={resetToSelect} onDone={() => router.replace('/(student)')} />
      </Screen>
    )
  }

  // ── Persona selection ────────────────────────────────────────────────────────
  if (view === 'select') {
    return (
      <Screen edges={['top']}>
        {pendingResume ? (
          <View style={{ paddingHorizontal: space[5], paddingTop: space[3] }}>
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
                    <ThemedText variant="bodyStrong">Tiếp tục buổi học</ThemedText>
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
          </View>
        ) : null}

        <CompanionSelect isPro={isPro} starting={starting} onStart={startSession} />
      </Screen>
    )
  }

  // ── Chat / practice view ─────────────────────────────────────────────────────
  return (
    <Screen edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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
        <Pressable hitSlop={8} onPress={handleClose}>
          <Icon icon={X} size={22} color="muted" />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText variant="bodyStrong" numberOfLines={1}>
            {session?.sessionMode === 'INTERVIEW'
              ? session?.interviewPosition ?? 'Phỏng vấn'
              : session?.topic ?? 'Hội thoại'}
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

      <PersonaStage personaId={personaId} stage={stage} reaction={reaction} />

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space[5], paddingVertical: space[4], gap: space[3] }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToEnd}
      >
        {messages.map((msg, i) => {
          const isLastAssistant = i === messages.length - 1 && msg.role === 'assistant'
          return (
            <MessageBubble
              key={i}
              turn={msg}
              personaId={personaId}
              active={isLastAssistant && stage === 'speaking'}
              onUseSuggestion={onUseSuggestion}
            />
          )
        })}
        {finishing && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], paddingLeft: space[2] }}>
            <ActivityIndicator color={c.textMuted} size="small" />
            <ThemedText variant="caption" color="muted">
              Đang tạo báo cáo…
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
            onPress={isRecording ? stopRecordingAndTranscribe : startRecording}
            disabled={sending || finishing || transcribing}
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.full,
              backgroundColor: isRecording ? c.danger : c.surfaceSunken,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {transcribing ? (
              <ActivityIndicator color={c.textMuted} size="small" />
            ) : (
              <Icon icon={Mic} size={20} color={isRecording ? 'onAccent' : 'muted'} />
            )}
          </Pressable>
        </Animated.View>

        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={transcribing ? 'Đang nhận diện giọng nói…' : 'Nhập câu trả lời của bạn…'}
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
      </KeyboardAvoidingView>
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

const MessageBubble = memo(function MessageBubble({
  turn,
  personaId,
  active = false,
  onUseSuggestion,
}: {
  turn: ChatTurn
  personaId: PersonaId
  active?: boolean
  onUseSuggestion?: (text: string) => void
}) {
  const { colors } = useTheme()
  const isUser = turn.role === 'user'
  const fb = turn.feedback
  const hasFeedback = !isUser && fb && (fb.correction || (fb.suggestions?.length ?? 0) > 0)

  const inner = (
    <View style={{ flex: isUser ? undefined : 1, alignItems: isUser ? 'flex-end' : 'flex-start', gap: space[2] }}>
      <View
        style={{
          maxWidth: '92%',
          backgroundColor: isUser ? colors.accent : colors.surfaceElevated,
          borderRadius: radius.lg,
          borderBottomRightRadius: isUser ? radius.sm : radius.lg,
          borderBottomLeftRadius: isUser ? radius.lg : radius.sm,
          paddingHorizontal: space[4],
          paddingVertical: space[3],
        }}
      >
        {isUser ? (
          <ThemedText variant="body" color="onAccent">
            {turn.content}
          </ThemedText>
        ) : (
          <RevealText text={turn.content} active={active} variant="body" color="primary" />
        )}
      </View>

      {hasFeedback ? (
        <View style={{ maxWidth: '92%', gap: space[2] }}>
          {fb?.correction ? (
            <View
              style={{
                backgroundColor: colors.successSoft,
                borderRadius: radius.md,
                borderLeftWidth: 3,
                borderLeftColor: colors.success,
                paddingHorizontal: space[3],
                paddingVertical: space[3],
                gap: space[2],
              }}
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}
              >
                <ThemedText variant="label" color="success">
                  ✍️ Nên nói
                </ThemedText>
                {fb.grammarPoint ? <Pill label={fb.grammarPoint} tone="success" /> : null}
              </View>
              <ThemedText variant="bodyStrong" color="primary">
                {fb.correction}
              </ThemedText>
              {fb.explanationVi ? (
                <ThemedText variant="caption" color="muted">
                  {fb.explanationVi}
                </ThemedText>
              ) : null}
            </View>
          ) : null}

          {fb?.suggestions?.slice(0, 1).map((s, i) => (
            <Pressable
              key={i}
              onPress={() => onUseSuggestion?.(s.germanText)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[2],
                backgroundColor: colors.infoSoft,
                borderRadius: radius.sm,
                paddingHorizontal: space[3],
                paddingVertical: space[2],
              }}
            >
              <ThemedText variant="caption" color="info" style={{ flex: 1 }}>
                💡 {s.germanText}
              </ThemedText>
              <ThemedText variant="label" color="info">
                Dùng →
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )

  return (
    <MotiView
      from={{ opacity: 0, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260 }}
    >
      {isUser ? (
        inner
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
          <PersonaBubbleAvatar personaId={personaId} size={36} paused />
          {inner}
        </View>
      )}
    </MotiView>
  )
})

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
