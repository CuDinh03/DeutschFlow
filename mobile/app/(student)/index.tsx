import { View, RefreshControl, Pressable } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { MotiView } from 'moti'
import { Flame, BookOpen, Mic, Star, Map, Bell, Zap } from 'lucide-react-native'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePlanStore } from '@/stores/usePlanStore'
import api from '@/lib/api'
import { PAYWALL_ENABLED } from '@/lib/paywall'
import { gamificationApi } from '@/lib/gamificationApi'
import { motion, space, radius, useTheme } from '@/lib/theme'
import {
  Screen,
  Card,
  ThemedText,
  Icon,
  Pill,
  ListRow,
  SectionHeader,
  Skeleton,
  ErrorState,
} from '@/components/ui'

// Only the fields the home actually uses from the (plan-oriented) dashboard.
// XP/level come from /xp/me, due-SRS from /srs/count, unread from /notifications.
interface DashboardData {
  streakDays: number
  weeklyXp: number
}

function greetingFor(hour: number): string {
  if (hour < 12) return 'Chào buổi sáng'
  if (hour < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

export default function DashboardScreen() {
  const theme = useTheme()
  const { user } = useAuthStore()
  const { isPro } = usePlanStore()

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardData>('/student/dashboard').then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: xp, refetch: refetchXp } = useQuery({
    queryKey: ['xp-summary'],
    queryFn: () => gamificationApi.getXpSummary(),
    staleTime: 60_000,
  })

  const { data: srs, refetch: refetchSrs } = useQuery({
    queryKey: ['srs-count'],
    queryFn: () => api.get<{ dueCount: number }>('/srs/count').then((r) => r.data),
    staleTime: 30_000,
  })

  const { data: unreadData, refetch: refetchUnread } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => api.get<{ unreadCount: number }>('/notifications/unread-count').then((r) => r.data),
    staleTime: 30_000,
  })

  const firstName = user?.displayName?.split(' ').at(-1) ?? 'bạn'
  const greeting = greetingFor(new Date().getHours())
  const level = xp?.level ?? 1
  const totalXp = xp?.totalXp ?? 0
  const weeklyXp = data?.weeklyXp ?? 0
  const dueSrs = srs?.dueCount ?? 0
  const unread = unreadData?.unreadCount ?? 0

  const onRefresh = () => {
    void refetch()
    void refetchXp()
    void refetchSrs()
    void refetchUnread()
  }

  return (
    <Screen
      scroll
      edges={['top']}
      contentStyle={{ paddingBottom: space[8] }}
      refreshing={isRefetching}
      onRefresh={onRefresh}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: space[5],
          paddingTop: space[3],
          paddingBottom: space[2],
        }}
      >
        <View style={{ gap: 2 }}>
          <ThemedText variant="caption" color="muted">
            {greeting},
          </ThemedText>
          <ThemedText variant="titleLg">{firstName}</ThemedText>
        </View>
        <Pressable onPress={() => router.push('/(student)/notifications')} hitSlop={8}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.md,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon icon={Bell} size={20} color="secondary" />
            {unread > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  minWidth: 18,
                  height: 18,
                  paddingHorizontal: 4,
                  borderRadius: radius.full,
                  backgroundColor: theme.colors.danger,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: theme.colors.bg,
                }}
              >
                <ThemedText variant="caption" style={{ color: '#FFF', fontSize: 10 }}>
                  {Math.min(unread, 9)}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </Pressable>
      </View>

      {isLoading ? (
        <DashboardSkeleton />
      ) : isError && !data ? (
        <ErrorState onRetry={onRefresh} />
      ) : (
        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: motion.duration.normal }}
        >
          <View style={{ paddingHorizontal: space[5], marginTop: space[3] }}>
            {/* Streak hero — brand red, the day-one engagement metric */}
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: radius.xl,
                    backgroundColor: theme.colors.brandSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon icon={Flame} size={30} color="brand" fill />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
                    <ThemedText variant="displayLg">{String(data?.streakDays ?? 0)}</ThemedText>
                    <ThemedText variant="bodyStrong" color="secondary">
                      ngày streak
                    </ThemedText>
                  </View>
                  <ThemedText variant="caption" color="muted">
                    Giữ lửa mỗi ngày để không mất chuỗi
                  </ThemedText>
                </View>
              </View>
            </Card>

            {/* Secondary stats */}
            <View style={{ flexDirection: 'row', gap: space[3], marginTop: space[3] }}>
              <StatCard icon={Star} accent="accent" value={`Lv ${level}`} label={`${totalXp} XP`} />
              <StatCard icon={Zap} accent="info" value={`+${weeklyXp}`} label="XP tuần này" />
            </View>
          </View>

          {dueSrs > 0 ? (
            <Card
              onPress={() => router.push('/(student)/srs')}
              bordered
              style={{ marginHorizontal: space[5], marginTop: space[4], borderColor: theme.colors.accent + '4D' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: radius.md,
                      backgroundColor: theme.colors.accentSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon icon={BookOpen} size={20} color="accent" />
                  </View>
                  <View style={{ gap: 2 }}>
                    <ThemedText variant="bodyStrong">Ôn tập hôm nay</ThemedText>
                    <ThemedText variant="caption" color="muted">
                      Spaced repetition đến hạn
                    </ThemedText>
                  </View>
                </View>
                <Pill label={`${dueSrs} thẻ`} tone="accent" />
              </View>
            </Card>
          ) : null}

          <View style={{ paddingHorizontal: space[5], marginTop: space[6] }}>
            <SectionHeader title="Hoạt động" />
            <Card padded={false} style={{ paddingHorizontal: space[4] }}>
              <ListRow
                icon={BookOpen}
                iconTone="accent"
                title="Luyện từ vựng SRS"
                subtitle="Flashcard lặp lại ngắt quãng"
                onPress={() => router.push('/(student)/srs')}
              />
              <Divider />
              <ListRow
                icon={Mic}
                iconTone="info"
                title="AI Speaking"
                subtitle="Hội thoại với AI coach"
                onPress={() => router.push('/(student)/speaking')}
              />
              <Divider />
              <ListRow
                icon={Map}
                iconTone="success"
                title="Lộ trình học"
                subtitle="Skill tree A1 đến B2"
                onPress={() => router.push('/(student)/roadmap')}
              />
            </Card>
          </View>

          {!isPro && PAYWALL_ENABLED ? (
            <Card
              onPress={() => router.push('/(student)/upgrade')}
              elevation="lifted"
              style={{ marginHorizontal: space[5], marginTop: space[6], borderColor: theme.colors.accent + '66' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] }}>
                <View style={{ flex: 1, gap: space[1] }}>
                  <Pill label="DeutschFlow PRO" tone="accent" icon={Star} />
                  <ThemedText variant="title">Mở khoá toàn bộ tính năng</ThemedText>
                  <ThemedText variant="caption" color="muted">
                    Speaking AI, Mock Exam, Weekly Challenge
                  </ThemedText>
                </View>
                <View
                  style={{
                    backgroundColor: theme.colors.accent,
                    borderRadius: radius.md,
                    paddingHorizontal: space[3],
                    paddingVertical: space[2],
                  }}
                >
                  <ThemedText variant="label" color="onAccent">
                    Xem PRO
                  </ThemedText>
                </View>
              </View>
            </Card>
          ) : null}
        </MotiView>
      )}
    </Screen>
  )
}

function StatCard({
  icon,
  accent,
  value,
  label,
}: {
  icon: typeof Flame
  accent: 'accent' | 'info'
  value: string
  label: string
}) {
  const theme = useTheme()
  const softBg = accent === 'accent' ? theme.colors.accentSoft : theme.colors.infoSoft
  return (
    <Card style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.md,
            backgroundColor: softBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon icon={icon} size={20} color={accent} />
        </View>
        <View style={{ gap: 2 }}>
          <ThemedText variant="monoLg">{value}</ThemedText>
          <ThemedText variant="caption" color="muted">
            {label}
          </ThemedText>
        </View>
      </View>
    </Card>
  )
}

function Divider() {
  const theme = useTheme()
  return <View style={{ height: 1, backgroundColor: theme.colors.border }} />
}

function DashboardSkeleton() {
  return (
    <View style={{ paddingHorizontal: space[5], marginTop: space[3], gap: space[4] }}>
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <Skeleton height={72} radius="2xl" style={{ flex: 1 }} />
        <Skeleton height={72} radius="2xl" style={{ flex: 1 }} />
      </View>
      <Skeleton height={72} radius="2xl" />
      <Skeleton width={120} height={20} radius="md" />
      <Skeleton height={180} radius="2xl" />
    </View>
  )
}
