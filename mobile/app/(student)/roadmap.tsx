import { useState } from 'react'
import { Pressable, SectionList, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, type Href } from 'expo-router'
import { Lock, Check, RefreshCw } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import {
  Screen,
  Card,
  ThemedText,
  Icon,
  IconButton,
  Pill,
  Caption,
  YellowSquare,
  ProgressBar,
  AppHeader,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/components/ui'
import { SkillTreeView } from '@/components/SkillTreeView'
import { NodeSheet } from '@/components/skill-tree/sheets/NodeSheet'
import { skillTreeApi, type SkillNode } from '@/lib/skillTreeApi'
import { useCompanion } from '@/lib/treeCompanion'

type LevelState = 'done' | 'current' | 'locked'
type RoadmapTab = 'tree' | 'phase'

export default function RoadmapScreen() {
  const [tab, setTab] = useState<RoadmapTab>('tree')
  const [viewport, setViewport] = useState<{ w: number; h: number } | null>(null)
  const [selectedNode, setSelectedNode] = useState<SkillNode | null>(null)
  const { companion, setCompanion } = useCompanion()
  const { data: nodes = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['skill-tree'],
    queryFn: () => skillTreeApi.getMySkillTree(),
    staleTime: 120_000,
  })

  const grouped = nodes.reduce<Record<string, SkillNode[]>>((acc, node) => {
    const key = node.cefrLevel
    if (!acc[key]) acc[key] = []
    acc[key].push(node)
    return acc
  }, {})
  const sections = Object.entries(grouped).map(([level, data]) => ({ level, data }))

  // Presentation-only progress summary derived from the already-fetched nodes.
  const total = nodes.length
  const done = nodes.filter((n) => n.status === 'COMPLETED').length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <Screen edges={['top']}>
      <AppHeader
        title="Lộ trình học"
        subtitle="Hành trình A1 → B2"
        onBack={() => router.back()}
        right={<IconButton icon={RefreshCw} accessibilityLabel="Làm mới" onPress={() => void refetch()} />}
      />
      <RoadmapTabs tab={tab} onTab={setTab} />
      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <Skeleton height={108} radius="md" />
          <Skeleton height={72} radius="md" />
          <Skeleton height={72} radius="md" />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : tab === 'tree' ? (
        nodes.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState
              icon={Lock}
              title="Chưa có lộ trình"
              message="Hoàn thành bài đánh giá đầu vào để mở lộ trình học của bạn."
            />
          </View>
        ) : (
          <View
            style={{ flex: 1 }}
            onLayout={(e) => {
              const { width: w, height: h } = e.nativeEvent.layout
              // no-op guard: re-setting identical dims would re-render → loop (memory 660c753a)
              setViewport((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }))
            }}
          >
            {viewport ? (
              <SkillTreeView
                nodes={nodes}
                viewportW={viewport.w}
                viewportH={viewport.h}
                companion={companion}
                onCompanionChange={setCompanion}
                onSelectNode={setSelectedNode}
              />
            ) : null}
            {total > 0 ? (
              <View pointerEvents="box-none" style={{ position: 'absolute', top: space[3], left: space[5], right: space[5] }}>
                <PathHeroCompact done={done} total={total} pct={pct} />
              </View>
            ) : null}
          </View>
        )
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          refreshing={isFetching && !isLoading}
          onRefresh={() => void refetch()}
          contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: space[8], flexGrow: 1 }}
          ListHeaderComponent={total > 0 ? <PathHero done={done} total={total} pct={pct} /> : null}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <EmptyState
                icon={Lock}
                title="Chưa có lộ trình"
                message="Hoàn thành bài đánh giá đầu vào để mở lộ trình học của bạn."
              />
            </View>
          }
          renderSectionHeader={({ section }) => (
            <LevelHeader level={section.level} state={levelStateOf(section.data)} />
          )}
          renderItem={({ item, index, section }) => (
            <NodeRow node={item} isLast={index === section.data.length - 1} />
          )}
          removeClippedSubviews
        />
      )}
      <NodeSheet node={selectedNode} onClose={() => setSelectedNode(null)} />
    </Screen>
  )
}

// Compact path-completion metric, pinned as an overlay on the pan/zoom tree tab
// (the full ink PathHero is the phase tab's list header).
function PathHeroCompact({ done, total, pct }: { done: number; total: number; pct: number }) {
  const c = useTheme().colors
  return (
    <Card style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface, paddingVertical: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <ThemedText variant="titleLg" style={{ color: c.onInk }}>
          {String(pct)}%
        </ThemedText>
        <View style={{ flex: 1, gap: space[1] }}>
          <ThemedText variant="caption" style={{ color: c.onInkMuted }}>
            {done}/{total} chặng
          </ThemedText>
          <ProgressBar value={total > 0 ? done / total : 0} fillColor={c.accent} />
        </View>
      </View>
    </Card>
  )
}

function levelStateOf(data: SkillNode[]): LevelState {
  if (data.some((n) => n.status === 'IN_PROGRESS')) return 'current'
  if (data.some((n) => n.status === 'AVAILABLE')) return 'current'
  if (data.length > 0 && data.every((n) => n.status === 'COMPLETED')) return 'done'
  return 'locked'
}

// Tree / phase view switch (na-tree RmTabs) — ink-active segmented control.
function RoadmapTabs({ tab, onTab }: { tab: RoadmapTab; onTab: (t: RoadmapTab) => void }) {
  const c = useTheme().colors
  const tabs: [RoadmapTab, string][] = [
    ['tree', 'Cây học tập'],
    ['phase', 'Giai đoạn'],
  ]
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 1,
        marginHorizontal: space[5],
        marginTop: space[2],
        marginBottom: space[3],
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: radius.md,
        overflow: 'hidden',
      }}
    >
      {tabs.map(([k, label]) => {
        const active = tab === k
        return (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
            onPress={() => onTab(k)}
            style={{
              flex: 1,
              paddingVertical: space[2],
              alignItems: 'center',
              backgroundColor: active ? c.inkSurface : c.surface,
            }}
          >
            <ThemedText variant="label" color={active ? 'onInk' : 'muted'}>
              {label}
            </ThemedText>
          </Pressable>
        )
      })}
    </View>
  )
}

// Editorial ink hero — the headline path-completion metric, mirrors the Home hero.
function PathHero({ done, total, pct }: { done: number; total: number; pct: number }) {
  const c = useTheme().colors
  return (
    <Card style={{ marginTop: space[3], backgroundColor: c.inkSurface, borderColor: c.inkSurface }}>
      <Caption color={c.accent}>Tiến độ lộ trình</Caption>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2], marginTop: space[1] }}>
        <ThemedText variant="displayLg" style={{ color: c.onInk }}>
          {String(pct)}%
        </ThemedText>
        <ThemedText variant="bodyStrong" style={{ color: c.onInkMuted }}>
          {done}/{total} chặng
        </ThemedText>
      </View>
      <View style={{ marginTop: space[3] }}>
        {/* default light track (surfaceSunken) reads as a neutral rail on the dark ink card */}
        <ProgressBar value={total > 0 ? done / total : 0} fillColor={c.accent} />
      </View>
      <ThemedText variant="caption" style={{ color: c.onInkMuted, marginTop: space[2] }}>
        Hoàn thành từng chặng để mở khoá cấp độ tiếp theo
      </ThemedText>
    </Card>
  )
}

function LevelHeader({ level, state }: { level: string; state: LevelState }) {
  const c = useTheme().colors
  const isCurrent = state === 'current'
  const isDone = state === 'done'

  const badgeBg = isCurrent ? c.inkSurface : c.surface
  const badgeBorder = isCurrent ? c.inkSurface : c.border
  const codeColor = isCurrent ? c.onInk : c.textPrimary
  const eyebrow = isCurrent ? 'Cấp độ hiện tại' : isDone ? 'Đã hoàn thành' : 'Sắp mở khoá'
  const eyebrowColor = isCurrent ? c.accentText : c.textSecondary

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        marginTop: space[6],
        marginBottom: space[4],
      }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: radius.md,
          backgroundColor: badgeBg,
          borderWidth: 1,
          borderColor: badgeBorder,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ThemedText variant="title" style={{ color: codeColor }}>
          {level}
        </ThemedText>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Caption color={eyebrowColor}>{eyebrow}</Caption>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <ThemedText variant="titleLg">{`Cấp độ ${level}`}</ThemedText>
          {isDone ? <Icon icon={Check} size={16} color="success" strokeWidth={2.5} /> : null}
        </View>
      </View>
    </View>
  )
}

function NodeRow({ node, isLast }: { node: SkillNode; isLast: boolean }) {
  const c = useTheme().colors
  const isLocked = node.status === 'LOCKED'
  const isDone = node.status === 'COMPLETED'
  const isActive = node.status === 'IN_PROGRESS'

  // VoiceOver status word so the marker icon's meaning isn't conveyed by colour/shape alone.
  const statusText = isDone ? 'đã hoàn thành' : isActive ? 'đang học' : isLocked ? 'đã khoá' : 'sẵn sàng'
  const onPress = () =>
    router.push({
      // Route exists; typed-route union regenerates on next `expo start`.
      pathname: '/(student)/node',
      params: { nodeId: String(node.id), title: node.title },
    } as unknown as Href)

  // Timeline dot: ink (done), card + yellow ring (active), faint hairline (locked/available).
  const dotBg = isDone ? c.inkSurface : isActive ? c.surface : c.bg
  const dotBorder = isDone ? c.inkSurface : isActive ? c.accent : c.borderStrong
  const borderColor = isActive ? c.accent : isDone ? c.successSoft : c.border

  return (
    <View style={{ flexDirection: 'row' }}>
      {/* spine */}
      <View style={{ width: 34, alignItems: 'center' }}>
        <View
          style={{
            marginTop: space[4],
            width: 26,
            height: 26,
            borderRadius: radius.full,
            backgroundColor: dotBg,
            borderWidth: 2,
            borderColor: dotBorder,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isDone ? (
            <Check size={14} color={c.onInk} strokeWidth={3} />
          ) : isActive ? (
            <YellowSquare size={8} />
          ) : isLocked ? (
            <Lock size={12} color={c.textFaint} strokeWidth={2.5} />
          ) : (
            <View style={{ width: 7, height: 7, borderRadius: radius.full, backgroundColor: c.textFaint }} />
          )}
        </View>
        {!isLast ? (
          <View style={{ flex: 1, width: 2, backgroundColor: isDone ? c.inkSurface : c.border, marginTop: space[1] }} />
        ) : null}
      </View>

      <Card
        bordered
        onPress={onPress}
        disabled={isLocked}
        accessibilityLabel={`${node.title}, ngày ${node.dayNumber}, ${statusText}`}
        style={{
          flex: 1,
          marginLeft: space[3],
          marginBottom: space[3],
          borderColor,
          backgroundColor: isActive ? c.accentSoft : c.surface,
          opacity: isLocked ? 0.55 : 1,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space[2] }}>
          <View style={{ flex: 1, gap: space[1] }}>
            <Caption color={isLocked ? c.textFaint : c.textSecondary}>
              {isDone ? 'Hoàn thành' : isActive ? 'Đang học' : isLocked ? 'Mở khoá sau' : `Ngày ${node.dayNumber}`}
            </Caption>
            <ThemedText variant="title" color={isLocked ? 'faint' : 'primary'}>
              {node.title}
            </ThemedText>
            <ThemedText variant="caption" color="muted">
              {`Ngày ${node.dayNumber}`}
            </ThemedText>
          </View>
          {isActive ? <Pill label="Đang học" tone="accent" solid /> : null}
        </View>

        {node.tags && node.tags.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[1], marginTop: space[3] }}>
            {node.tags.slice(0, 3).map((tag) => (
              <NodeTag key={tag} label={tag} />
            ))}
          </View>
        ) : null}

        {isActive ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: space[3] }}>
            <YellowSquare size={7} />
            <ThemedText variant="label" color="accent">
              Tiếp tục học
            </ThemedText>
          </View>
        ) : null}
      </Card>
    </View>
  )
}

function NodeTag({ label }: { label: string }) {
  const c = useTheme().colors
  return (
    <View
      style={{
        backgroundColor: c.surfaceSunken,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: radius.sm,
        paddingHorizontal: space[2],
        paddingVertical: 3,
      }}
    >
      <ThemedText variant="caption" color="muted">
        {label}
      </ThemedText>
    </View>
  )
}
