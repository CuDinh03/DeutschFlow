import { useState, useRef } from 'react'
import { View, ScrollView, Alert, Pressable } from 'react-native'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Audio } from 'expo-av'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { Mic, MicOff, MessageCircle, ChevronRight, Flame } from 'lucide-react-native'
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, cancelAnimation } from 'react-native-reanimated'
import api from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, Pill } from '@/components/ui'
import { usePlanStore } from '@/stores/usePlanStore'

interface Persona {
  id: number
  roleTitle: string
  difficulty: string
  description?: string
}

interface SessionMessage {
  role: 'user' | 'assistant'
  content: string
}

type DifficultyTone = 'success' | 'accent' | 'danger'

const PULSE_MAX = 1.2

export default function SpeakingScreen() {
  const theme = useTheme()
  const c = theme.colors
  const { isPro } = usePlanStore()
  const [activeSession, setActiveSession] = useState<number | null>(null)
  const [messages, setMessages] = useState<SessionMessage[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const recordingRef = useRef<Audio.Recording | null>(null)
  const pulseAnim = useSharedValue(1)

  const { data: personas = [] } = useQuery({
    queryKey: ['personas'],
    queryFn: () => api.get<Persona[]>('/interviews/personas').then((r) => r.data),
    staleTime: 300_000,
  })

  const startSession = useMutation({
    mutationFn: (personaId: number) =>
      api.post<{ sessionId: number; greeting: string }>('/speaking/sessions', { personaId }),
    onSuccess: (res) => {
      setActiveSession(res.data.sessionId)
      setMessages([{ role: 'assistant', content: res.data.greeting }])
    },
  })

  async function startRecording() {
    if (!isPro) {
      Alert.alert('Tính năng PRO', 'Nâng cấp PRO để luyện hội thoại với AI. Truy cập mydeutschflow.com để nâng cấp.')
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
    if (!recordingRef.current || !activeSession) return
    cancelAnimation(pulseAnim)
    pulseAnim.value = 1
    setIsRecording(false)
    setIsProcessing(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    try {
      const recording = recordingRef.current
      recordingRef.current = null
      await recording.stopAndUnloadAsync()
      const uri = recording.getURI()
      if (!uri) throw new Error('no_uri')

      const form = new FormData()
      form.append('audio', { uri, type: 'audio/m4a', name: 'recording.m4a' } as unknown as Blob)
      form.append('sessionId', String(activeSession))

      const res = await api.post<{ transcript: string; reply: string; audioUrl?: string }>(
        '/speaking/turn',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )

      setMessages((prev) => [
        ...prev,
        { role: 'user', content: res.data.transcript },
        { role: 'assistant', content: res.data.reply },
      ])
    } catch {
      Alert.alert('Lỗi', 'Không thể xử lý âm thanh. Thử lại nhé.')
    } finally {
      setIsProcessing(false)
    }
  }

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
    opacity: pulseAnim.value,
  }))

  if (!activeSession) {
    return (
      <Screen edges={['top']}>
        <View style={{ paddingHorizontal: space[5], paddingTop: space[3], paddingBottom: space[2], gap: 2 }}>
          <ThemedText variant="display">AI Speaking</ThemedText>
          <ThemedText variant="body" color="muted">
            Chọn đối tác hội thoại
          </ThemedText>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: space[6], gap: space[3], paddingTop: space[3] }}
          showsVerticalScrollIndicator={false}
        >
          {personas.map((persona) => {
            const locked = persona.difficulty === 'ADVANCED' && !isPro
            return (
              <Card
                key={persona.id}
                onPress={() =>
                  locked
                    ? Alert.alert('Cần PRO', 'Persona nâng cao chỉ dành cho PRO. Truy cập mydeutschflow.com')
                    : startSession.mutate(persona.id)
                }
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], flex: 1 }}>
                    <DifficultyDot difficulty={persona.difficulty} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <ThemedText variant="bodyStrong">{persona.roleTitle}</ThemedText>
                      <Pill label={difficultyLabel(persona.difficulty)} tone={difficultyTone(persona.difficulty)} />
                    </View>
                  </View>
                  {locked ? (
                    <Pill label="PRO" tone="accent" />
                  ) : (
                    <Icon icon={ChevronRight} size={18} color="faint" />
                  )}
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
      </Screen>
    )
  }

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
        <Pressable onPress={() => { setActiveSession(null); setMessages([]) }} hitSlop={8} style={{ marginRight: space[1] }}>
          <ThemedText variant="label" color="muted">
            Kết thúc
          </ThemedText>
        </Pressable>
        <Icon icon={MessageCircle} size={18} color="accent" />
        <ThemedText variant="bodyStrong">Phiên hội thoại</ThemedText>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: space[5], gap: space[3] }} showsVerticalScrollIndicator={false}>
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user'
          return (
            <View key={i} style={{ maxWidth: '85%', alignSelf: isUser ? 'flex-end' : 'flex-start' }}>
              <View
                style={{
                  backgroundColor: isUser ? c.accent : c.surface,
                  borderWidth: isUser ? 0 : 1,
                  borderColor: c.border,
                  borderRadius: radius['2xl'],
                  borderBottomRightRadius: isUser ? 6 : radius['2xl'],
                  borderBottomLeftRadius: isUser ? radius['2xl'] : 6,
                  paddingHorizontal: space[4],
                  paddingVertical: space[3],
                }}
              >
                <ThemedText variant="body" color={isUser ? 'onAccent' : 'primary'}>
                  {msg.content}
                </ThemedText>
              </View>
            </View>
          )
        })}
        {isProcessing ? (
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: radius['2xl'],
              borderBottomLeftRadius: 6,
              paddingHorizontal: space[4],
              paddingVertical: space[3],
            }}
          >
            <ThemedText variant="body" color="muted">
              Đang xử lý...
            </ThemedText>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ paddingBottom: space[8], alignItems: 'center', gap: space[2] }}>
        <Pressable onPressIn={startRecording} onPressOut={stopRecordingAndSend} disabled={isProcessing}>
          <Animated.View
            style={[
              isRecording ? pulseStyle : undefined,
              {
                width: 80,
                height: 80,
                borderRadius: radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isRecording ? c.danger : isProcessing ? c.surfaceElevated : c.accent,
              },
            ]}
          >
            {isRecording ? <Icon icon={MicOff} size={30} color="onAccent" /> : <Icon icon={Mic} size={30} color="onAccent" />}
          </Animated.View>
        </Pressable>
        <ThemedText variant="caption" color="muted">
          {isRecording ? 'Đang ghi âm… thả để gửi' : isProcessing ? 'Đang xử lý...' : 'Giữ để nói'}
        </ThemedText>
      </View>
    </Screen>
  )
}

function DifficultyDot({ difficulty }: { difficulty: string }) {
  const theme = useTheme()
  const tone = difficultyTone(difficulty)
  const soft: Record<DifficultyTone, string> = {
    success: theme.colors.successSoft,
    accent: theme.colors.accentSoft,
    danger: theme.colors.dangerSoft,
  }
  const dot: Record<DifficultyTone, string> = {
    success: theme.colors.success,
    accent: theme.colors.accent,
    danger: theme.colors.danger,
  }
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: radius.lg,
        backgroundColor: soft[tone],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ width: 12, height: 12, borderRadius: radius.full, backgroundColor: dot[tone] }} />
    </View>
  )
}

function difficultyTone(d: string): DifficultyTone {
  if (d === 'BEGINNER') return 'success'
  if (d === 'INTERMEDIATE') return 'accent'
  return 'danger'
}

function difficultyLabel(d: string): string {
  if (d === 'BEGINNER') return 'Cơ bản'
  if (d === 'INTERMEDIATE') return 'Trung cấp'
  return 'Nâng cao'
}
