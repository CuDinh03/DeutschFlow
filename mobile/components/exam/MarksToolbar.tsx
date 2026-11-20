// Thanh bút đánh dấu của một Teil (Đợt 4f, 20/11/2026) — bản app của `MarksBar` web: chọn bút (Từ khoá
// vàng · Bằng chứng xanh · Chưa chắc hồng · Gạch chân · Tẩy), Hoàn tác, Ẩn/hiện đánh dấu, trạng thái lưu,
// báo đánh dấu cũ bị bỏ khi bài vừa sửa chữ. Bỏ so với web: gợi ý bôi chọn chữ / gắn số câu / ghi chú
// (app tô theo từ — chạm nối cụm, nhấn giữ cả câu — chưa có gắn câu và ghi chú), nút "?" (gợi ý ngắn luôn hiện một dòng bên dưới).

import { Pressable, ScrollView, View } from 'react-native'
import { Eraser, Eye, EyeOff, Undo2 } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Icon, ThemedText } from '@/components/ui'
import type { Pen } from '@/lib/passageMarks'
import type { MarksLayer } from '@/hooks/usePassageMarks'
import { markBackground } from './MarkedRun'

const PENS: { pen: Pen; label: string; a11y: string }[] = [
  { pen: 'y', label: 'Từ khoá', a11y: 'Bút vàng: từ khoá' },
  { pen: 'g', label: 'Bằng chứng', a11y: 'Bút xanh: bằng chứng' },
  { pen: 'p', label: 'Chưa chắc', a11y: 'Bút hồng: chưa chắc' },
  { pen: 'ul', label: 'Gạch chân', a11y: 'Gạch chân' },
  { pen: 'erase', label: 'Tẩy', a11y: 'Tẩy đánh dấu' },
]

export function MarksToolbar({ layer, hint, offHint }: { layer: MarksLayer; hint?: string; offHint?: string }) {
  const c = useTheme().colors
  const ready = layer.status === 'ready'
  const pensOn = ready && !layer.hidden
  const iconBtn = (on: boolean, disabled: boolean) =>
    ({ pressed }: { pressed: boolean }) => ({
      width: 44,
      height: 44,
      borderRadius: radius.md,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: on ? c.inkSurface : pressed ? c.surfaceSunken : 'transparent',
      opacity: disabled ? 0.35 : 1,
    })
  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="toolbar"
          accessibilityLabel="Bút đánh dấu"
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: space[2], paddingVertical: 2 }}
        >
          {PENS.map((p) => {
            const on = layer.pen === p.pen
            return (
              <Pressable
                key={p.pen}
                accessibilityRole="button"
                accessibilityLabel={on ? `${p.a11y} (đang bật, chạm để tắt bút)` : p.a11y}
                accessibilityState={{ selected: on, disabled: !pensOn }}
                disabled={!pensOn}
                hitSlop={4}
                onPress={() => layer.setPen(on ? null : p.pen)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space[2],
                  height: 36,
                  paddingHorizontal: space[3],
                  borderRadius: radius.full,
                  borderWidth: on ? 2 : 1.5,
                  borderColor: on ? c.textPrimary : c.borderStrong,
                  backgroundColor: pressed ? c.surfaceSunken : c.surface,
                  opacity: pensOn ? 1 : 0.5,
                })}
              >
                {p.pen === 'y' || p.pen === 'g' || p.pen === 'p' ? (
                  <View style={{ width: 14, height: 14, borderRadius: 4, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: markBackground(c, p.pen) }} />
                ) : p.pen === 'erase' ? (
                  <Icon icon={Eraser} size={15} color="secondary" />
                ) : null}
                <ThemedText variant="label" color={on ? 'primary' : 'secondary'} style={p.pen === 'ul' ? { textDecorationLine: 'underline' } : undefined}>
                  {p.label}
                </ThemedText>
              </Pressable>
            )
          })}
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hoàn tác đánh dấu"
          accessibilityState={{ disabled: !layer.canUndo || !pensOn }}
          disabled={!layer.canUndo || !pensOn}
          onPress={layer.undo}
          style={iconBtn(false, !layer.canUndo || !pensOn)}
        >
          <Icon icon={Undo2} size={18} color="primary" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={layer.hidden ? 'Hiện lại đánh dấu' : 'Ẩn tạm đánh dấu'}
          accessibilityState={{ selected: layer.hidden, disabled: !ready }}
          disabled={!ready}
          onPress={() => layer.setHidden(!layer.hidden)}
          style={iconBtn(layer.hidden, !ready)}
        >
          <Icon icon={layer.hidden ? EyeOff : Eye} size={18} color={layer.hidden ? 'onInk' : 'primary'} />
        </Pressable>
      </View>
      <MarksStatusLine layer={layer} hint={hint} offHint={offHint} />
    </View>
  )
}

function MarksStatusLine({ layer, hint, offHint }: { layer: MarksLayer; hint?: string; offHint?: string }) {
  const c = useTheme().colors
  if (layer.status === 'loading') return <ThemedText variant="caption" color="muted">Đang tải đánh dấu…</ThemedText>
  if (layer.status === 'error') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
        <ThemedText variant="caption" color="danger" style={{ flex: 1 }} accessibilityLiveRegion="polite">
          Chưa tải được đánh dấu, nên chưa tô được.
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tải lại đánh dấu"
          onPress={layer.retry}
          style={({ pressed }) => ({ minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: space[2], opacity: pressed ? 0.6 : 1 })}
        >
          <ThemedText variant="label" color="info">Thử lại</ThemedText>
        </Pressable>
      </View>
    )
  }
  const warn: string[] = []
  if (layer.full) warn.push('Đã đủ số đánh dấu cho Teil này. Tẩy bớt rồi tô tiếp.')
  if (layer.saveState === 'error') warn.push('Chưa lưu được đánh dấu. App sẽ thử lại khi bạn tô tiếp hoặc rời màn.')
  if (layer.saveState === 'rejected') warn.push('Không lưu được đánh dấu này. Hoàn tác lần tô vừa rồi hoặc tô tiếp để lưu bản mới.')
  if (layer.saveState === 'closed') warn.push('Lượt thi đã đóng, đánh dấu không lưu nữa.')
  if (layer.dropped) warn.push('Bài vừa được sửa chữ nên một số đánh dấu cũ đã bỏ.')
  const bad = layer.full || layer.saveState === 'error' || layer.saveState === 'rejected' || layer.saveState === 'closed'
  const base = layer.hidden
    ? 'Đang ẩn đánh dấu. Bấm hình con mắt để hiện lại và tô tiếp.'
    : layer.pen == null
      ? offHint ?? 'Đang tắt bút. Chọn một bút để tô.'
      : hint ?? 'Chạm từng từ để tô, chạm từ kế bên để nối cụm; nhấn giữ = cả câu. Chạm lại để xoá. Chạm lại bút đang chọn để tắt.'
  const saved = layer.saveState === 'saving' ? ' Đang lưu…' : layer.saveState === 'saved' ? ' Đã lưu, đồng bộ với bản web.' : ''
  return (
    <ThemedText
      variant="caption"
      color={bad ? 'danger' : 'muted'}
      style={!bad && layer.dropped ? { color: c.orange } : undefined}
      accessibilityLiveRegion="polite"
    >
      {warn.length ? warn.join(' ') : `${base}${saved}`}
    </ThemedText>
  )
}
