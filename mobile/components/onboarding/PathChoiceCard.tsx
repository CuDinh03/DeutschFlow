// M5b — Chọn đường (Đợt 3 PR-2 kế hoạch onboarding 17/09/2026), trạng thái `PATH_CHOICE`.
//
// Chỉ A1+ thấy màn này. Hai lựa chọn mobile có: kiểm tra đầu vào 10 câu (M8b) hoặc bỏ qua
// vào lộ trình; "nói thử 3′" là đường web, chưa có trên mobile. Thuần trình bày: KHÔNG biết
// khách hay đã đăng nhập — cha quyết định ghi ở đâu (guest session + draft, hay đi thẳng).
// Dùng ở hai nơi: sub-screen trong wizard khách (sau quick win) và route `(auth)/path-choice`
// cho người đăng ký thẳng (fixture R5: A1+ chưa chọn đường → hỏi sau khi có plan).

import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { ArrowRight, ChevronLeft } from 'lucide-react-native'
import type { GlyphName } from '@/lib/galerieGlyphs'
import type { PathChoice } from '@/lib/onboardingMachine'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import { Button, Icon, Screen, SelectableChip, ThemedText } from '@/components/ui'
import { IconTile, RadioDot, TitleBlock } from '@/components/onboarding/WizardParts'
import { useT } from '@/lib/i18n'
import { pathChoiceMessages } from '@/lib/i18n/messages/pathChoice'

export type MobilePathChoice = Extract<PathChoice, 'placement' | 'skip'>

const OPTIONS = [
  { value: 'placement', labelKey: 'options.placement.label', descKey: 'options.placement.desc', glyph: 'thithu' },
  { value: 'skip', labelKey: 'options.skip.label', descKey: 'options.skip.desc', glyph: 'lernweg' },
] as const satisfies readonly { value: MobilePathChoice; labelKey: string; descKey: string; glyph: GlyphName }[]

interface PathChoiceCardProps {
  /** Trình độ tự khai (A1–C2) — hiện trong lời dẫn. */
  level: string
  /** Chữ nhỏ trên tiêu đề: khách = "Trước khi lưu", đã đăng ký = "Trước khi vào lộ trình". */
  cap: string
  onPick: (choice: MobilePathChoice) => void
  /** Có nút lùi (khách quay về quick win); route đã đăng ký không có. */
  onBack?: () => void
  busy?: boolean
}

export function PathChoiceCard({ level, cap, onPick, onBack, busy = false }: PathChoiceCardProps) {
  const c = useTheme().colors
  const t = useT(pathChoiceMessages)
  const [choice, setChoice] = useState<MobilePathChoice | null>(null)
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: space[5] }}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('card.back')}
            hitSlop={10}
            onPress={onBack}
            style={{ marginLeft: -space[2], padding: space[1] }}
          >
            <Icon icon={ChevronLeft} size={26} color="primary" />
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space[6], paddingTop: space[2], paddingBottom: space[8], gap: space[5] }}
        showsVerticalScrollIndicator={false}
      >
        <TitleBlock
          cap={cap}
          title={t('card.title')}
          sub={t('card.sub', { level })}
        />
        <View accessibilityRole="radiogroup" style={{ gap: space[3] }}>
          {OPTIONS.map((opt) => {
            const selected = choice === opt.value
            const label = t(opt.labelKey)
            const desc = t(opt.descKey)
            return (
              <SelectableChip
                key={opt.value}
                label={`${label} — ${desc}`}
                selected={selected}
                disabled={busy}
                onPress={() => {
                  void Haptics.selectionAsync()
                  setChoice(opt.value)
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space[3],
                  padding: space[3] + 2,
                  borderRadius: radius.md,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? c.accentText : c.border,
                  backgroundColor: selected ? c.accentSoft : c.surface,
                }}
              >
                <IconTile glyph={opt.glyph} selected={selected} size={44} />
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText style={{ fontFamily: fonts.displaySemi, fontSize: 16.5, lineHeight: 20 }}>{label}</ThemedText>
                  <ThemedText variant="caption" color="secondary">
                    {desc}
                  </ThemedText>
                </View>
                <RadioDot selected={selected} />
              </SelectableChip>
            )
          })}
        </View>
      </ScrollView>
      <View
        style={{
          gap: space[2],
          borderTopWidth: 1,
          borderTopColor: c.border,
          backgroundColor: c.surface,
          paddingHorizontal: space[6],
          paddingTop: space[4],
          paddingBottom: space[2],
        }}
      >
        <Button
          label={t('card.continue')}
          icon={ArrowRight}
          iconRight
          disabled={!choice || busy}
          loading={busy}
          onPress={() => {
            if (!choice) return
            onPick(choice)
          }}
        />
        <ThemedText variant="caption" color="secondary" align="center">
          {t('card.footnote')}
        </ThemedText>
      </View>
    </Screen>
  )
}
