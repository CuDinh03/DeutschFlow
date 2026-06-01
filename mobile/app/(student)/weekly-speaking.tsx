import { View, Alert } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Flame, Lock } from 'lucide-react-native'
import api from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, Pill, Button, AppHeader, EmptyState, SectionHeader, Skeleton } from '@/components/ui'
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

  const { data: prompt, isLoading: promptLoading } = useQuery({
    queryKey: ['weekly-prompt'],
    queryFn: () =>
      api
        .get<WeeklyPrompt>('/ai-speaking/weekly/current-prompt', { params: { cefrBand: 'B1' } })
        .then((r) => r.data),
    enabled: isPro,
    staleTime: 60_000 * 30,
  })

  const { data: history = [] } = useQuery({
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
            actionLabel="Xem PRO"
            onAction={() => router.push('/(student)/upgrade')}
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen edges={['top']}>
      <AppHeader title="Weekly Speaking" onBack={() => router.back()} />

      <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[8], gap: space[4], paddingTop: space[2] }}>
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
            <Button label="Nộp bài nói" onPress={() => Alert.alert('Sắp có', 'Tính năng ghi âm đang được phát triển.')} />
          </Card>
        ) : null}

        {history.length > 0 ? (
          <View>
            <SectionHeader title="Lịch sử nộp bài" />
            <View style={{ gap: space[2] }}>
              {history.map((sub) => (
                <Card key={sub.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
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
