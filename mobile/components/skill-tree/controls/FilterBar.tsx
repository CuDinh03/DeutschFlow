// Topic + skill filter (Pha 4). A single horizontal scroll row whose coloured
// chips double as the legend (6 topic groups + 4 skills, spec §7). Selecting a
// chip dims the non-matching branches/nodes in the tree; "Tất cả" clears it.

import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native'
import { Button, SelectableChip, ThemedText } from '@/components/ui'
import { radius, space, useTheme } from '@/lib/theme'
import { GROUP_COLORS, SKILL_DOTS, type TopicGroupKey } from '@/components/skill-tree/palette'

const GROUP_KEYS: TopicGroupKey[] = ['daily', 'work', 'travel', 'medical', 'culture', 'exam']

interface FilterBarProps {
  topic: TopicGroupKey | null
  skill: number | null
  onTopicChange: (t: TopicGroupKey | null) => void
  onSkillChange: (s: number | null) => void
  onClear: () => void
}

export function FilterBar({ topic, skill, onTopicChange, onSkillChange, onClear }: FilterBarProps) {
  const c = useTheme().colors
  const active = topic !== null || skill !== null

  const chipStyle = (on: boolean): StyleProp<ViewStyle> => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radius.full,
    backgroundColor: on ? c.accentSoft : c.surface,
    borderWidth: 1,
    borderColor: on ? c.accent : c.border,
  })

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ alignItems: 'center', gap: space[2], paddingHorizontal: space[5], paddingVertical: space[2] }}
    >
      <ThemedText variant="label" color="muted">
        Lọc
      </ThemedText>
      {GROUP_KEYS.map((k) => {
        const g = GROUP_COLORS[k]
        const on = topic === k
        return (
          <SelectableChip
            key={k}
            label={`Chủ đề ${g.name}`}
            selected={on}
            onPress={() => onTopicChange(on ? null : k)}
            style={chipStyle(on)}
          >
            <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: g.leaf }} />
            <ThemedText variant="label" color={on ? 'primary' : 'muted'}>
              {g.name}
            </ThemedText>
          </SelectableChip>
        )
      })}
      <View style={{ width: 1, height: 16, backgroundColor: c.border }} />
      {SKILL_DOTS.map((s, i) => {
        const on = skill === i
        return (
          <SelectableChip
            key={s.k}
            label={`Kỹ năng ${s.label}`}
            selected={on}
            onPress={() => onSkillChange(on ? null : i)}
            style={chipStyle(on)}
          >
            <View style={{ width: 9, height: 9, borderRadius: 9, backgroundColor: s.color }} />
            <ThemedText variant="label" color={on ? 'primary' : 'muted'}>
              {s.label}
            </ThemedText>
          </SelectableChip>
        )
      })}
      {active ? <Button label="Tất cả" variant="ghost" size="sm" fullWidth={false} onPress={onClear} /> : null}
    </ScrollView>
  )
}
