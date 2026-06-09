import { useState } from 'react'
import { View, Alert, Linking, Pressable, ActivityIndicator } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router, type Href } from 'expo-router'
import { Audio } from 'expo-av'
import * as Haptics from 'expo-haptics'
import { Flame, Lock, Mic, Square, RotateCcw, ChevronRight } from 'lucide-react-native'
import api, { apiMessage } from '@/lib/api'
import { speakingApi } from '@/lib/speakingApi'
import { weeklyApi, rubricScore } from '@/lib/weeklyApi'
import { radius, space, useTheme } from '@/lib/theme'
import { PAYWALL_ENABLED } from '@/lib/paywall'
import { Screen, Card, ThemedText, Icon, Pill, AppHeader, EmptyState, SectionHeader, Skeleton } from '@/components/ui'
import { usePlanStore } from '@/stores/usePlanStore'

interface WeeklyPrompt {
  id: number
  title: string
  cefrBand: string
  weekStartDate: string
}

interface WeeklySubmission {
  id: number
  promptTitle: string
  weekStartDate: string
  cefrBand: string
  taskScoreOrNull?: number
}

export default function WeeklySpeakingScreen() {
  const theme = useTheme()
  const c = theme.colors
  const { isPro } = usePlanStore()

  const { data: prompt, isLoading: promptLoading, refetch: refetchPrompt, isFetching } = useQuery({
    queryKey: ['weekly-prompt'],
    queryFn: () =>
      api
        .get<WeeklyPrompt>('/ai-speaking/weekly/current-prompt', { params: { cefrBand: 'B1' } })
        .then((r) => r.data),
    enabled: isPro,
    staleTime: 60_000 * 30,
  })

  const { data: history = [], refetch: refetchHistory } = useQuery({
    queryKey: ['weekly-history'],
    queryFn: () =>
      api
        .get<{ content: WeeklySubmission[] }>('/ai-speaking/weekly/me/submissions', {
          params: { page: 0, size: 10 },
        })
        .then((r) => r.data.content ?? []),
    enabled: isPro,
    staleTime: 60_000,
  })

  if (!isPro) {
    return (
      <Screen edges={['top']}>
        <AppHeader title="Weekly Speaking" onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon={Lock}
            title="Tính năng PRO"
            message="Nộp bài nói hàng tuần và nhận phản hồi AI chi tiết."
            actionLabel={PAYWALL_ENABLED ? 'Xem PRO' : undefined}
            onAction={PAYWALL_ENABLED ? () => router.push('/(student)/upgrade') : undefined}
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen edges={['top']}>
      <AppHeader title="Weekly Speaking" onBack={() => router.back()} />

      <Screen
        scroll
        edges={[]}
        contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[8], gap: space[4], paddingTop: space[2] }}
        refreshing={isFetching && !promptLoading}
        onRefresh={() => {
          void refetchPrompt()
          void refetchHistory()
        }}
      >
        {promptLoading ? (
          <Skeleton height={170} radius="2xl" />
        ) : prompt ? (
          <Card style={{ borderColor: c.info + '66' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[3] }}>
              <Icon icon={Flame} size={16} color="info" />
              <ThemedText variant="label" color="info">
                Thử thách tuần này
              </ThemedText>
              <View style={{ marginLeft: 'auto' }}>
                <Pill label={prompt.cefrBand} tone="neutral" />
              </View>
            </View>
            <ThemedText variant="title" style={{ marginBottom: space[1] }}>
              {prompt.title}
            </ThemedText>
            <ThemedText variant="caption" color="muted" style={{ marginBottom: space[4] }}>
              {prompt.weekStartDate}
            </ThemedText>
            <WeeklyRecorder promptId={prompt.id} cefrBand={prompt.cefrBand} />
          </Card>
        ) : null}

        {history.length > 0 ? (
          <View>
            <SectionHeader title="Lịch sử nộp bài" />
            <View style={{ gap: space[2] }}>
              {history.map((sub) => (
                <Card
                  key={sub.id}
                  onPress={() =>
                    router.push({
                      pathname: '/(student)/weekly-detail',
                      params: { id: String(sub.id), title: sub.promptTitle },
                    } as unknown as Href)
                  }
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <ThemedText variant="bodyStrong">{sub.promptTitle}</ThemedText>
                      <ThemedText variant="caption" color="muted">
                        {sub.weekStartDate} · {sub.cefrBand}
                      </ThemedText>
                    </View>
                    {sub.taskScoreOrNull != null ? (
                      <View
                        style={{
                          backgroundColor: c.successSoft,
                          borderRadius: radius.md,
                          paddingHorizontal: space[2],
                          paddingVertical: space[1],
                        }}
                      >
                        <ThemedText variant="bodyStrong" color="success">
                          {sub.taskScoreOrNull}/5
                        </ThemedText>
                      </View>
                    ) : null}
                    <Icon icon={ChevronRight} size={16} color="faint" />
                  </View>
                </Card>
              ))}
            </View>
          </View>
        ) : null}
      </Screen>
    </Screen>
  )
}

type RecPhase = 'idle' | 'recording' | 'processing' | 'done'

function WeeklyRecorder({ promptId, cefrBand }: { promptId: number; cefrBand: string }) {
  const { colors } = useTheme()
  const qc = useQueryClient()
  const [phase, setPhase] = useState<RecPhase>('idle')
  const [score, setScore] = useState<number | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [recording, setRecording] = useState<Audio.Recording | null>(null)

  async function start() {
    try {
      // Honour the permission result; route hard denial to Settings (iOS won't re-prompt).
      const { status, canAskAgain } = await Audio.requestPermissionsAsync()
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
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      setRecording(rec)
      setPhase('recording')
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    } catch {
      Alert.alert('Lỗi', 'Không thể khởi động microphone. Vui lòng kiểm tra quyền truy cập.')
    }
  }

  async function stopAndSubmit() {
    if (!recording) return
    setPhase('processing')
    try {
      await recording.stopAndUnloadAsync()
      // Leave iOS record mode so other screens' TTS plays from the speaker, not the earpiece.
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true })
      const uri = recording.getURI()
      setRecording(null)
      if (!uri) throw new Error('no_uri')
      const transcript = await speakingApi.transcribe(uri)
      if (!transcript.trim()) throw new Error('empty')
      const res = await weeklyApi.submit(promptId, transcript, cefrBand)
      setScore(rubricScore(res.rubric))
      setSummary(res.rubric?.feedback_vi_summary ?? null)
      setPhase('done')
      qc.invalidateQueries({ queryKey: ['weekly-history'] })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (e) {
      setPhase('idle')
      Alert.alert('Lỗi', apiMessage(e))
    }
  }

  function reset() {
    setPhase('idle')
    setScore(null)
    setSummary(null)
  }

  if (phase === 'processing') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], paddingVertical: space[3] }}>
        <ActivityIndicator color={colors.accent} />
        <ThemedText variant="body" color="muted">
          Đang chấm điểm bài nói…
        </ThemedText>
      </View>
    )
  }

  if (phase === 'done') {
    return (
      <View style={{ gap: space[3] }}>
        <View
          style={{
            backgroundColor: colors.successSoft,
            borderRadius: radius.md,
            padding: space[3],
            gap: space[2],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <ThemedText variant="label" color="success">
              ✓ Đã nộp
            </ThemedText>
            {score != null ? (
              <ThemedText variant="bodyStrong" color="success" style={{ marginLeft: 'auto' }}>
                {score}/5
              </ThemedText>
            ) : null}
          </View>
          {summary ? (
            <ThemedText variant="caption" color="secondary">
              {summary}
            </ThemedText>
          ) : null}
        </View>
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync()
            reset()
          }}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2], paddingVertical: space[2] }}
        >
          <Icon icon={RotateCcw} size={16} color="muted" />
          <ThemedText variant="label" color="muted">
            Ghi lại
          </ThemedText>
        </Pressable>
      </View>
    )
  }

  const isRec = phase === 'recording'
  return (
    <Pressable
      onPress={isRec ? stopAndSubmit : start}
      style={{
        height: 52,
        borderRadius: radius.lg,
        backgroundColor: isRec ? colors.danger : colors.accent,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[2],
      }}
    >
      <Icon icon={isRec ? Square : Mic} size={20} color="onAccent" fill={isRec} />
      <ThemedText variant="bodyStrong" color="onAccent">
        {isRec ? 'Dừng & nộp bài' : 'Ghi âm trả lời'}
      </ThemedText>
    </Pressable>
  )
}
