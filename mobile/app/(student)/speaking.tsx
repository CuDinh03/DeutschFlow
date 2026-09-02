import { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  ScrollView,
  Alert,
  Linking,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native'
import { createAudioPlayer, useAudioRecorder, AudioModule, RecordingPresets, setAudioModeAsync, type AudioPlayer } from 'expo-audio'
import * as FileSystem from 'expo-file-system/legacy'
import * as Haptics from 'expo-haptics'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Mic, Send, ChevronRight, Flame, X, Flag, RotateCcw } from 'lucide-react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated'
import { handleAiError } from '@/lib/upsell'
import { ensureAiConsent } from '@/lib/aiConsent'
import { useRecorderBlurGuard } from '@/hooks/useRecorderBlurGuard'
import { useBlurGuard } from '@/hooks/useBlurGuard'
import {
  speakingApi,
  isUnlimitedQuota,
  type SpeakingSessionMode,
  type AiSpeakingSession,
  type AiChatResponse,
  type InterviewReport,
  type ConversationReport,
  type AiSpeakingQuota,
} from '@/lib/speakingApi'
import {
  loadActiveSession,
  saveActiveSession,
  clearActiveSession,
  type ActiveSessionRef,
} from '@/lib/activeSession'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon } from '@/components/ui'
import { SessionSummary } from '@/components/speaking/SessionSummary'
import { ConversationSummary } from '@/components/speaking/ConversationSummary'
import { CompanionSelect, type StartArgs } from '@/components/speaking/CompanionSelect'
import { PersonaStage, type StageState, type Reaction } from '@/components/speaking/PersonaStage'
import { MessageBubble } from '@/components/speaking/MessageBubble'
import { ScreenHeader } from '@/components/speaking/ScreenHeader'
import { PERSONA_TOKENS, type PersonaId } from '@/lib/personas'
import {
  reactionFor,
  emptyConversationReport,
  mapMessagesToTurns,
  phaseLabel,
  makeUserTurn,
  setTurnStatus,
  attachFeedbackToTurn,
  mergeFailedTurns,
  newTurnId,
  type ChatTurn,
  type ScreenView,
} from '@/lib/speakingChat'
import { isTransientFailure } from '@/lib/api'
import { usePlanStore } from '@/stores/usePlanStore'
import { useTourStore } from '@/stores/useTourStore'
import { useStarterStore } from '@/stores/useStarterStore'
import { useSpotlightTour } from '@/components/guide/SpotlightTour'
import { trackFeatureAction } from '@/lib/analytics'

const PULSE_MAX = 1.2

export default function SpeakingScreen() {
  const theme = useTheme()
  const c = theme.colors
  const insets = useSafeAreaInsets()
  const { hasProAccess } = usePlanStore()

  // Onboarding (and deep links) can preselect a speaking mode — e.g. the
  // INTERVIEW_FIRST archetype routes here as `?mode=INTERVIEW`.
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>()
  const initialMode: SpeakingSessionMode | undefined =
    modeParam === 'INTERVIEW' || modeParam === 'LESSON' || modeParam === 'COMMUNICATION'
      ? modeParam
      : undefined

  const [view, setView] = useState<ScreenView>('select')
  const [session, setSession] = useState<AiSpeakingSession | null>(null)
  const [messages, setMessages] = useState<ChatTurn[]>([])
  // Async gửi/nhận đóng băng `messages` trong closure → dùng ref để retryTurn đọc turn hiện tại (MB-3).
  const messagesRef = useRef<ChatTurn[]>([])
  useEffect(() => { messagesRef.current = messages }, [messages])
  const [phaseKey, setPhaseKey] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const [stage, setStage] = useState<StageState>('idle')
  const [reaction, setReaction] = useState<Reaction>(null)
  const [starting, setStarting] = useState(false)
  const [quota, setQuota] = useState<AiSpeakingQuota | null>(null)

  // R-M9: nạp số dư lượt AI mỗi khi về màn chọn — hiển thị TRƯỚC khi user soạn câu/ghi âm, thay vì để
  // họ đập tường 429 sau khi đã mất công. Lỗi mạng thì nuốt (pill chỉ ẩn, không chặn luồng).
  useEffect(() => {
    if (view !== 'select') return
    let alive = true
    speakingApi.getQuota().then((q) => { if (alive) setQuota(q) }).catch(() => {})
    return () => { alive = false }
  }, [view])
  const [sending, setSending] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [report, setReport] = useState<InterviewReport | null>(null)
  const [convReport, setConvReport] = useState<ConversationReport | null>(null)
  const [pendingResume, setPendingResume] = useState<ActiveSessionRef | null>(null)
  const [resuming, setResuming] = useState(false)

  // Coach mark ngữ cảnh (onboarding v1 §6): lần đầu vào tab Speaking sau tour
  // chính → 1 spotlight chỉ vào hàng chọn cách luyện. Bắn đúng 1 lần.
  const { startTour, activeTourId } = useSpotlightTour()
  const tourHydrated = useTourStore((s) => s.hydrated)
  const tourDone = useTourStore((s) => s.done)
  useFocusEffect(
    useCallback(() => {
      if (view !== 'select' || !tourHydrated || !tourDone.home || tourDone.speaking_intro || activeTourId) return
      const t = setTimeout(() => startTour('speaking_intro', 'auto'), 600)
      return () => clearTimeout(t)
    }, [view, tourHydrated, tourDone.home, tourDone.speaking_intro, activeTourId, startTour]),
  )

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const soundRef = useRef<AudioPlayer | null>(null)
  const ttsSeqRef = useRef(0)
  const ttsPathRef = useRef<string | null>(null)
  const scrollRef = useRef<ScrollView | null>(null)
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reactionRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pulseAnim = useSharedValue(1)

  // F-9 (soát 02/09): màn này là bottom-tab — chuyển tab KHÔNG unmount, nên nếu
  // đang ghi mà người dùng đi tab khác thì mic ghi tiếp vô thời hạn. Guard theo
  // blur tự dừng recorder + thoát record mode; bản ghi dở bị bỏ, UI trả về idle.
  useRecorderBlurGuard(recorder, () => {
    cancelAnimation(pulseAnim)
    pulseAnim.value = 1
    setIsRecording(false)
    setStage('idle')
  })

  // Cùng lớp với F-9 nhưng cho LOA: mic đã có guard, còn giọng AI đang phát thì
  // không — chuyển tab là persona cứ nói tiếp. Blur = dừng tiếng ngay; player bị
  // remove() sẽ không bao giờ bắn didJustFinish → onDone của lượt đó không chạy,
  // nên phải tự chốt stage về idle kẻo persona kẹt "đang nói" khi quay lại.
  const focusedRef = useBlurGuard(() => {
    void stopSpeech()
    setStage((s) => (s === 'speaking' ? 'idle' : s))
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

  const busy = starting || sending || isRecording || finishing || typing || transcribing

  // Clear in-flight timers on unmount.
  useEffect(
    () => () => {
      if (typingRef.current) clearInterval(typingRef.current)
      if (reactionRef.current) clearTimeout(reactionRef.current)
      if (speakTimerRef.current) clearTimeout(speakTimerRef.current)
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
  //   1. Server TTS (persona voice) → played via expo-audio
  //   2. On-device speech (expo-speech) if present in the binary
  //   3. Timed delay paced by text length
  // The persona "talks" for the audio duration, then runs onDone.
  async function speakGerman(text: string, onDone: () => void, personaOverride?: string | null) {
    if (!focusedRef.current) {
      // Phản hồi AI về sau khi người dùng đã sang tab khác: không phát tiếng,
      // chốt luồng ngay để transcript/reaction vẫn tự settle trong nền.
      onDone()
      return
    }
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
      if (speakTimerRef.current) clearTimeout(speakTimerRef.current)
      speakTimerRef.current = setTimeout(finish, 600)
      return
    }

    // 1. Server TTS — persona voice, played through expo-audio.
    try {
      // On the opening greeting `session` state hasn't flushed yet (startSession just
      // called setSession), so the caller passes the fresh persona explicitly. Without
      // it the first line always fell back to the DEFAULT voice regardless of persona.
      const persona = (personaOverride ?? session?.persona ?? 'DEFAULT').toUpperCase()
      const base64 = await speakingApi.tts(trimmed, persona)
      await stopSpeech()
      const path = `${FileSystem.cacheDirectory}tts-${ttsSeqRef.current++}.mp3`
      ttsPathRef.current = path
      await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 })
      // Reset out of iOS record mode so playback routes to the main speaker (loud),
      // not the earpiece. The audio mode merges partial settings, so a prior
      // allowsRecording:true would otherwise stick app-wide and mute every reply
      // after the first recorded answer.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true })
      const player = createAudioPlayer({ uri: path })
      soundRef.current = player
      player.addListener('playbackStatusUpdate', (st) => {
        if (st.didJustFinish) {
          player.remove()
          void FileSystem.deleteAsync(path, { idempotent: true })
          if (soundRef.current === player) soundRef.current = null
          finish()
        }
      })
      player.play()
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
      if (speakTimerRef.current) clearTimeout(speakTimerRef.current)
      speakTimerRef.current = setTimeout(finish, Math.min(4200, 1200 + trimmed.length * 42))
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
    if (speakTimerRef.current) {
      clearTimeout(speakTimerRef.current)
      speakTimerRef.current = null
    }
    if (soundRef.current) {
      const s = soundRef.current
      soundRef.current = null
      const pathToDelete = ttsPathRef.current
      ttsPathRef.current = null
      try {
        s.remove()
        if (pathToDelete) void FileSystem.deleteAsync(pathToDelete, { idempotent: true })
      } catch {
        // already released
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
    // 5.1.1(i): the whole conversation (voice + typed text) is processed by a third-party
    // AI (Groq/OpenAI) — disclose & get consent before the session ever starts.
    if (!(await ensureAiConsent())) return
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
      // Checklist "Bắt đầu" (§7.1): tick "Thử 1 buổi Speaking" khi tạo phiên thành công.
      useStarterStore.getState().markSpeakingSession()
      setSession(created)
      setPhaseKey(
        created.initialAiMessage?.interviewPhaseKey ??
          (args.sessionMode === 'INTERVIEW' ? 'INTRO' : null),
      )
      setMessages([{ id: newTurnId(), role: 'assistant', content: greeting, feedback: created.initialAiMessage ?? undefined }])
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
      speakGerman(greeting, () => flashReaction(null), created.persona)
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    } catch (e) {
      handleAiError(e, 'Không thể bắt đầu')
    } finally {
      setStarting(false)
    }
  }

  // Gom side-effect của 1 lượt AI thành công (phase, reaction+TTS+haptics, scroll). Tách để cả
  // deliverTurn lẫn nhánh reconcile (adopt transcript server khi retry) dùng chung.
  function applyAiTurnSideEffects(res: AiChatResponse) {
    if (res.interviewPhaseKey) setPhaseKey(res.interviewPhaseKey)
    const r = reactionFor(res, session?.sessionMode)
    speakGerman(res.aiSpeechDe ?? '', () => {
      flashReaction(r)
      if (r === 'praise') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      else if (r === 'wrong' || r === 'offtopic')
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    })
    scrollToEnd()
  }

  // Lõi gửi 1 lượt (submit + retry cùng dùng). Turn user đã nằm trong `messages` với id ổn định;
  // ta chỉ đổi status của NÓ (sent/failed) thay vì mồ côi — R-M3.
  async function deliverTurn(turnId: string, content: string) {
    if (!session) return
    setSending(true)
    setStage('thinking')
    setReaction(null)
    scrollToEnd()
    try {
      // R-M5: chống double-charge bằng khoá CHÍNH XÁC, không phải khớp-mờ. `turnId` (ổn định qua mọi
      // lần Gửi lại của lượt này) đi kèm làm clientTurnId — lượt đã xong trên server → backend replay
      // response cũ (không gọi LLM, không trừ quota); lượt chưa xong → xử lý mới.
      //
      // Bỏ pre-check `serverHasUserText` (khớp-mờ theo nội dung) của #259: nó FALSE-POSITIVE khi hai
      // lượt trùng text (vd người dùng nói "Ja" hai lần) → bỏ NHẦM câu mới và replay câu cũ, im lặng.
      // Khoá chính xác thay thế nó đúng đắn hơn. (Đánh đổi: Redis vắng thì backend không dedup, retry
      // có thể trừ quota lần nữa — hiếm và deploy có Redis; chấp nhận để KHÔNG bao giờ nuốt câu user.)
      const res = await speakingApi.chat(session.id, content, turnId)
      // Gắn feedback (correction) vào ĐÚNG user turn theo id + đánh dấu 'sent', rồi thêm turn AI.
      setMessages((prev) => [
        ...attachFeedbackToTurn(setTurnStatus(prev, turnId, 'sent'), turnId, res),
        { id: newTurnId(), role: 'assistant', content: res.aiSpeechDe ?? '…', feedback: res },
      ])
      applyAiTurnSideEffects(res)
      if (res.isSessionEnded) await finishSession()
    } catch (e) {
      // R-M3: KHÔNG mồ côi — giữ câu user, đánh dấu 'failed' (kèm có nên tự thử lại) để hiện nút Gửi lại.
      setMessages((prev) => setTurnStatus(prev, turnId, 'failed', isTransientFailure(e)))
      setStage('idle')
      handleAiError(e)
    } finally {
      setSending(false)
    }
  }

  async function submitAnswer(text: string) {
    const trimmed = text.trim()
    if (!trimmed || !session || sending) return
    // 5.1.1(i): a resumed session can run after consent was revoked in Profile — re-check before
    // sending typed text to the third-party AI. Instant no-op when consent is already granted.
    if (!(await ensureAiConsent())) return
    // Câu nằm trong turn 'sending' (có nút Gửi lại nếu fail) → xoá draft an toàn, không còn mất câu.
    const turn = makeUserTurn(trimmed)
    setDraft('')
    setMessages((prev) => [...prev, turn])
    await deliverTurn(turn.id, trimmed)
  }

  // Gửi lại 1 lượt đã fail (nút trong bubble). Reconcile trước để không double-charge (R-M5).
  async function retryTurn(id: string) {
    if (sending || !session) return
    const turn = messagesRef.current.find((t) => t.id === id)
    if (!turn || turn.status !== 'failed') return
    if (!(await ensureAiConsent())) return
    setMessages((prev) => setTurnStatus(prev, id, 'sending'))
    await deliverTurn(id, turn.content)
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
    if (!hasProAccess) {
      Alert.alert('Tính năng nâng cao', 'Trả lời bằng giọng nói cần tài khoản nâng cao. Bạn vẫn có thể gõ câu trả lời.')
      return
    }
    // 5.1.1(i): the recording is transcribed by a third-party AI — disclose & get consent first.
    if (!(await ensureAiConsent())) return
    try {
      // Honour the permission result. The previous code discarded `status`, so a hard
      // denial fell through to a generic catch-all error with no way for the user to
      // fix it — iOS won't re-prompt after first denial, the only path is Settings.
      const { status, canAskAgain } = await AudioModule.requestRecordingPermissionsAsync()
      if (status !== 'granted') {
        if (!canAskAgain) {
          Alert.alert(
            'Cần quyền microphone',
            'Hãy bật microphone trong Cài đặt để luyện nói.',
            [
              { text: 'Để sau', style: 'cancel' },
              { text: 'Mở Cài đặt', onPress: () => { void Linking.openSettings() } },
            ],
          )
        } else {
          Alert.alert('Không có quyền microphone', 'Bạn cần cấp quyền để ghi âm.')
        }
        return
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()
      recorder.record()
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
    if (!isRecording || !session) return
    cancelAnimation(pulseAnim)
    pulseAnim.value = 1
    setIsRecording(false)
    setStage('idle')
    setTranscribing(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    try {
      await recorder.stop()
      // Leave record mode so the next TTS reply plays from the speaker, not the earpiece.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true })
      const uri = recorder.uri
      if (!uri) throw new Error('no_uri')
      const transcript = (await speakingApi.transcribe(uri)).trim()
      if (!transcript) {
        Alert.alert('Chưa nghe rõ', 'Mình chưa nhận được nội dung. Bạn thử ghi âm lại nhé.')
        return
      }
      setDraft(transcript)
      scrollToEnd()
    } catch (e) {
      handleAiError(e)
    } finally {
      setTranscribing(false)
    }
  }

  async function finishSession() {
    if (!session || finishing) return
    setFinishing(true)
    trackFeatureAction('ai_speaking', 'completed', { mode: session.sessionMode })

    // R-M7: buổi nói phải ĐÓNG XONG trên server TRƯỚC khi ta xoá tham chiếu resume và hiện tổng kết.
    // Trước đây `endSession(...).catch(() => undefined)` nuốt lỗi rồi vẫn `clearActiveSession()` +
    // hiện summary. Nếu end hỏng (mạng/timeout/5xx): (a) phiên còn ACTIVE trên server nhưng client
    // mất tham chiếu → user KHÔNG resume được nữa; (b) báo cáo đọc ra là của phiên CHƯA đóng → sai.
    // Backend `PATCH /end` idempotent với phiên đã ENDED (kể cả đường auto-finish CLOSING_FAREWELL)
    // nên gọi lại an toàn — chỉ ném khi lỗi thật.
    try {
      await speakingApi.endSession(session.id)
    } catch (e) {
      // Phiên VẪN active + activeSession còn nguyên → user tiếp tục nói hoặc bấm Kết thúc lại được.
      handleAiError(e, 'Chưa kết thúc được buổi nói')
      setFinishing(false)
      return
    }

    // End thành công (điểm đã chấm + lưu server): giờ mới an toàn xoá tham chiếu resume.
    // Từ đây phiên KHÔNG còn active — lỗi đọc báo cáo không được giữ lại activeSession nữa
    // (giữ nguyên hành vi báo cáo cũ; đây KHÔNG phải phạm vi R-M7).
    void clearActiveSession()
    try {
      if (session.sessionMode === 'INTERVIEW') {
        const built = await speakingApi.getReport(session.id)
        setReport(built)
        setView('summary')
      } else {
        // Conversation / lesson: ALWAYS land on the evaluation view. When the AI report
        // is unavailable (LLM/quota hiccup) the backend returns an empty report — show a
        // graceful fallback summary instead of silently dumping the learner back to select.
        const conv = await speakingApi.getConversationReport(session.id).catch(() => null)
        setConvReport(conv ?? emptyConversationReport(session))
        setView('summary')
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (e) {
      handleAiError(e, 'Không tải được báo cáo')
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
      // Server là chân lý cho mọi turn đã persist, nhưng GIỮ user turn 'failed' (chưa lên server) để
      // user còn Gửi lại sau resume — thay vì bốc hơi như trước (R-M3). Câu đã lưu sẽ trùng → bị loại.
      setMessages((prev) => mergeFailedTurns(turns, prev))
      setPhaseKey(null)
      setReport(null)
      setPendingResume(null)
      setView('chat')
      scrollToEnd()
    } catch (e) {
      handleAiError(e, 'Không thể tiếp tục')
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
                  accessibilityRole="button"
                  accessibilityLabel="Tiếp tục buổi học"
                  accessibilityState={{ disabled: resuming }}
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
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Bỏ qua buổi học dang dở"
                    hitSlop={8}
                    onPress={dismissResume}
                  >
                    <Icon icon={X} size={18} color="faint" />
                  </Pressable>
                )}
              </View>
            </Card>
          </View>
        ) : null}

        {/* Lối vào Luyện thi Nói (cụm màn mới 02/09 — thiết kế đã chốt) */}
        <View style={{ paddingHorizontal: space[5], paddingTop: space[3] }}>
          <Card
            onPress={() => router.push('/(student)/speaking-exam')}
            accessibilityLabel="Mở Luyện thi Nói Goethe"
            style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <View style={{ width: 7, height: 7, backgroundColor: c.accent }} />
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText variant="bodyStrong" style={{ color: c.onInk }}>Luyện thi Nói · Goethe</ThemedText>
                <ThemedText variant="caption" style={{ color: c.onInkMuted }}>
                  Thi thử đủ các Teil, chấm theo rubric 4 tiêu chí
                </ThemedText>
              </View>
              <Icon icon={ChevronRight} size={18} color="onInk" />
            </View>
          </Card>
        </View>

        {quota && !isUnlimitedQuota(quota) ? (
          <View style={{ paddingHorizontal: space[5], paddingTop: space[3] }}>
            <View
              style={{
                alignSelf: 'flex-start',
                paddingHorizontal: space[3],
                paddingVertical: space[1],
                borderRadius: radius.full,
                backgroundColor: quota.canStartSession ? c.surface : c.dangerSoft,
                borderWidth: 1,
                borderColor: quota.canStartSession ? c.border : c.danger,
              }}
            >
              <ThemedText variant="caption" color={quota.canStartSession ? 'muted' : 'danger'}>
                {quota.canStartSession
                  ? `Còn ~${Math.max(0, Math.round(quota.remainingSpendable)).toLocaleString('vi-VN')} lượt AI`
                  : quota.orgBudget
                    ? 'Ngân sách AI của trung tâm đã hết hoặc chưa được cấp — liên hệ quản trị trung tâm'
                    : 'Đã dùng hết lượt AI — nâng cấp để tiếp tục'}
              </ThemedText>
            </View>
          </View>
        ) : null}

        <CompanionSelect isPro={hasProAccess} starting={starting} onStart={startSession} initialMode={initialMode} />
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
        <Pressable accessibilityRole="button" accessibilityLabel="Đóng" hitSlop={8} onPress={handleClose}>
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
          accessibilityRole="button"
          accessibilityLabel="Kết thúc và xem đánh giá"
          accessibilityState={{ disabled: finishing || userTurns === 0 }}
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
              key={msg.id}
              turn={msg}
              personaId={personaId}
              active={isLastAssistant && stage === 'speaking'}
              onUseSuggestion={onUseSuggestion}
              onRetry={msg.status === 'failed' ? () => void retryTurn(msg.id) : undefined}
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
          paddingBottom: insets.bottom > 0 ? insets.bottom : space[4],
          borderTopWidth: 1,
          borderTopColor: c.border,
          backgroundColor: c.surface,
        }}
      >
        <Animated.View style={isRecording ? pulseStyle : undefined}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isRecording ? 'Dừng ghi âm' : 'Ghi âm câu trả lời'}
            accessibilityState={{ disabled: sending || finishing || transcribing }}
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
            fontFamily: fonts.bodyRegular,
            fontSize: 15,
          }}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Gửi câu trả lời"
          accessibilityState={{ disabled: !draft.trim() || busy }}
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
