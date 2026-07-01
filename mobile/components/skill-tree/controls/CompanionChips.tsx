// Companion picker — a light horizontal row of the 5 companion choices. The full
// FilterBar + Legend is Pha 4; this is the minimal control the spec asks for in
// Pha 2. a11y (role=button + selected + 44pt target) comes from SelectableChip.

import { ScrollView, View } from 'react-native'
import { SelectableChip, ThemedText } from '@/components/ui'
import { radius, space, useTheme } from '@/lib/theme'
import { COMPANIONS, type CompanionKey } from '@/lib/treeCompanion'

export function CompanionChips({
  value,
  onChange,
}: {
  value: CompanionKey
  onChange: (key: CompanionKey) => void
}) {
  const c = useTheme().colors
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ alignItems: 'center', gap: space[2], paddingHorizontal: space[3] }}
    >
      <ThemedText variant="label" color="muted">
        Bạn đồng hành
      </ThemedText>
      {COMPANIONS.map((comp) => {
        const selected = value === comp.key
        return (
          <SelectableChip
            key={comp.key}
            label={`Bạn đồng hành: ${comp.label}`}
            selected={selected}
            onPress={() => onChange(comp.key)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: space[3],
              paddingVertical: space[2],
              borderRadius: radius.full,
              backgroundColor: selected ? c.accentSoft : c.surface,
              borderWidth: 1,
              borderColor: selected ? c.accent : c.border,
            }}
          >
            {comp.emoji ? <ThemedText variant="label">{comp.emoji}</ThemedText> : null}
            <ThemedText variant="label" color={selected ? 'primary' : 'muted'}>
              {comp.label}
            </ThemedText>
          </SelectableChip>
        )
      })}
    </ScrollView>
  )
}
