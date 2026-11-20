import { useEffect, useRef } from 'react'
import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { usePullRefresh } from '@/hooks/usePullRefresh'
import { router } from 'expo-router'
import { ArrowRight } from 'lucide-react-native'
import { progressApi, type ProgressOverview } from '@/lib/progressApi'
import { speakingApi, type AiSpeakingSession } from '@/lib/speakingApi'
import { gamificationApi, type Achievement, type LeaderboardEntry } from '@/lib/gamificationApi'
import { learningApi, type ErrorSkill } from '@/lib/learningApi'
import { fetchStudentStats, STUDENT_STATS_QUERY_KEY } from '@/lib/studentStatsApi'
import { formatCountVi, weekdayBars } from '@/lib/progressFormat'
import { achievementGlyph, stripEmoji } from '@/lib/achievementDisplay'
import { getErrorTitle } from '@/lib/errorTaxonomy'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import {
  Screen,
  ThemedText,
  Icon,
  AvatarButton,
  useTabBarClearance,
  ProgressBar,
  ErrorState,
  FadeIn,
  Skeleton,
  Button,
  GaGlyph,
} from '@/components/ui'
import { Badge, Eyebrow, MarkTitle, MeCard, Row, RowList, SectionHead } from '@/components/me/MeParts'

// Tab Tiến bộ — giao diện v3.4 (Đợt 6C, 19/11/2026; mẫu `stats`): năng lực 4 kỹ năng dạng thanh, phút
// học từng ngày trong tuần, ba ô số, kinh nghiệm, huy hiệu lưới 4 cột (glyph thay emoji), bảng xếp hạng,
// buổi luyện gần đây, lối sang Tôi và cài đặt.

const SKILLS: { key: keyof ProgressOverview['skills']; label: string }[] = [
  { key: 'lesen', label: 'Đọc' },
  { key: 'hoeren', label: 'Nghe' },
  { key: 'schreiben', label: 'Viết' },
  { key: 'sprechen', label: 'Nói' },
]

const CHART_HEIGHT = 120
const CHART_LABEL_SPACE = 18

/** Thẻ phút học từng ngày — tắt tới khi backend đo phút thật (xem chú thích ở chỗ dựng thẻ). */
const SHOW_WEEK_MINUTES = false

export default function StatsScreen() {
  // Từ 18/11/2026 Tiến bộ là tab: không có back, chừa đáy cho thanh tab nổi.
  const tabClearance = useTabBarClearance()
  const { data: stats, isLoading, isError, refetch: refetchStats } = useQuery({
    queryKey: STUDENT_STATS_QUERY_KEY,
    queryFn: fetchStudentStats,
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

  const { data: xp, refetch: refetchXp } = useQuery({
    queryKey: ['xp-summary'],
    queryFn: () => gamificationApi.getXpSummary(),
    staleTime: 60_000,
  })

  const { data: errorSkills = [], refetch: refetchErrors } = useQuery({
    queryKey: ['error-skills'],
    queryFn: () => learningApi.getErrorSkills(30),
    staleTime: 60_000,
  })

  const { data: leaderboard = [], refetch: refetchLeaderboard } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => gamificationApi.getLeaderboard(10),
    staleTime: 60_000,
  })

  // Acknowledge newly-unlocked badges once, after the user has seen this screen.
  const ackedRef = useRef(false)
  useEffect(() => {
    if (!ackedRef.current && (xp?.pendingBadges?.length ?? 0) > 0) {
      ackedRef.current = true
      void gamificationApi.ackBadges().catch(() => undefined)
    }
  }, [xp?.pendingBadges?.length])

  const pull = usePullRefresh(async () => {
    await Promise.all([refetchStats(), refetchOverview(), refetchSessions(), refetchXp(), refetchErrors(), refetchLeaderboard()])
  })
  const onRefresh = () => void pull.onRefresh()

  const topErrors = [...errorSkills]
    .filter((e) => !e.resolved)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 3)

  const title = <MarkTitle lead="Tiến độ" mark="học tập" style={{ marginTop: space[1] }} />

  return (
    <Screen edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[5], paddingTop: space[2] }}>
        <Eyebrow style={{ flex: 1 }}>Tiến bộ</Eyebrow>
        <AvatarButton />
      </View>
      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3] }}>
          {title}
          <Skeleton height={180} radius="lg" />
          <Skeleton height={150} radius="lg" />
          <Skeleton height={64} radius="md" />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetchStats()} />
      ) : (
        <Screen
          scroll
          edges={[]}
          contentStyle={{ paddingHorizontal: space[5], paddingBottom: tabClearance, gap: space[3] }}
          refreshing={pull.refreshing}
          onRefresh={onRefresh}
        >
          {title}

          {/* Năng lực 4 kỹ năng — "mình đang ở đâu" */}
          {overview ? (
            <FadeIn delay={0}>
              <SkillsCard overview={overview} />
            </FadeIn>
          ) : null}

          {/* Phút học từng ngày (mẫu `stats`) TẠM ẨN — 19/11/2026: `StudentStatsResponse.weeklyProgress` không đo
              phút thật (đếm learning_session_progress COMPLETED × 25, không gồm cây kỹ năng, luyện nói, ôn từ) nên
              học viên mobile gần như luôn thấy 0. Bật lại khi backend tính phút học thật. */}
          {SHOW_WEEK_MINUTES && stats?.weeklyProgress?.length ? (
            <FadeIn delay={60}>
              <WeekCard minutes={stats.weeklyProgress} />
            </FadeIn>
          ) : null}

          <FadeIn delay={100}>
            <TotalsStrip
              streakDays={stats?.streakDays ?? 0}
              wordsLearned={stats?.wordsLearned ?? 0}
              speakingMinutes={stats?.speakingMinutes ?? 0}
            />
          </FadeIn>

          {/* XP & level progress */}
          {xp ? (
            <FadeIn delay={140}>
              <XpLevelCard
                level={xp.level}
                totalXp={xp.totalXp}
                progressInLevel={xp.progressInLevel}
                xpNeededForNext={xp.xpNeededForNext}
              />
            </FadeIn>
          ) : null}

          {/* Achievements */}
          {xp && xp.allAchievements.length > 0 ? (
            <FadeIn delay={180}>
              <AchievementsGrid achievements={xp.allAchievements} pending={xp.pendingBadges} />
            </FadeIn>
          ) : null}

          {/* Recurring mistakes to work on */}
          {topErrors.length > 0 ? (
            <FadeIn delay={200}>
              <ErrorSkillsCard errors={topErrors} />
            </FadeIn>
          ) : null}

          {/* Leaderboard */}
          {leaderboard.length > 0 ? (
            <FadeIn delay={220}>
              <Leaderboard entries={leaderboard} meId={xp?.userId} />
            </FadeIn>
          ) : null}

          {/* Recent sessions — history */}
          <FadeIn delay={240}>
            <SectionHead title="Buổi luyện gần đây" style={{ marginTop: space[4], marginBottom: space[1] }} />
            {sessions.length === 0 ? (
              <MeCard style={{ gap: space[3], alignItems: 'flex-start' }}>
                <ThemedText variant="caption" color="muted">
                  Chưa có buổi luyện nào — thử một buổi luyện nói đầu tiên nhé.
                </ThemedText>
                <Button
                  label="Bắt đầu buổi luyện nói"
                  variant="secondary"
                  fullWidth={false}
                  onPress={() => router.navigate('/(student)/speaking')}
                />
              </MeCard>
            ) : (
              <RowList>
                {sessions.map((s) => (
                  <SessionRow key={s.id} session={s} />
                ))}
              </RowList>
            )}
          </FadeIn>

          <RowList style={{ marginTop: space[2] }}>
            <Row
              glyph="hoso"
              title="Tôi và cài đặt"
              subtitle="Hồ sơ, lớp, chứng nhận, cài đặt"
              onPress={() => router.push('/(student)/profile')}
            />
          </RowList>
        </Screen>
      )}
    </Screen>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SkillsCard({ overview }: { overview: ProgressOverview }) {
  const c = useTheme().colors
  return (
    <MeCard style={{ gap: space[1] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[1] }}>
        <ThemedText variant="bodyStrong" style={{ flex: 1 }}>
          Năng lực 4 kỹ năng
        </ThemedText>
        <Badge label={`CEFR ${overview.cefrLevel || 'A1'}`} tone="ink" />
      </View>
      {SKILLS.map(({ key, label }) => {
        const score = Math.max(0, Math.min(100, Math.round(overview.skills?.[key]?.score ?? 0)))
        return (
          <View
            key={key}
            accessible
            accessibilityLabel={`${label}: ${score} trên 100`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] - 2, paddingVertical: 7 }}
          >
            <ThemedText variant="body" style={{ width: 52 }}>
              {label}
            </ThemedText>
            <View style={{ flex: 1, height: 5, borderRadius: radius.full, backgroundColor: c.surfaceSunken, overflow: 'hidden' }}>
              <View style={{ width: `${score}%`, height: '100%', borderRadius: radius.full, backgroundColor: c.info }} />
            </View>
            <ThemedText variant="title" style={{ width: 40, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
              {score}
            </ThemedText>
          </View>
        )
      })}
      <ThemedText variant="caption" color="muted">
        Điểm năng lực trên thang 100
      </ThemedText>
    </MeCard>
  )
}

function WeekCard({ minutes }: { minutes: number[] }) {
  const c = useTheme().colors
  const bars = weekdayBars(minutes, new Date())
  const total = bars.reduce((sum, b) => sum + b.minutes, 0)
  const barArea = CHART_HEIGHT - CHART_LABEL_SPACE
  return (
    <MeCard style={{ gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
        <ThemedText variant="bodyStrong" style={{ flex: 1 }}>
          Phút học tuần này
        </ThemedText>
        <ThemedText variant="caption" color="muted">
          {`${formatCountVi(total)} phút`}
        </ThemedText>
      </View>
      <View
        accessible
        accessibilityLabel={`Phút học tuần này: ${bars.map((b) => `${b.label} ${b.minutes} phút`).join(', ')}`}
        style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[2], height: CHART_HEIGHT }}
      >
        {bars.map((b) => (
          <View key={b.label} style={{ flex: 1, alignItems: 'stretch', gap: space[1] }}>
            <View style={{ height: barArea, justifyContent: 'flex-end' }}>
              <View
                style={{
                  height: Math.max(4, b.ratio * barArea),
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6,
                  borderBottomLeftRadius: 3,
                  borderBottomRightRadius: 3,
                  backgroundColor: b.isToday ? c.accent : b.minutes > 0 ? c.info : c.surfaceSunken,
                  borderWidth: b.isToday ? 1.5 : 0,
                  borderColor: c.inkSurface,
                }}
              />
            </View>
            <ThemedText variant="caption" color={b.isToday ? 'primary' : 'muted'} align="center" style={{ fontSize: 11, lineHeight: 14 }}>
              {b.label}
            </ThemedText>
          </View>
        ))}
      </View>
    </MeCard>
  )
}

function TotalsStrip({ streakDays, wordsLearned, speakingMinutes }: { streakDays: number; wordsLearned: number; speakingMinutes: number }) {
  const c = useTheme().colors
  const totals = [
    { label: 'Chuỗi ngày', value: streakDays },
    { label: 'Từ đã học', value: wordsLearned },
    { label: 'Phút nói', value: speakingMinutes },
  ]
  return (
    <View style={{ flexDirection: 'row', gap: space[2] }}>
      {totals.map((t) => (
        <View
          key={t.label}
          accessible
          accessibilityLabel={`${t.label}: ${t.value}`}
          style={{ flex: 1, alignItems: 'center', paddingVertical: space[3] - 2, borderRadius: radius.md, backgroundColor: c.surfaceSunken }}
        >
          <ThemedText variant="title" style={{ fontSize: 20, lineHeight: 24, fontVariant: ['tabular-nums'] }}>
            {formatCountVi(t.value)}
          </ThemedText>
          <ThemedText variant="caption" color="muted" style={{ fontSize: 11.5 }}>
            {t.label}
          </ThemedText>
        </View>
      ))}
    </View>
  )
}

function XpLevelCard({
  level,
  totalXp,
  progressInLevel,
  xpNeededForNext,
}: {
  level: number
  totalXp: number
  progressInLevel: number
  xpNeededForNext: number
}) {
  const total = progressInLevel + xpNeededForNext
  const ratio = total > 0 ? progressInLevel / total : 1
  return (
    <MeCard style={{ gap: space[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
        <ThemedText variant="bodyStrong" style={{ flex: 1 }}>
          {`Kinh nghiệm · Cấp ${level}`}
        </ThemedText>
        <ThemedText variant="caption" color="muted">
          {xpNeededForNext > 0 ? `Còn ${formatCountVi(xpNeededForNext)} XP lên cấp ${level + 1}` : 'Đã đạt cấp tối đa'}
        </ThemedText>
      </View>
      <ProgressBar value={ratio} />
      <ThemedText variant="caption" color="muted">
        {`${formatCountVi(totalXp)} XP tích luỹ`}
      </ThemedText>
    </MeCard>
  )
}

const BADGE_COLUMNS = 4

function AchievementsGrid({ achievements, pending }: { achievements: Achievement[]; pending: Achievement[] }) {
  const pendingCodes = new Set(pending.map((p) => p.code))
  const unlocked = achievements.filter((a) => a.unlocked).length
  const rows: Achievement[][] = []
  for (let i = 0; i < achievements.length; i += BADGE_COLUMNS) rows.push(achievements.slice(i, i + BADGE_COLUMNS))
  return (
    <View style={{ gap: space[2] }}>
      <SectionHead title="Huy hiệu" right={`${unlocked}/${achievements.length} đã mở`} style={{ marginTop: space[4], marginBottom: space[1] }} />
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: space[2] }}>
          {row.map((a) => (
            <AchievementTile key={a.id} achievement={a} isNew={pendingCodes.has(a.code)} />
          ))}
          {/* Hàng cuối thiếu ô: chèn ô trống để các ô giữ cùng bề rộng. */}
          {Array.from({ length: BADGE_COLUMNS - row.length }, (_, k) => (
            <View key={`pad-${k}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  )
}

function AchievementTile({ achievement, isNew }: { achievement: Achievement; isNew: boolean }) {
  const c = useTheme().colors
  const unlocked = achievement.unlocked
  const name = stripEmoji(achievement.nameVi) || 'Huy hiệu'
  return (
    <View
      accessible
      accessibilityLabel={`${name}${unlocked ? '' : ', chưa mở'}${isNew ? ', mới' : ''}`}
      style={{
        flex: 1,
        alignItems: 'center',
        gap: 6,
        paddingVertical: space[3],
        paddingHorizontal: space[1],
        borderRadius: radius.lg,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
        opacity: unlocked ? 1 : 0.4,
      }}
    >
      <GaGlyph name={achievementGlyph(achievement.code)} size={26} ink={unlocked ? 'primary' : 'muted'} gold={unlocked ? 'accent' : 'none'} />
      <ThemedText variant="caption" color="secondary" align="center" numberOfLines={2} style={{ fontSize: 11, lineHeight: 14 }}>
        {name}
      </ThemedText>
      {isNew ? (
        <View style={{ position: 'absolute', top: -6, right: -4, backgroundColor: c.brand, borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 1 }}>
          <ThemedText variant="caption" style={{ color: c.onBrand, fontSize: 10, lineHeight: 13, fontFamily: fonts.bodyBold }}>
            Mới
          </ThemedText>
        </View>
      ) : null}
    </View>
  )
}

function Leaderboard({ entries, meId }: { entries: LeaderboardEntry[]; meId?: number }) {
  return (
    <View>
      <SectionHead title="Bảng xếp hạng" right="Toàn app" style={{ marginTop: space[4], marginBottom: space[3] }} />
      <RowList>
        {entries.map((e) => {
          const me = meId != null && e.userId === meId
          return (
            <Row
              key={e.userId}
              highlighted={me}
              title={`${e.displayName}${me ? ' (Bạn)' : ''}`}
              leading={
                <ThemedText variant="title" style={{ width: 32, fontVariant: ['tabular-nums'] }}>
                  {e.rank}
                </ThemedText>
              }
              trailing={
                <ThemedText variant="caption" color="muted">
                  {`${formatCountVi(e.totalXp)} XP`}
                </ThemedText>
              }
            />
          )
        })}
      </RowList>
    </View>
  )
}

function ErrorSkillsCard({ errors }: { errors: ErrorSkill[] }) {
  const c = useTheme().colors
  return (
    <View>
      <SectionHead title="Cần cải thiện" right="30 ngày qua" style={{ marginTop: space[4], marginBottom: space[3] }} />
      <RowList>
        {errors.map((e) => (
          <View key={e.errorCode} style={{ gap: 4, paddingVertical: space[3], paddingHorizontal: space[4] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
              <ThemedText variant="body" style={{ flex: 1, fontFamily: fonts.bodyMedium }} numberOfLines={1}>
                {e.ruleViShort ?? getErrorTitle(e.errorCode)}
              </ThemedText>
              <Badge label={`${e.count} lần`} />
            </View>
            {e.sampleWrong && e.sampleCorrected ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <ThemedText variant="caption" style={{ color: c.danger, textDecorationLine: 'line-through' }}>
                  {e.sampleWrong}
                </ThemedText>
                <Icon icon={ArrowRight} size={12} color="faint" />
                <ThemedText variant="caption" style={{ color: c.success }}>
                  {e.sampleCorrected}
                </ThemedText>
              </View>
            ) : null}
          </View>
        ))}
      </RowList>
    </View>
  )
}

function SessionRow({ session }: { session: AiSpeakingSession }) {
  const mode = sessionModeLabel(session.sessionMode)
  const hasReport = !!session.interviewReportJson
  const date = shortDate(session.startedAt)
  return (
    <Row
      glyph={session.sessionMode === 'INTERVIEW' ? 'phongvan' : 'hoithoai'}
      title={session.interviewPosition || session.topic || 'Buổi luyện nói'}
      subtitle={date ? `${date} · ${mode}` : mode}
      trailing={hasReport ? <Badge label="Báo cáo" tone="success" /> : undefined}
    />
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
