import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, type Href } from 'expo-router'
import {
  BookOpen,
  Map,
  FlaskConical,
  Trophy,
  BookMarked,
  ChevronRight,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import {
  Screen,
  Card,
  ThemedText,
  Icon,
  Pill,
  Caption,
  YellowSquare,
  SectionHeader,
  FadeIn,
  ErrorState,
} from '@/components/ui'
import { skillTreeApi, type SkillNode } from '@/lib/skillTreeApi'
import { nextStudyDay } from '@/lib/roadmapDay'
import { SpotlightTarget } from '@/components/guide/SpotlightTour'
import { SPOTLIGHT_TARGETS } from '@/components/guide/spotlightTours'

type StatusTone = 'success' | 'accent' | 'info'

// Map a node status to its editorial Pill tone + label. Shared by the hero and
// the node rows so status colour stays consistent across the screen.
function nodeStatus(status: SkillNode['status']): { tone: StatusTone; label: string } {
  if (status === 'COMPLETED') return { tone: 'success', label: 'Hoàn thành' }
  if (status === 'IN_PROGRESS') return { tone: 'accent', label: 'Đang học' }
  return { tone: 'info', label: 'Bắt đầu' }
}

// Same push NodeCard uses — keeps the hero CTA on the existing node route.
function openNode(node: SkillNode) {
  router.push({
    pathname: '/(student)/node',
    params: { nodeId: String(node.id), title: node.title },
  } as unknown as Href)
}

export default function LearnScreen() {
  const { data: nodes = [], refetch, isFetching, isError } = useQuery({
    queryKey: ['skill-tree'],
    queryFn: () => skillTreeApi.getMySkillTree(),
    staleTime: 120_000,
  })

  const completed = nodes.filter((n) => n.status === 'COMPLETED').length
  const inProgress = nodes.filter((n) => n.status === 'IN_PROGRESS').slice(0, 3)
  const available = nodes.filter((n) => n.status === 'AVAILABLE').slice(0, 5)

  const tiles: { icon: LucideIcon; label: string; count: string; onPress: () => void }[] = [
    { icon: BookOpen, label: 'SRS Flashcards', count: `${completed} đã học`, onPress: () => router.push('/(student)/srs') },
    { icon: Map, label: 'Lộ trình', count: `Ngày ${nextStudyDay(nodes)}`, onPress: () => router.push('/(student)/roadmap') },
    { icon: FlaskConical, label: 'Từ vựng', count: 'Tìm & luyện', onPress: () => router.push('/(student)/vocabulary') },
    { icon: Trophy, label: 'Thi thử', count: 'Mock Exam', onPress: () => router.push('/(student)/exam') },
    { icon: BookMarked, label: 'Ngữ pháp', count: 'Casus & quy tắc', onPress: () => router.push('/(student)/grammar') },
    // Tutor booking (1:1 marketplace) is out of MVP scope and the screen's slot
    // model has no backend equivalent — hidden until reworked to the duration-based
    // /api/teacher-sessions flow. See docs reconciliation §book-session.
  ]

  if (isError && nodes.length === 0) {
    return (
      <Screen
        scroll
        edges={['top']}
        contentStyle={{ paddingBottom: space[6] }}
        refreshing={isFetching}
        onRefresh={() => void refetch()}
      >
        <LearnHeader />
        <ErrorState onRetry={() => void refetch()} />
      </Screen>
    )
  }

  // Hero = "chặng đang sáng": node dở dang nếu có, không thì node khả dụng đầu
  // tiên — user mới (chưa học gì) vẫn có một chặng bấm được ngay, và spotlight
  // tour (bước 3/5) có element thật để neo.
  const resume = inProgress[0] ?? available[0]

  return (
    <Screen
      scroll
      edges={['top']}
      contentStyle={{ paddingBottom: space[6] }}
      refreshing={isFetching}
      onRefresh={() => void refetch()}
    >
      <LearnHeader />

      {/* Resume hero — editorial ink card for the primary "continue" action.
          Falls back to a progress summary when nothing is in progress. */}
      <FadeIn delay={40}>
        <View style={{ paddingHorizontal: space[5], marginTop: space[3] }}>
          {resume ? (
            <SpotlightTarget id={SPOTLIGHT_TARGETS.learnActiveNode}>
              <ResumeHero node={resume} />
            </SpotlightTarget>
          ) : (
            <ProgressHero completed={completed} />
          )}
        </View>
      </FadeIn>

      <FadeIn delay={80}>
        <View style={{ paddingHorizontal: space[5], marginTop: space[6] }}>
          <Caption style={{ marginBottom: space[3] }}>Bộ công cụ</Caption>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
            {tiles.map((t) => (
              <LearningTile key={t.label} icon={t.icon} label={t.label} count={t.count} onPress={t.onPress} />
            ))}
          </View>
        </View>
      </FadeIn>

      {inProgress.length > 0 ? (
        <FadeIn delay={140}>
          <View style={{ paddingHorizontal: space[5], marginTop: space[6] }}>
            <SectionHeader title="Đang học" actionLabel="Xem tất cả" onAction={() => router.push('/(student)/roadmap')} />
            <View style={{ gap: space[2] }}>
              {inProgress.map((node) => (
                <NodeCard key={node.id} node={node} />
              ))}
            </View>
          </View>
        </FadeIn>
      ) : null}

      {available.length > 0 ? (
        <FadeIn delay={220}>
          <View style={{ paddingHorizontal: space[5], marginTop: space[6] }}>
            <SectionHeader title="Tiếp theo" actionLabel="Xem tất cả" onAction={() => router.push('/(student)/roadmap')} />
            <View style={{ gap: space[2] }}>
              {available.map((node) => (
                <NodeCard key={node.id} node={node} />
              ))}
            </View>
          </View>
        </FadeIn>
      ) : null}
    </Screen>
  )
}

function LearnHeader() {
  return (
    <View style={{ paddingHorizontal: space[5], paddingTop: space[3], paddingBottom: space[2], gap: space[1] }}>
      <Caption>Thư viện học tập</Caption>
      <ThemedText variant="display">Học tập</ThemedText>
      <ThemedText variant="body" color="muted">
        Tiếp tục lộ trình của bạn
      </ThemedText>
    </View>
  )
}

// Continue-learning hero: surfaces the first in-progress node on the editorial
// ink surface. Tapping it opens that node (same route as the node rows).
function ResumeHero({ node }: { node: SkillNode }) {
  const c = useTheme().colors
  const starting = node.status !== 'IN_PROGRESS'
  const heroLabel = starting ? 'Bắt đầu học' : 'Tiếp tục học'
  return (
    <Card
      onPress={() => openNode(node)}
      accessibilityLabel={`${heroLabel}: ${node.title}`}
      style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[2] }}>
        <YellowSquare size={8} />
        <Caption color={c.accent}>{heroLabel}</Caption>
      </View>
      <ThemedText variant="titleLg" style={{ color: c.onInk }} numberOfLines={2}>
        {node.title}
      </ThemedText>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space[3] }}>
        <ThemedText variant="caption" style={{ color: c.onInkMuted }}>
          {[`Ngày ${node.dayNumber}`, node.cefrLevel].filter(Boolean).join(' · ')}
        </ThemedText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
          <ThemedText variant="label" style={{ color: c.accent }}>
            Vào học
          </ThemedText>
          <Icon icon={ArrowRight} size={16} color="accent" />
        </View>
      </View>
    </Card>
  )
}

// Fallback hero when nothing is mid-flight: the completed-count as the headline
// metric, on the same ink surface for visual continuity with the resume state.
function ProgressHero({ completed }: { completed: number }) {
  const c = useTheme().colors
  return (
    <Card style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: radius.lg,
            backgroundColor: c.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon icon={BookOpen} size={28} color="accent" />
        </View>
        <View style={{ flex: 1, gap: space[1] }}>
          <Caption color={c.accent}>Tiến độ</Caption>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
            <ThemedText variant="displayLg" style={{ color: c.onInk }}>
              {String(completed)}
            </ThemedText>
            <ThemedText variant="bodyStrong" style={{ color: c.onInkMuted }}>
              bài đã hoàn thành
            </ThemedText>
          </View>
          <ThemedText variant="caption" style={{ color: c.onInkMuted }}>
            Chọn một công cụ bên dưới để học tiếp
          </ThemedText>
        </View>
      </View>
    </Card>
  )
}

function LearningTile({
  icon,
  label,
  count,
  onPress,
}: {
  icon: LucideIcon
  label: string
  count: string
  onPress: () => void
}) {
  const c = useTheme().colors
  return (
    <Card onPress={onPress} accessibilityLabel={label} style={{ width: '47%', gap: space[3] }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.md,
          backgroundColor: c.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon icon={icon} size={20} color="accent" />
      </View>
      <View style={{ gap: 2 }}>
        <ThemedText variant="bodyStrong">{label}</ThemedText>
        <ThemedText variant="caption" color="muted">
          {count}
        </ThemedText>
      </View>
    </Card>
  )
}

function NodeCard({ node }: { node: SkillNode }) {
  const c = useTheme().colors
  const { tone, label } = nodeStatus(node.status)

  const toneColor: Record<StatusTone, string> = { success: c.success, accent: c.accentText, info: c.info }
  const toneSoft: Record<StatusTone, string> = { success: c.successSoft, accent: c.accentSoft, info: c.infoSoft }

  return (
    <Card onPress={() => openNode(node)} accessibilityLabel={node.title}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], flex: 1 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.md,
              backgroundColor: toneSoft[tone],
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ThemedText variant="mono" style={{ color: toneColor[tone] }}>
              D{node.dayNumber}
            </ThemedText>
          </View>
          <View style={{ gap: space[1], flex: 1 }}>
            <ThemedText variant="bodyStrong" numberOfLines={1}>
              {node.title}
            </ThemedText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <Pill label={label} tone={tone} />
              {node.cefrLevel ? (
                <ThemedText variant="caption" color="muted">
                  {node.cefrLevel}
                </ThemedText>
              ) : null}
            </View>
          </View>
        </View>
        <Icon icon={ChevronRight} size={16} color="faint" />
      </View>
    </Card>
  )
}
