import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import {
  Flame,
  Star,
  BookOpen,
  Mic,
  Headphones,
  PenTool,
  MessageSquare,
  Clock,
  type LucideIcon,
} from 'lucide-react-native'
import api from '@/lib/api'
import { progressApi, type SkillData, type WeeklyPoint } from '@/lib/progressApi'
import { speakingApi, type AiSpeakingSession } from '@/lib/speakingApi'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, Pill, AppHeader, ProgressBar, ErrorState, FadeIn, Skeleton } from '@/components/ui'

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

const SKILLS: { key: keyof SkillsShape; label: string; icon: LucideIcon }[] = [
  { key: 'lesen', label: 'Đọc hiểu', icon: BookOpen },
  { key: 'hoeren', label: 'Nghe hiểu', icon: Headphones },
  { key: 'schreiben', label: 'Viết', icon: PenTool },
  { key: 'sprechen', label: 'Nói', icon: Mic },
]

interface SkillsShape {
  lesen: SkillData
  hoeren: SkillData
  schreiben: SkillData
  sprechen: SkillData
}

export default function StatsScreen() {
  const { data: stats, isLoading, isError, refetch: refetchStats, isFetching } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get<StatsData>('/student/stats').then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: overview, refetch: refetchOverview } = useQuery({
    queryKey: ['progress-overview'],
    queryFn: () => progressApi.getOverview(),
    staleTime: 60_000,
  })

  const { data: sessions = [], refetch: refetchSessions } = useQuery({
    queryKey: ['recent-sessions'],
    queryFn: () => speakingApi.listSessions(8),
    staleTime: 60_000,
  })

  const onRefresh = () => {
    void refetchStats()
    void refetchOverview()
    void refetchSessions()
  }

  return (
    <Screen edges={['top']}>
      <AppHeader title="Tiến độ học tập" onBack={() => router.back()} />
      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <View style={{ flexDirection: 'row', gap: space[3] }}>
            <Skeleton height={120} radius="2xl" style={{ flex: 1 }} />
            <Skeleton height={120} radius="2xl" style={{ flex: 1 }} />
          </View>
          <Skeleton height={180} radius="2xl" />
          <Skeleton height={120} radius="2xl" />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetchStats()} />
      ) : (
        <Screen
          scroll
          edges={[]}
          contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[8], paddingTop: space[2], gap: space[3] }}
          refreshing={isFetching && !isLoading}
          onRefresh={onRefresh}
        >
          {/* Aggregate tiles */}
          <FadeIn delay={0}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
              <StatTileCard icon={Flame} accent="accent" label="Streak" value={`${stats?.streakDays ?? 0} ngày`} />
              <StatTileCard icon={Star} accent="info" label="Level" value={`Lv ${stats?.xpLevel ?? 1}`} />
              <StatTileCard icon={BookOpen} accent="info" label="Từ đã học" value={`${stats?.wordsLearned ?? 0}`} />
              <StatTileCard icon={Mic} accent="success" label="Phút nói" value={`${stats?.speakingMinutes ?? 0}`} />
            </View>
          </FadeIn>

          {/* Skill ability — "where am I" */}
          {overview ? (
            <FadeIn delay={80}>
            <Card style={{ gap: space[4] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <ThemedText variant="bodyStrong">Kỹ năng theo CEFR</ThemedText>
                <Pill label={overview.cefrLevel || 'A1'} tone="accent" />
              </View>
              {SKILLS.map(({ key, label, icon }) => {
                const score = Math.round(overview.skills?.[key]?.score ?? 0)
                return (
                  <View key={key} style={{ gap: space[2] }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                      <Icon icon={icon} size={16} color="muted" />
                      <ThemedText variant="label" color="secondary">
                        {label}
                      </ThemedText>
                      <ThemedText variant="label" color="muted" style={{ marginLeft: 'auto' }}>
                        {score}/100
                      </ThemedText>
                    </View>
                    <ProgressBar value={score / 100} />
                  </View>
                )
              })}
            </Card>
            </FadeIn>
          ) : null}

          {/* Weekly trend — "am I improving" */}
          {overview && overview.weeklyProgress?.length > 0 ? (
            <FadeIn delay={160}>
              <Card style={{ gap: space[3] }}>
                <ThemedText variant="bodyStrong">Hoạt động hàng tuần</ThemedText>
                <WeeklyTrend points={overview.weeklyProgress} />
              </Card>
            </FadeIn>
          ) : null}

          {/* Recent sessions — history */}
          <FadeIn delay={240}>
            <Card style={{ gap: space[3] }}>
              <ThemedText variant="bodyStrong">Buổi luyện gần đây</ThemedText>
              {sessions.length === 0 ? (
                <ThemedText variant="caption" color="muted">
                  Chưa có buổi luyện nào. Hãy bắt đầu một buổi phỏng vấn!
                </ThemedText>
              ) : (
                sessions.map((s, i) => <SessionRow key={s.id} session={s} isLast={i === sessions.length - 1} />)
              )}
            </Card>
          </FadeIn>
        </Screen>
      )}
    </Screen>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function WeeklyTrend({ points }: { points: WeeklyPoint[] }) {
  const { colors } = useTheme()
  const recent = points.slice(-8)
  const max = Math.max(1, ...recent.map((p) => p.minutesStudied))
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[2], height: 80 }}>
      {recent.map((p, i) => {
        const ratio = p.minutesStudied / max
        return (
          <View key={`${p.week}-${i}`} style={{ flex: 1, alignItems: 'center', gap: space[1] }}>
            <View style={{ flex: 1, justifyContent: 'flex-end', width: '100%' }}>
              <View
                style={{
                  height: `${Math.max(6, ratio * 100)}%`,
                  borderRadius: radius.sm,
                  backgroundColor: ratio > 0.01 ? colors.accent : colors.surfaceSunken,
                }}
              />
            </View>
            <ThemedText variant="caption" color="faint">
              {p.minutesStudied}
            </ThemedText>
          </View>
        )
      })}
    </View>
  )
}

function SessionRow({ session, isLast }: { session: AiSpeakingSession; isLast: boolean }) {
  const { colors } = useTheme()
  const mode = sessionModeLabel(session.sessionMode)
  const hasReport = !!session.interviewReportJson
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        paddingVertical: space[2],
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.md,
          backgroundColor: colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon icon={session.sessionMode === 'INTERVIEW' ? MessageSquare : Mic} size={18} color="accent" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText variant="bodyStrong" numberOfLines={1}>
          {session.interviewPosition || session.topic || 'Buổi luyện nói'}
        </ThemedText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Icon icon={Clock} size={12} color="faint" />
          <ThemedText variant="caption" color="muted">
            {shortDate(session.startedAt)} • {mode}
          </ThemedText>
        </View>
      </View>
      {hasReport ? <Pill label="Báo cáo" tone="success" /> : null}
    </View>
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

function sessionModeLabel(mode: string | null): string {
  switch (mode) {
    case 'INTERVIEW':
      return 'Phỏng vấn'
    case 'LESSON':
      return 'Bài học'
    case 'COMMUNICATION':
      return 'Hội thoại'
    default:
      return 'Luyện nói'
  }
}

function shortDate(iso: string | null): string {
  if (!iso) return ''
  const parts = iso.slice(0, 10).split('-')
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : ''
}
