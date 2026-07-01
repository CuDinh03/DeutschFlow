// NodeSheet — the tap-in-place bottom sheet for a lesson fruit (spec Pha 2 §4).
// A plain RN overlay OUTSIDE the <Svg> (react-native-svg can't host touchable
// layout), animated up with Reanimated layout transitions. The CTA deep-links the
// REAL server-graded lesson route /(student)/node — it is NOT a micro-quiz stub
// (spec H5). Lives at the host level so it overlays the header/tabs/canvas cleanly.

import { Pressable, View } from 'react-native'
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated'
import { router, type Href } from 'expo-router'
import { Lock, Play, RotateCcw } from 'lucide-react-native'
import { Button, Pill, ThemedText } from '@/components/ui'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import { GROUP_COLORS, SKILL_DOTS } from '@/components/skill-tree/palette'
import { topicGroupOf } from '@/components/skill-tree/topicGroup'
import type { NodeStatus, SkillNode } from '@/lib/skillTreeApi'

type SheetMeta = { status: string; cta: string; tone: 'success' | 'accent' | 'info' | 'neutral' }

const SHEET: Record<NodeStatus, SheetMeta> = {
  COMPLETED: { status: 'Quả chín · đã hoàn thành', cta: 'Xem lại bài', tone: 'success' },
  IN_PROGRESS: { status: 'Hoa nở · đang học dở', cta: 'Tiếp tục học', tone: 'accent' },
  AVAILABLE: { status: 'Nụ · sẵn sàng học', cta: 'Bắt đầu học', tone: 'info' },
  LOCKED: { status: 'Đã khoá', cta: 'Hoàn thành lá trước để mở', tone: 'neutral' },
}

export function NodeSheet({ node, onClose }: { node: SkillNode | null; onClose: () => void }) {
  const c = useTheme().colors
  if (!node) return null

  const meta = SHEET[node.status]
  const locked = node.status === 'LOCKED'
  const skillColor = SKILL_DOTS[node.dayNumber % 4].color
  const group = GROUP_COLORS[topicGroupOf(node)]

  const onStart = () => {
    onClose()
    router.push({
      pathname: '/(student)/node',
      params: { nodeId: String(node.id), title: node.title },
    } as unknown as Href)
  }

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }}>
      <AnimatedScrim onPress={onClose} />
      <Animated.View
        entering={SlideInDown.duration(280)}
        exiting={SlideOutDown.duration(200)}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: c.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingHorizontal: space[5],
          paddingTop: space[3],
          paddingBottom: space[8],
          gap: space[3],
        }}
        accessibilityViewIsModal
      >
        <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: c.border, alignSelf: 'center' }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: skillColor }} />
          <Pill label={meta.status} tone={meta.tone} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: group.leaf }} />
          <ThemedText variant="label" color="muted">
            {`${group.name.toUpperCase()}${node.moduleTitle ? ` · ${node.moduleTitle}` : ''}`}
          </ThemedText>
        </View>

        <ThemedText style={{ fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 30, color: c.textPrimary }}>
          {node.title}
        </ThemedText>
        <ThemedText variant="caption" color="muted">
          {`Ngày ${node.dayNumber}${node.cefrLevel ? ` · ${node.cefrLevel}` : ''}`}
        </ThemedText>

        {locked ? (
          <Button label={meta.cta} icon={Lock} variant="ghost" size="lg" disabled onPress={onClose} />
        ) : (
          <Button
            label={meta.cta}
            icon={node.status === 'COMPLETED' ? RotateCcw : Play}
            variant="primary"
            size="lg"
            onPress={onStart}
          />
        )}
      </Animated.View>
    </View>
  )
}

function AnimatedScrim({ onPress }: { onPress: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(180)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Pressable accessibilityLabel="Đóng" onPress={onPress} style={{ flex: 1, backgroundColor: 'rgba(20,19,17,0.4)' }} />
    </Animated.View>
  )
}
