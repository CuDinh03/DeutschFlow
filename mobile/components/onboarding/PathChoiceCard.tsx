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

export type MobilePathChoice = Extract<PathChoice, 'placement' | 'skip'>

const OPTIONS: { value: MobilePathChoice; label: string; desc: string; glyph: GlyphName }[] = [
  {
    value: 'placement',
    label: 'Kiểm tra nhanh 10 câu',
    desc: 'Khoảng 4 phút · 4 kỹ năng · lộ trình khớp đúng chỗ bạn đang đứng',
    glyph: 'thithu',
  },
  {
    value: 'skip',
    label: 'Bỏ qua, vào lộ trình',
    desc: 'Bắt đầu học ngay theo trình độ tự đánh giá, tinh chỉnh sau',
    glyph: 'lernweg',
  },
]

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
  const [choice, setChoice] = useState<MobilePathChoice | null>(null)
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: space[5] }}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
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
          title="Vào đúng trình độ của bạn?"
          sub={`Bạn tự đánh giá ${level}. Kiểm tra nhanh để lộ trình khớp chính xác — hoặc bắt đầu học ngay rồi tinh chỉnh sau.`}
        />
        <View accessibilityRole="radiogroup" style={{ gap: space[3] }}>
          {OPTIONS.map((opt) => {
            const selected = choice === opt.value
            return (
              <SelectableChip
                key={opt.value}
                label={`${opt.label} — ${opt.desc}`}
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
                  <ThemedText style={{ fontFamily: fonts.displaySemi, fontSize: 16.5, lineHeight: 20 }}>{opt.label}</ThemedText>
                  <ThemedText variant="caption" color="secondary">
                    {opt.desc}
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
          label="Tiếp tục"
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
          Bỏ qua bây giờ vẫn làm bài kiểm tra được sau, trong danh sách tuần đầu.
        </ThemedText>
      </View>
    </Screen>
  )
}
