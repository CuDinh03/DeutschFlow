// "Giai đoạn" tab header (na-roadmap stepper, real data). A 4-stage learning
// journey derived from the user's progress, a live progress snapshot, and the
// next suggested actions. Rendered ABOVE the accessible per-level node list (the
// list is kept as the screen-reader fallback for the gesture tree, so this is
// additive, not a replacement).

import { Pressable, View } from 'react-native'
import { router, type Href } from 'expo-router'
import { BookOpen, Check, ChevronRight, Mic, Repeat } from 'lucide-react-native'
import { Caption, Card, Icon, Pill, ThemedText, YellowSquare } from '@/components/ui'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import type { SkillNode } from '@/lib/skillTreeApi'
import { recommendedNodeId } from './layout'
import { deriveStages, type Stage } from './stages'

export function PhaseStepper({ nodes }: { nodes: SkillNode[] }) {
  const stages = deriveStages(nodes)
  const total = nodes.length
  const done = nodes.filter((n) => n.status === 'COMPLETED').length
  const inProgress = nodes.filter((n) => n.status === 'IN_PROGRESS').length
  const available = nodes.filter((n) => n.status === 'AVAILABLE').length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const recId = recommendedNodeId(nodes)
  const recNode = recId != null ? nodes.find((n) => n.id === recId) : undefined

  return (
    <View style={{ gap: space[5], marginTop: space[3], marginBottom: space[2] }}>
      <View>
        {stages.map((stage, i) => (
          <StageRow key={stage.title} stage={stage} isLast={i === stages.length - 1} />
        ))}
      </View>

      <Card>
        <Caption>Tiến độ hiện tại</Caption>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space[3] }}>
          <StatCell label="Chặng hoàn thành" value={`${done}/${total}`} />
          <StatCell label="Tổng tiến độ" value={`${pct}%`} />
          <StatCell label="Đang học" value={String(inProgress)} />
          <StatCell label="Sẵn sàng mở" value={String(available)} />
        </View>
      </Card>

      <View style={{ gap: space[2] }}>
        <Caption>Việc nên làm tiếp theo</Caption>
        {recNode ? (
          <NextAction
            icon={BookOpen}
            label={`Học tiếp: ${recNode.title}`}
            onPress={() =>
              router.push({
                pathname: '/(student)/node',
                params: { nodeId: String(recNode.id), title: recNode.title },
              } as unknown as Href)
            }
          />
        ) : null}
        <NextAction icon={Repeat} label="Ôn tập thẻ tới hạn (SRS)" onPress={() => router.push('/(student)/srs' as Href)} />
        <NextAction icon={Mic} label="Luyện nói với AI" onPress={() => router.push('/(student)/speaking' as Href)} />
      </View>
    </View>
  )
}

function StageRow({ stage, isLast }: { stage: Stage; isLast: boolean }) {
  const c = useTheme().colors
  const done = stage.state === 'done'
  const active = stage.state === 'active'
  const dotBg = active ? c.inkSurface : done ? c.success : c.surface
  const dotBorder = active ? c.inkSurface : done ? c.success : c.border
  const spineColor = done ? c.success : c.border

  return (
    <View style={{ flexDirection: 'row', gap: space[3], paddingBottom: isLast ? 0 : space[5] }}>
      <View style={{ alignItems: 'center', width: 26 }}>
        <View
          style={{
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
          {done ? (
            <Check size={15} color={c.onInk} strokeWidth={3} />
          ) : active ? (
            <YellowSquare size={8} />
          ) : (
            <View style={{ width: 7, height: 7, borderRadius: radius.full, backgroundColor: c.textFaint }} />
          )}
        </View>
        {!isLast ? <View style={{ flex: 1, width: 2, backgroundColor: spineColor, marginTop: space[1] }} /> : null}
      </View>
      <View style={{ flex: 1, paddingTop: 2, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <ThemedText style={{ fontFamily: fonts.displayBold, fontSize: 18, color: active || done ? c.textPrimary : c.textSecondary }}>
            {stage.title}
          </ThemedText>
          {active ? <Pill label="Hiện tại" tone="accent" solid /> : null}
        </View>
        <ThemedText variant="caption" color="muted">
          {stage.sub}
        </ThemedText>
      </View>
    </View>
  )
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ width: '50%', paddingVertical: space[2] }}>
      <ThemedText style={{ fontFamily: fonts.displayBold, fontSize: 23, lineHeight: 26 }}>{value}</ThemedText>
      <ThemedText variant="caption" color="muted" style={{ marginTop: 4 }}>
        {label}
      </ThemedText>
    </View>
  )
}

function NextAction({
  icon,
  label,
  onPress,
}: {
  icon: typeof BookOpen
  label: string
  onPress: () => void
}) {
  const c = useTheme().colors
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        padding: space[3],
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: radius.md,
          backgroundColor: c.surfaceSunken,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon icon={icon} size={18} color="primary" />
      </View>
      <ThemedText variant="bodyStrong" style={{ flex: 1 }}>
        {label}
      </ThemedText>
      <Icon icon={ChevronRight} size={18} color="faint" />
    </Pressable>
  )
}
