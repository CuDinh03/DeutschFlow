import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import {
  BookOpen,
  Map,
  FlaskConical,
  Trophy,
  BookMarked,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react-native'
import api from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, SectionHeader, FadeIn } from '@/components/ui'

interface SkillTreeNode {
  id: number
  title: string
  cefrLevel: string
  status: 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED'
  dayNumber: number
}

type StatusTone = 'success' | 'accent' | 'info'

export default function LearnScreen() {
  const { data: nodes = [], refetch, isFetching } = useQuery({
    queryKey: ['skill-tree'],
    queryFn: () => api.get<SkillTreeNode[]>('/skill-tree/me').then((r) => r.data),
    staleTime: 120_000,
  })

  const completed = nodes.filter((n) => n.status === 'COMPLETED').length
  const inProgress = nodes.filter((n) => n.status === 'IN_PROGRESS').slice(0, 3)
  const available = nodes.filter((n) => n.status === 'AVAILABLE').slice(0, 5)

  const tiles: { icon: LucideIcon; label: string; count: string; onPress: () => void }[] = [
    { icon: BookOpen, label: 'SRS Flashcards', count: `${completed} đã học`, onPress: () => router.push('/(student)/srs') },
    { icon: Map, label: 'Lộ trình', count: `Ngày ${inProgress[0]?.dayNumber ?? 1}`, onPress: () => router.push('/(student)/roadmap') },
    { icon: FlaskConical, label: 'Từ vựng', count: 'Tìm & luyện', onPress: () => router.push('/(student)/vocabulary') },
    { icon: Trophy, label: 'Thi thử', count: 'Mock Exam', onPress: () => router.push('/(student)/exam') },
    { icon: BookMarked, label: 'Ngữ pháp', count: 'Casus & quy tắc', onPress: () => router.push('/(student)/grammar') },
    // Tutor booking (1:1 marketplace) is out of MVP scope and the screen's slot
    // model has no backend equivalent — hidden until reworked to the duration-based
    // /api/teacher-sessions flow. See docs reconciliation §book-session.
  ]

  return (
    <Screen
      scroll
      edges={['top']}
      contentStyle={{ paddingBottom: space[6] }}
      refreshing={isFetching}
      onRefresh={() => void refetch()}
    >
      <View style={{ paddingHorizontal: space[5], paddingTop: space[3], paddingBottom: space[2], gap: 2 }}>
        <ThemedText variant="display">Học tập</ThemedText>
        <ThemedText variant="body" color="muted">
          Tiếp tục lộ trình của bạn
        </ThemedText>
      </View>

      <FadeIn delay={60}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3], paddingHorizontal: space[5], marginTop: space[4] }}>
          {tiles.map((t) => (
            <LearningTile key={t.label} icon={t.icon} label={t.label} count={t.count} onPress={t.onPress} />
          ))}
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
  const theme = useTheme()
  return (
    <Card onPress={onPress} style={{ width: '47%', alignItems: 'center', gap: space[2] }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radius.lg,
          backgroundColor: theme.colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon icon={icon} size={22} color="accent" />
      </View>
      <ThemedText variant="bodyStrong">{label}</ThemedText>
      <ThemedText variant="caption" color="muted">
        {count}
      </ThemedText>
    </Card>
  )
}

function NodeCard({ node }: { node: SkillTreeNode }) {
  const theme = useTheme()
  const c = theme.colors

  const tone: StatusTone = node.status === 'COMPLETED' ? 'success' : node.status === 'IN_PROGRESS' ? 'accent' : 'info'
  const statusLabel = node.status === 'COMPLETED' ? 'Hoàn thành' : node.status === 'IN_PROGRESS' ? 'Đang học' : 'Bắt đầu'

  const toneColor: Record<StatusTone, string> = { success: c.success, accent: c.accentText, info: c.info }
  const toneSoft: Record<StatusTone, string> = { success: c.successSoft, accent: c.accentSoft, info: c.infoSoft }

  return (
    <Card onPress={() => router.push('/(student)/roadmap')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <View
              style={{
                width: 40,
                height: 40,
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
            <View style={{ gap: 2 }}>
              <ThemedText variant="bodyStrong">{node.title}</ThemedText>
              <ThemedText variant="caption" color="muted">
                {node.cefrLevel}
              </ThemedText>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
            <ThemedText variant="label" style={{ color: toneColor[tone] }}>
              {statusLabel}
            </ThemedText>
            <Icon icon={ChevronRight} size={14} color="faint" />
          </View>
        </View>
    </Card>
  )
}
