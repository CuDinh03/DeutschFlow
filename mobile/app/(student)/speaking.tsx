import { useState, useRef, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Audio } from 'expo-av'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { Mic, MicOff, MessageCircle, ChevronRight, Flame } from 'lucide-react-native'
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, cancelAnimation } from 'react-native-reanimated'
import api from '@/lib/api'
import { Colors } from '@/lib/constants'
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

export default function SpeakingScreen() {
  const { isPro } = usePlanStore()
  const [activeSession, setActiveSession] = useState<number | null>(null)
  const [messages, setMessages] = useState<SessionMessage[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const recordingRef = useRef<Audio.Recording | null>(null)
  const pulseAnim = useSharedValue(1)

  const { data: personas = [] } = useQuery({
    queryKey: ['personas'],
    queryFn: () => api.get<Persona[]>('/interviews/personas').then(r => r.data),
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
      pulseAnim.value = withRepeat(withTiming(1.2, { duration: 800 }), -1, true)
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

      // Build multipart form — send audio to speaking endpoint
      const form = new FormData()
      form.append('audio', { uri, type: 'audio/m4a', name: 'recording.m4a' } as unknown as Blob)
      form.append('sessionId', String(activeSession))

      const res = await api.post<{ transcript: string; reply: string; audioUrl?: string }>(
        '/speaking/turn',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )

      setMessages(prev => [
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

  // Session not started — show persona picker
  if (!activeSession) {
    return (
      <SafeAreaView className="flex-1 bg-[#0D0D0D]">
        <View className="px-5 pt-4 pb-2">
          <Text className="text-white text-2xl font-bold">AI Speaking</Text>
          <Text className="text-[#64748B] text-sm mt-0.5">Chọn đối tác hội thoại</Text>
        </View>

        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 24, gap: 12, paddingTop: 12 }}>
          {personas.map(persona => {
            const isAdvanced = persona.difficulty === 'ADVANCED'
            const locked = isAdvanced && !isPro
            return (
              <TouchableOpacity
                key={persona.id}
                onPress={() => locked
                  ? Alert.alert('PRO Required', 'Persona ADVANCED chỉ dành cho PRO. Truy cập mydeutschflow.com')
                  : startSession.mutate(persona.id)
                }
                className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 flex-row items-center justify-between"
                activeOpacity={0.75}
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-12 h-12 rounded-2xl bg-[#2A2A2A] items-center justify-center">
                    <Text className="text-2xl">{difficultyEmoji(persona.difficulty)}</Text>
                  </View>
                  <View>
                    <Text className="text-white font-semibold text-sm">{persona.roleTitle}</Text>
                    <View className={`mt-0.5 self-start px-2 py-0.5 rounded-full ${difficultyBg(persona.difficulty)}`}>
                      <Text className={`text-[10px] font-bold ${difficultyText(persona.difficulty)}`}>
                        {persona.difficulty}
                      </Text>
                    </View>
                  </View>
                </View>
                {locked
                  ? <Text className="text-[#F5C842] text-xs font-semibold">PRO</Text>
                  : <ChevronRight size={18} color={Colors.muted} />
                }
              </TouchableOpacity>
            )
          })}

          {/* Weekly Speaking CTA */}
          <TouchableOpacity
            onPress={() => router.push('/(student)/weekly-speaking')}
            className="bg-[#1A1A1A] border border-[#3A86FF]/40 rounded-2xl p-4 flex-row items-center gap-3"
            activeOpacity={0.75}
          >
            <View className="w-12 h-12 rounded-2xl bg-[rgba(58,134,255,0.15)] items-center justify-center">
              <Flame size={22} color="#3A86FF" />
            </View>
            <View>
              <Text className="text-white font-semibold text-sm">Weekly Speaking Challenge</Text>
              <Text className="text-[#64748B] text-xs">Nộp bài nói hàng tuần • PRO</Text>
            </View>
            <ChevronRight size={18} color={Colors.muted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    )
  }

  // Active session UI
  return (
    <SafeAreaView className="flex-1 bg-[#0D0D0D]">
      <View className="flex-row items-center px-5 pt-4 pb-3 border-b border-[#1A1A1A]">
        <TouchableOpacity onPress={() => { setActiveSession(null); setMessages([]) }} className="mr-3">
          <Text className="text-[#64748B] text-sm">Kết thúc</Text>
        </TouchableOpacity>
        <MessageCircle size={18} color={Colors.yellow} />
        <Text className="text-white font-semibold ml-2">Phiên hội thoại</Text>
      </View>

      <ScrollView className="flex-1 px-5 py-4" contentContainerStyle={{ gap: 12 }}>
        {messages.map((msg, i) => (
          <View key={i} className={`max-w-[85%] ${msg.role === 'user' ? 'self-end' : 'self-start'}`}>
            <View className={`rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-[#F5C842] rounded-br-sm'
                : 'bg-[#1A1A1A] border border-[#2A2A2A] rounded-bl-sm'
            }`}>
              <Text className={msg.role === 'user' ? 'text-[#0D0D0D] text-sm' : 'text-white text-sm'}>
                {msg.content}
              </Text>
            </View>
          </View>
        ))}
        {isProcessing && (
          <View className="self-start bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl rounded-bl-sm px-4 py-3">
            <Text className="text-[#64748B] text-sm">Đang xử lý...</Text>
          </View>
        )}
      </ScrollView>

      {/* Mic button */}
      <View className="pb-8 items-center">
        <TouchableOpacity
          onPressIn={startRecording}
          onPressOut={stopRecordingAndSend}
          disabled={isProcessing}
          activeOpacity={0.85}
        >
          <Animated.View
            style={isRecording ? pulseStyle : undefined}
            className={`w-20 h-20 rounded-full items-center justify-center ${
              isRecording ? 'bg-[#E63946]' : isProcessing ? 'bg-[#2A2A2A]' : 'bg-[#F5C842]'
            }`}
          >
            {isRecording ? <MicOff size={30} color="#fff" /> : <Mic size={30} color="#0D0D0D" />}
          </Animated.View>
        </TouchableOpacity>
        <Text className="text-[#64748B] text-xs mt-2">
          {isRecording ? 'Đang ghi âm… thả để gửi' : isProcessing ? 'Đang xử lý...' : 'Giữ để nói'}
        </Text>
      </View>
    </SafeAreaView>
  )
}

function difficultyEmoji(d: string) {
  if (d === 'BEGINNER') return '🟢'
  if (d === 'INTERMEDIATE') return '🟡'
  return '🔴'
}
function difficultyBg(d: string) {
  if (d === 'BEGINNER') return 'bg-[rgba(45,198,83,0.15)]'
  if (d === 'INTERMEDIATE') return 'bg-[rgba(245,200,66,0.15)]'
  return 'bg-[rgba(230,57,70,0.15)]'
}
function difficultyText(d: string) {
  if (d === 'BEGINNER') return 'text-[#2DC653]'
  if (d === 'INTERMEDIATE') return 'text-[#F5C842]'
  return 'text-[#E63946]'
}
