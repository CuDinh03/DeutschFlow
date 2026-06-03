import { SectionList, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Lock, CheckCircle2, Circle, PlayCircle, type LucideIcon } from 'lucide-react-native'
import api from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, Pill, AppHeader, Skeleton } from '@/components/ui'

interface SkillNode {
  id: number
  title: string
  cefrLevel: string
  status: 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED'
  dayNumber: number
  tags?: string[]
}

type NodeIconRole = 'success' | 'accent' | 'info' | 'faint'

export default function RoadmapScreen() {
  const { data: nodes = [], isLoading } = useQuery({
    queryKey: ['skill-tree'],
    queryFn: () => api.get<SkillNode[]>('/skill-tree/me').then((r) => r.data),
    staleTime: 120_000,
  })

  const grouped = nodes.reduce<Record<string, SkillNode[]>>((acc, node) => {
    const key = node.cefrLevel
    if (!acc[key]) acc[key] = []
    acc[key].push(node)
    return acc
  }, {})
  const sections = Object.entries(grouped).map(([level, data]) => ({ level, data }))

  return (
    <Screen edges={['top']}>
      <AppHeader title="Lộ trình học" onBack={() => router.back()} />
      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[2], paddingTop: space[2] }}>
          <Skeleton height={72} radius="xl" />
          <Skeleton height={72} radius="xl" />
          <Skeleton height={72} radius="xl" />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: space[8] }}
          renderSectionHeader={({ section }) => (
            <View style={{ marginTop: space[5] }}>
              <LevelDivider level={section.level} />
            </View>
          )}
          renderItem={({ item, index, section }) => (
            <NodeRow node={item} isLast={index === section.data.length - 1} />
          )}
          removeClippedSubviews
        />
      )}
    </Screen>
  )
}

function LevelDivider({ level }: { level: string }) {
  const theme = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[3] }}>
      <View style={{ height: 1, flex: 1, backgroundColor: theme.colors.border }} />
      <Pill label={level} tone="neutral" />
      <View style={{ height: 1, flex: 1, backgroundColor: theme.colors.border }} />
    </View>
  )
}

function NodeRow({ node, isLast }: { node: SkillNode; isLast: boolean }) {
  const theme = useTheme()
  const isLocked = node.status === 'LOCKED'
  const isDone = node.status === 'COMPLETED'
  const isActive = node.status === 'IN_PROGRESS'

  const marker: { icon: LucideIcon; role: NodeIconRole } = isDone
    ? { icon: CheckCircle2, role: 'success' }
    : isActive
      ? { icon: PlayCircle, role: 'accent' }
      : isLocked
        ? { icon: Lock, role: 'faint' }
        : { icon: Circle, role: 'info' }

  const borderColor = isActive
    ? theme.colors.accent + '66'
    : isDone
      ? theme.colors.success + '4D'
      : theme.colors.border

  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ width: 32, alignItems: 'center' }}>
        <View style={{ marginTop: space[4] }}>
          <Icon icon={marker.icon} size={isLocked ? 18 : 22} color={marker.role} fill={isDone} />
        </View>
        {!isLast ? <View style={{ flex: 1, width: 1, backgroundColor: theme.colors.border, marginTop: space[1] }} /> : null}
      </View>

      <Card
        bordered
        onPress={isLocked ? undefined : () => {}}
        style={{ flex: 1, marginLeft: space[3], marginBottom: space[2], borderColor, opacity: isLocked ? 0.5 : 1 }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText variant="bodyStrong" color={isLocked ? 'faint' : 'primary'}>
              {node.title}
            </ThemedText>
            <ThemedText variant="caption" color="muted">
              Ngày {node.dayNumber}
            </ThemedText>
          </View>
          {isActive ? <Pill label="Đang học" tone="accent" /> : null}
        </View>
        {node.tags && node.tags.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[1], marginTop: space[2] }}>
            {node.tags.slice(0, 3).map((tag) => (
              <View
                key={tag}
                style={{
                  backgroundColor: theme.colors.surfaceSunken,
                  borderRadius: radius.full,
                  paddingHorizontal: space[2],
                  paddingVertical: 2,
                }}
              >
                <ThemedText variant="caption" color="muted">
                  {tag}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}
      </Card>
    </View>
  )
}
