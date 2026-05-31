import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Flame, Star, BookOpen, Mic, TrendingUp, type LucideIcon } from 'lucide-react-native'
import api from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, AppHeader, ProgressBar, Skeleton } from '@/components/ui'

interface StatsData {
  streakDays: number
  totalXp: number
  xpLevel: number
  wordsLearned: number
  speakingMinutes: number
  grammarAccuracy: number
  weeklyProgress: number[]
}

type Accent = 'accent' | 'success' | 'danger' | 'info'

export default function StatsScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get<StatsData>('/student/stats').then((r) => r.data),
    staleTime: 60_000,
  })

  return (
    <Screen edges={['top']}>
      <AppHeader title="Tiến độ học tập" onBack={() => router.back()} />
      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <View style={{ flexDirection: 'row', gap: space[3] }}>
            <Skeleton height={120} radius="2xl" style={{ flex: 1 }} />
            <Skeleton height={120} radius="2xl" style={{ flex: 1 }} />
          </View>
          <Skeleton height={80} radius="2xl" />
          <Skeleton height={96} radius="2xl" />
        </View>
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[8], paddingTop: space[2], gap: space[3] }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
            <StatTileCard icon={Flame} accent="accent" label="Streak" value={`${data?.streakDays ?? 0} ngày`} />
            <StatTileCard icon={Star} accent="info" label="Level" value={`Lv ${data?.xpLevel ?? 1}`} />
            <StatTileCard icon={BookOpen} accent="info" label="Từ đã học" value={`${data?.wordsLearned ?? 0}`} />
            <StatTileCard icon={Mic} accent="success" label="Phút nói" value={`${data?.speakingMinutes ?? 0}`} />
          </View>

          {data?.grammarAccuracy != null ? (
            <Card style={{ gap: space[3] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <Icon icon={TrendingUp} size={16} color="accent" />
                <ThemedText variant="bodyStrong">Độ chính xác ngữ pháp</ThemedText>
                <ThemedText variant="bodyStrong" color="accent" style={{ marginLeft: 'auto' }}>
                  {data.grammarAccuracy}%
                </ThemedText>
              </View>
              <ProgressBar value={data.grammarAccuracy / 100} />
            </Card>
          ) : null}

          <Card>
            <ThemedText variant="label" color="muted">
              Tổng XP tích luỹ
            </ThemedText>
            <ThemedText variant="displayLg" style={{ marginTop: space[1] }}>
              {(data?.totalXp ?? 0).toLocaleString()}
            </ThemedText>
            <ThemedText variant="caption" color="muted">
              điểm kinh nghiệm
            </ThemedText>
          </Card>
        </Screen>
      )}
    </Screen>
  )
}

function StatTileCard({
  icon,
  accent,
  label,
  value,
}: {
  icon: LucideIcon
  accent: Accent
  label: string
  value: string
}) {
  const theme = useTheme()
  const c = theme.colors
  const softMap: Record<Accent, string> = {
    accent: c.accentSoft,
    success: c.successSoft,
    danger: c.dangerSoft,
    info: c.infoSoft,
  }
  return (
    <Card style={{ width: '47%', alignItems: 'center', gap: space[2] }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.md,
          backgroundColor: softMap[accent],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon icon={icon} size={20} color={accent} />
      </View>
      <ThemedText variant="monoLg">{value}</ThemedText>
      <ThemedText variant="caption" color="muted">
        {label}
      </ThemedText>
    </Card>
  )
}
