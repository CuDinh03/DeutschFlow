// Lesen Teil 1 telc (nối tiêu đề, `MATCH_HEADLINE`) theo mẫu v3.4 `lesen1` (20/11/2026): mỗi văn bản
// là một thẻ có số thứ tự serif, dưới thẻ là ô "Chọn tiêu đề"; chạm ô ⇒ khay kính 10 tiêu đề a–j trượt
// lên (tiêu đề đã dùng viền đứt, chọn vẫn được = chuyển sang đoạn này), chọn xong tự sang đoạn kế chưa
// có. Sau kiểm tra: ô hiện đúng/sai + lời giải như thẻ câu thường. Dùng chung luyện Teil, thi thử, bài
// chẩn đoán, xem lại (qua `ObjGroupView`). Trạng thái khay ở đây (component con), `ObjGroupView` vẫn
// là hàm thuần. Logic chọn: `lib/headlineMatch.ts`.

import { useRef, useState, type ReactNode } from 'react'
import { Modal, Pressable, ScrollView, View } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check, X } from 'lucide-react-native'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import { Caption, Icon, ThemedText } from '@/components/ui'
import type { ExamObjGroup, ExamObjItem } from '@/lib/examApi'
import type { PracticeItemResult } from '@/lib/telcPracticeApi'
import { answeredItems, pickHeadline, usedHeadlines } from '@/lib/headlineMatch'
import { matchBlock } from '@/lib/marksBlocks'
import type { MarksLayer } from '@/hooks/usePassageMarks'
import { MarkedRun } from './MarkedRun'
import { FlagToggle, ItemExplanation } from './ItemParts'

/** Nền navy 7% của ô đã chọn (mẫu `.hslot.ok`). */
const NAVY_TINT = 'rgba(35,64,110,0.07)'
const TEXT_FONT = { fontFamily: fonts.displaySemi, fontSize: 15.5, lineHeight: 24 }

interface Props {
  group: ExamObjGroup
  answers: Record<string, string>
  onAnswer: (itemId: string, value: string) => void
  review?: Map<string, PracticeItemResult>
  flags?: readonly string[]
  onToggleFlag?: (itemId: string) => void
  onItemLayout?: (itemId: string, y: number) => void
  marks?: MarksLayer | null
  renderItemExtra?: (item: ExamObjItem) => ReactNode
}

/** Số đoạn hiển thị: "Text 3" → 3, không thì thứ tự. */
function numberOf(item: ExamObjItem, idx: number): string {
  return /^Text\s*(\d+)/i.exec(item.question)?.[1] ?? String(idx + 1)
}

export function HeadlineMatch({ group, answers, onAnswer, review, flags, onToggleFlag, onItemLayout, marks, renderItemExtra }: Props) {
  const c = useTheme().colors
  const [active, setActive] = useState<string | null>(null)
  const [trayOpen, setTrayOpen] = useState(false)
  const pool = group.pool ?? []
  const ids = group.items.map((it) => it.id)
  const used = usedHeadlines(ids, answers)
  const labelOf = (key: string) => pool.find((p) => p.key === key)?.label ?? key
  const reviewing = !!review

  // Vị trí từng thẻ tính theo cha của `ObjGroupView` (nhảy tới câu có cờ): cộng vị trí khối này.
  const base = useRef(0)
  const itemY = useRef<Record<string, number>>({})
  const report = (id: string) => onItemLayout?.(id, base.current + (itemY.current[id] ?? 0))

  const openTray = (id: string) => {
    if (reviewing) return
    setActive(id)
    setTrayOpen(true)
  }
  const pick = (key: string) => {
    if (!active || reviewing) return
    const { changes, next } = pickHeadline(ids, answers, active, key)
    for (const [id, value] of changes) onAnswer(id, value)
    if (next) setActive(next)
    else setTrayOpen(false)
  }
  const activeIdx = active ? ids.indexOf(active) : -1
  const activeItem = activeIdx >= 0 ? group.items[activeIdx] : null

  return (
    <View
      style={{ gap: space[3] }}
      onLayout={(e) => {
        base.current = e.nativeEvent.layout.y
        if (onItemLayout) ids.forEach(report)
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <ThemedText variant="label" style={{ flex: 1, fontVariant: ['tabular-nums'] }}>
          {`Đã chọn ${answeredItems(ids, answers)}/${ids.length} đoạn`}
        </ThemedText>
        <ThemedText variant="caption" color="muted">{`${pool.length} tiêu đề, dùng ${ids.length}`}</ThemedText>
      </View>
      {reviewing ? null : (
        <ThemedText variant="caption" color="muted">
          Chạm ô dưới mỗi đoạn rồi chọn tiêu đề hợp nhất. Tiêu đề đã dùng có viền đứt.
        </ThemedText>
      )}

      {group.items.map((item, idx) => {
        const num = numberOf(item, idx)
        const isCur = !reviewing && trayOpen && active === item.id
        const tBlock = marks ? matchBlock(marks.texts, `t:${item.id}`, item.passage) : null
        return (
          <View
            key={item.id}
            onLayout={(e) => {
              itemY.current[item.id] = e.nativeEvent.layout.y
              report(item.id)
            }}
            style={{
              borderRadius: radius.md,
              backgroundColor: c.surface,
              borderWidth: isCur ? 1.5 : 1,
              borderColor: isCur ? c.textPrimary : c.border,
              padding: space[3] + 2,
              paddingLeft: 44,
              gap: space[3],
            }}
          >
            <ThemedText variant="titleLg" style={{ position: 'absolute', left: space[3] + 2, top: space[3] + 2 }} accessibilityLabel={`Đoạn ${num}`}>
              {num}
            </ThemedText>
            {onToggleFlag ? (
              <View style={{ position: 'absolute', right: space[2], top: space[2], zIndex: 1 }}>
                <FlagToggle on={!!flags?.includes(item.id)} onPress={() => onToggleFlag(item.id)} />
              </View>
            ) : null}
            {item.passage ? (
              <ThemedText variant="body" style={[TEXT_FONT, { color: c.textSecondary, paddingRight: onToggleFlag ? 36 : 0 }]} accessibilityLanguage="de-DE">
                {tBlock && marks ? <MarkedRun layer={marks} block={tBlock} /> : item.passage}
              </ThemedText>
            ) : null}
            <HeadlineSlot
              num={num}
              picked={answers[item.id]}
              label={answers[item.id] ? labelOf(answers[item.id]) : undefined}
              current={isCur}
              result={review?.get(item.id)}
              correctLabel={review?.get(item.id) ? labelOf(review.get(item.id)!.correct) : undefined}
              onPress={() => openTray(item.id)}
            />
            {review?.get(item.id) ? <ItemExplanation result={review.get(item.id)!} /> : null}
            {renderItemExtra?.(item)}
          </View>
        )
      })}

      <HeadlineTray
        open={trayOpen && !reviewing && !!activeItem}
        num={activeItem ? numberOf(activeItem, activeIdx) : ''}
        passage={activeItem?.passage}
        pool={pool}
        picked={active ? answers[active] : undefined}
        used={used}
        onPick={pick}
        onClose={() => setTrayOpen(false)}
      />
    </View>
  )
}

/** Ô "Chọn tiêu đề" dưới một đoạn (mẫu `.hslot`). */
function HeadlineSlot({
  num,
  picked,
  label,
  current,
  result,
  correctLabel,
  onPress,
}: {
  num: string
  picked?: string
  label?: string
  current: boolean
  result?: PracticeItemResult
  correctLabel?: string
  onPress: () => void
}) {
  const c = useTheme().colors
  const ok = !!picked
  const tone = result ? (result.isCorrect ? c.success : c.danger) : ok ? c.info : null
  const border = tone ?? (current ? c.textPrimary : c.borderStrong)
  const bg = result ? (result.isCorrect ? c.successSoft : c.dangerSoft) : ok ? NAVY_TINT : current ? c.accentSoft : c.surfaceSunken
  const a11y = result
    ? `Đoạn ${num}: ${ok ? `bạn chọn ${picked}. ${label}` : 'chưa chọn'}. ${result.isCorrect ? 'Đúng' : `Chưa đúng, đáp án ${result.correct}. ${correctLabel ?? ''}`}`
    : ok
      ? `Đoạn ${num}: tiêu đề ${picked}. ${label}. Chạm để đổi`
      : `Chọn tiêu đề cho đoạn ${num}`
  return (
    <View style={{ gap: space[1] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityState={{ disabled: !!result }}
        disabled={!!result}
        onPress={onPress}
        style={({ pressed }) => ({
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3] - 2,
          paddingVertical: 6,
          paddingHorizontal: space[3] - 2,
          borderRadius: radius.sm,
          borderWidth: 1.5,
          borderStyle: ok || result ? 'solid' : 'dashed',
          borderColor: border,
          backgroundColor: bg,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: tone ?? c.borderStrong,
            backgroundColor: tone ?? c.surface,
          }}
        >
          <ThemedText variant="label" style={{ color: tone ? c.onBrand : c.textPrimary }}>{picked ?? '?'}</ThemedText>
        </View>
        {ok ? (
          <ThemedText variant="body" style={{ flex: 1, fontFamily: fonts.displaySemi, color: c.textPrimary }} accessibilityLanguage="de-DE">
            {label}
          </ThemedText>
        ) : (
          <ThemedText variant="body" color="muted" style={{ flex: 1 }}>
            {result ? 'Chưa chọn' : 'Chọn tiêu đề'}
          </ThemedText>
        )}
        {result ? <Icon icon={result.isCorrect ? Check : X} size={16} color={result.isCorrect ? 'success' : 'danger'} strokeWidth={3} /> : null}
      </Pressable>
      {result && !result.isCorrect ? (
        <ThemedText variant="caption" color="secondary" accessibilityLanguage="de-DE">
          {`Đáp án đúng: ${result.correct}. ${correctLabel ?? ''}`}
        </ThemedText>
      ) : null}
    </View>
  )
}

/** Khay kính 10 tiêu đề (mẫu `.hl-tray`): trượt lên ở đáy màn, nhắc lại đoạn đang chọn để khỏi cuộn. */
function HeadlineTray({
  open,
  num,
  passage,
  pool,
  picked,
  used,
  onPick,
  onClose,
}: {
  open: boolean
  num: string
  passage?: string
  pool: { key: string; label: string }[]
  picked?: string
  used: Set<string>
  onPick: (key: string) => void
  onClose: () => void
}) {
  const t = useTheme()
  const c = t.colors
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Đóng khay tiêu đề" onPress={onClose} style={{ flex: 1 }} />
        <View
          style={{
            maxHeight: '72%',
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
          <View style={{ backgroundColor: 'rgba(255,255,255,0.72)', padding: space[3] + 2, gap: space[2], flexShrink: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <ThemedText variant="label" style={{ flex: 1 }} accessibilityRole="header">
                {`Tiêu đề cho đoạn ${num} · a–${pool[pool.length - 1]?.key ?? 'j'}`}
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
            {passage ? (
              <ScrollView style={{ maxHeight: 96 }} accessibilityLabel={`Đoạn ${num}`}>
                <ThemedText variant="caption" color="secondary" accessibilityLanguage="de-DE">{passage}</ThemedText>
              </ScrollView>
            ) : null}
            <ScrollView contentContainerStyle={{ gap: 6 }} style={{ flexShrink: 1 }}>
              {pool.map((h) => {
                const mine = picked === h.key
                const taken = !mine && used.has(h.key)
                return (
                  <Pressable
                    key={h.key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: mine }}
                    accessibilityLabel={`${h.key}. ${h.label}${mine ? ' (đang chọn)' : taken ? ' (đã dùng ở đoạn khác, chọn để chuyển sang đây)' : ''}`}
                    accessibilityLanguage="de-DE"
                    onPress={() => onPick(h.key)}
                    style={({ pressed }) => ({
                      minHeight: 44,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space[3] - 2,
                      paddingVertical: 6,
                      paddingHorizontal: space[3] - 2,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderStyle: taken ? 'dashed' : 'solid',
                      borderColor: mine ? c.info : c.borderStrong,
                      backgroundColor: mine ? NAVY_TINT : taken ? 'transparent' : pressed ? c.surfaceSunken : 'rgba(255,255,255,0.78)',
                    })}
                  >
                    <View style={{ width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: mine ? c.info : c.surfaceSunken }}>
                      <ThemedText variant="label" style={{ color: mine ? c.onBrand : c.textPrimary }}>{h.key}</ThemedText>
                    </View>
                    <ThemedText variant="body" style={{ flex: 1, fontFamily: fonts.displaySemi, color: taken ? c.textMuted : c.textPrimary }}>
                      {h.label}
                    </ThemedText>
                  </Pressable>
                )
              })}
            </ScrollView>
            <Caption>Mỗi tiêu đề chỉ dùng một lần · chạm lại tiêu đề đang chọn để bỏ.</Caption>
          </View>
        </View>
      </View>
    </Modal>
  )
}
