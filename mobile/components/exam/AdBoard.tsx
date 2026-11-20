// Lesen Teil 3 telc (`MATCH_AD_X`): bảng mẩu rao vặt chọn được từ phía mẩu tin (20/11/2026, owner: "bấm
// vào mẩu tin là hiện đáp án lên để tôi chọn"). Chạm một mẩu ⇒ khay kính liệt kê các tình huống; chạm một
// tình huống là gán mẩu đó làm đáp án (Teil "mỗi mẩu một lần" ⇒ mẩu chuyển khỏi tình huống cũ), chạm lại để
// bỏ. Thẻ tình huống bên dưới vẫn chọn được như cũ (kể cả `x` — không mẩu nào hợp). Bút đánh dấu: Teil này
// mở với bút tắt; bật bút thì chạm chữ là tô, chạm khoảng trống / chữ cái của mẩu vẫn mở khay.
// Trạng thái khay ở đây để `ObjGroupView` vẫn là hàm thuần. Logic gán: `lib/adMatch.ts`.

import { useState } from 'react'
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import { Caption, ThemedText } from '@/components/ui'
import { NONE_OF_THEM, type ExamObjGroup } from '@/lib/examApi'
import { assignAd, situationNo, situationsOf } from '@/lib/adMatch'
import { trayLayout, TRAY_TOP_GAP } from '@/lib/headlineMatch'
import type { MarksLayer } from '@/hooks/usePassageMarks'
import { AdPosterCard } from './AdPosterCard'

interface Props {
  group: ExamObjGroup
  answers: Record<string, string>
  onAnswer: (itemId: string, value: string) => void
  /** Đang xem kết quả: mẩu không chạm được, chỉ hiện nhãn câu đã gán. */
  reviewing: boolean
  marks?: MarksLayer | null
}

export function AdBoard({ group, answers, onAnswer, reviewing, marks }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const pool = group.pool ?? []
  const ids = group.items.map((it) => it.id)
  const noOf = (id: string) => situationNo(id, ids.indexOf(id))
  const ad = open ? pool.find((p) => p.key === open) : undefined

  const pick = (sitId: string) => {
    if (!open || reviewing) return
    for (const [id, value] of assignAd(ids, answers, sitId, open, group.singleUse === true)) onAnswer(id, value)
    setOpen(null)
  }

  return (
    <View style={{ gap: space[3] }}>
      <Caption>{group.singleUse ? 'Các mẩu rao vặt · mỗi mẩu chỉ dùng một lần' : 'Các mẩu rao vặt'}</Caption>
      {reviewing ? null : (
        <ThemedText variant="caption" color="muted">
          Chạm một mẩu tin để chọn tình huống hợp với nó.
        </ThemedText>
      )}
      {pool.map((opt, i) => (
        <AdPosterCard
          key={opt.key}
          letter={opt.key}
          label={opt.label}
          index={i}
          marks={marks}
          assignedTo={situationsOf(ids, answers, opt.key).map(noOf)}
          onPress={reviewing ? undefined : () => setOpen(opt.key)}
        />
      ))}
      <SituationTray
        open={!!ad && !reviewing}
        letter={ad?.key ?? ''}
        adText={ad?.label ?? ''}
        group={group}
        answers={answers}
        noOf={noOf}
        onPick={pick}
        onClose={() => setOpen(null)}
      />
    </View>
  )
}

/** Khay kính: nhắc lại mẩu tin đang chọn, rồi danh sách tình huống (đáp án hiện tại của từng tình huống). */
function SituationTray({
  open,
  letter,
  adText,
  group,
  answers,
  noOf,
  onPick,
  onClose,
}: {
  open: boolean
  letter: string
  adText: string
  group: ExamObjGroup
  answers: Record<string, string>
  noOf: (id: string) => string
  onPick: (sitId: string) => void
  onClose: () => void
}) {
  const t = useTheme()
  const c = t.colors
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const { sheetMax } = trayLayout(height, insets.top)
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Đóng khay tình huống" onPress={onClose} style={{ flex: 1, minHeight: insets.top + TRAY_TOP_GAP }} />
        <View
          style={{
            maxHeight: sheetMax,
            marginHorizontal: space[2],
            marginBottom: Math.max(insets.bottom, space[2]),
            borderRadius: 26,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: c.border,
            ...t.shadow.lifted,
          }}
        >
          <BlurView intensity={40} tint={t.blurTint} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ backgroundColor: c.glassFill, padding: space[3] + 2, gap: space[2], flexShrink: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <ThemedText variant="label" style={{ flex: 1 }} accessibilityRole="header">
                {`Mẩu ${letter} hợp với tình huống nào?`}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Xong, đóng khay"
                onPress={onClose}
                style={{ minHeight: 44, justifyContent: 'center', paddingLeft: space[2] }}
              >
                {({ pressed }) => (
                  <View style={{ height: 32, justifyContent: 'center', paddingHorizontal: space[3], borderRadius: radius.full, borderWidth: 1.5, borderColor: c.borderStrong, backgroundColor: pressed ? c.surfaceSunken : c.surface }}>
                    <ThemedText variant="label">Xong</ThemedText>
                  </View>
                )}
              </Pressable>
            </View>
            <ScrollView
              style={{ maxHeight: Math.round(height * 0.22), flexGrow: 0, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}
              contentContainerStyle={{ padding: space[3] }}
              accessibilityLabel={`Mẩu ${letter}`}
            >
              <ThemedText variant="body" accessibilityLanguage="de-DE">{adText}</ThemedText>
            </ScrollView>
            <ScrollView contentContainerStyle={{ gap: 6 }} style={{ flexShrink: 1 }}>
              {group.items.map((it) => {
                const cur = answers[it.id]
                const mine = cur === letter
                const other = !mine && !!cur
                const no = noOf(it.id)
                return (
                  <Pressable
                    key={it.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: mine }}
                    accessibilityLabel={`Tình huống ${no}. ${it.question}${mine ? ' (đang chọn mẩu này, chạm để bỏ)' : other ? ` (đang chọn ${cur === NONE_OF_THEM ? 'x' : `mẩu ${cur}`}, chạm để đổi)` : ''}`}
                    accessibilityLanguage="de-DE"
                    onPress={() => onPick(it.id)}
                    style={({ pressed }) => ({
                      minHeight: 44,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space[3] - 2,
                      paddingVertical: 8,
                      paddingHorizontal: space[3] - 2,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: mine ? c.info : c.borderStrong,
                      backgroundColor: mine ? c.infoSoft : pressed ? c.surfaceSunken : c.glassFillStrong,
                    })}
                  >
                    <View style={{ minWidth: 30, height: 26, paddingHorizontal: 4, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: mine ? c.info : c.surfaceSunken }}>
                      <ThemedText variant="label" style={{ color: mine ? c.onBrand : c.textPrimary, fontVariant: ['tabular-nums'] }}>{no}</ThemedText>
                    </View>
                    <ThemedText variant="body" style={{ flex: 1, fontFamily: fonts.displaySemi, color: c.textPrimary }}>
                      {it.question}
                    </ThemedText>
                    {other ? (
                      <View style={{ minWidth: 26, height: 26, borderRadius: 7, borderWidth: 1.5, borderColor: c.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
                        <ThemedText variant="label" color="secondary">{cur}</ThemedText>
                      </View>
                    ) : null}
                  </Pressable>
                )
              })}
            </ScrollView>
            <Caption>Chạm tình huống để gán mẩu này; chạm lại để bỏ. Ô chữ bên phải là mẩu tình huống đó đang chọn.</Caption>
          </View>
        </View>
      </View>
    </Modal>
  )
}
