// Phụ trợ từng câu khi luyện Teil (Đợt 4c, 19/11/2026) — bản app của `itemAssist.tsx` web (B3, PR #817):
// - "Vì sao tôi chọn": ghi chú ngắn theo câu lúc làm bài (không bắt buộc), lưu cùng nháp; sau khi kiểm
//   tra hiện lại cạnh giải thích.
// - "Hỏi AI về câu này": sau khi kiểm tra (câu đúng lẫn sai). Server giữ bộ nhớ đệm — câu đã có lời giải
//   thích thì không trừ lượt AI.

import { useState } from 'react'
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native'
import { NotebookPen, RotateCw } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import { Caption, GaGlyph, Icon, ThemedText } from '@/components/ui'
import { NOTE_MAX, type ItemAiAnswer } from '@/lib/telcPracticeApi'

/** Ô "Vì sao tôi chọn" của một câu. Thu gọn thành một nút nhỏ; đã có chữ thì mở sẵn. */
export function NoteField({ label, value, onChange }: { label: string; value: string; onChange: (text: string) => void }) {
  const c = useTheme().colors
  const [open, setOpen] = useState(value !== '')
  if (!open) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ghi vì sao tôi chọn, ${label}`}
        accessibilityState={{ expanded: false }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 44, alignSelf: 'flex-start', opacity: pressed ? 0.6 : 1 })}
      >
        <Icon icon={NotebookPen} size={16} color="muted" />
        <ThemedText variant="label" color="muted">Ghi vì sao tôi chọn</ThemedText>
      </Pressable>
    )
  }
  return (
    <View style={{ gap: space[1] }}>
      <ThemedText variant="label" color="muted">Vì sao tôi chọn {label} (không bắt buộc)</ThemedText>
      <TextInput
        value={value}
        onChangeText={onChange}
        maxLength={NOTE_MAX}
        multiline
        placeholder="Ví dụ: thấy bài nhắc đúng ngày đó nên chọn…"
        placeholderTextColor={c.textFaint}
        accessibilityLabel={`Vì sao tôi chọn ${label}`}
        style={{
          minHeight: 64,
          borderWidth: 1.5,
          borderColor: c.borderStrong,
          borderRadius: radius.sm,
          paddingHorizontal: space[3],
          paddingVertical: space[2],
          color: c.textPrimary,
          fontSize: 15,
          textAlignVertical: 'top',
        }}
      />
      <ThemedText variant="caption" color="faint" align="right" style={{ fontVariant: ['tabular-nums'] }}>
        {value.length}/{NOTE_MAX}
      </ThemedText>
    </View>
  )
}

/** Ghi chú đã viết lúc làm bài, hiện cạnh giải thích sau khi kiểm tra. */
export function MyNote({ text }: { text: string }) {
  const c = useTheme().colors
  return (
    <View style={{ gap: 2, borderLeftWidth: 3, borderLeftColor: c.borderStrong, paddingLeft: space[3] }}>
      <Caption>Bạn đã ghi lúc làm bài</Caption>
      <ThemedText variant="body" color="secondary">{text}</ThemedText>
    </View>
  )
}

type AskState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'done'; res: ItemAiAnswer } | { kind: 'error'; message: string }

/** Nút + khung trả lời "Hỏi AI về câu này". */
export function AskAiPanel({ itemLabel, ask }: { itemLabel: string; ask: () => Promise<ItemAiAnswer> }) {
  const c = useTheme().colors
  const [state, setState] = useState<AskState>({ kind: 'idle' })

  const run = async () => {
    setState({ kind: 'loading' })
    try {
      setState({ kind: 'done', res: await ask() })
    } catch (e) {
      setState({ kind: 'error', message: apiMessage(e) || 'Chưa hỏi được AI. Bạn thử lại sau nhé.' })
    }
  }

  if (state.kind === 'idle') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Hỏi AI về ${itemLabel}`}
        onPress={() => void run()}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[2],
          alignSelf: 'flex-start',
          minHeight: 44,
          paddingHorizontal: space[3],
          borderRadius: radius.full,
          borderWidth: 1.5,
          borderColor: c.info,
          backgroundColor: pressed ? c.infoSoft : c.surface,
        })}
      >
        <GaGlyph name="dulieuai" size={18} />
        <ThemedText variant="label" color="info">Hỏi AI về câu này</ThemedText>
      </Pressable>
    )
  }
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ gap: space[2], borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: space[3] }}
    >
      {state.kind === 'loading' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 32 }}>
          <ActivityIndicator size="small" color={c.textMuted} />
          <ThemedText variant="caption" color="muted">AI đang đọc câu này…</ThemedText>
        </View>
      ) : state.kind === 'done' ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <GaGlyph name="dulieuai" size={16} />
            <Caption>AI giải thích</Caption>
          </View>
          <ThemedText variant="body">{state.res.answer}</ThemedText>
          <ThemedText variant="caption" color="muted">
            {state.res.cached ? 'Đã có sẵn, không tính lượt AI · ' : ''}AI có thể nhầm, hãy đối chiếu với bài.
          </ThemedText>
        </>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
          <ThemedText variant="caption" color="danger" style={{ flex: 1 }} accessibilityRole="alert">{state.message}</ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hỏi AI lại"
            onPress={() => void run()}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space[1], minHeight: 44, paddingHorizontal: space[2], opacity: pressed ? 0.6 : 1 })}
          >
            <Icon icon={RotateCw} size={14} color="info" />
            <ThemedText variant="label" color="info">Thử lại</ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  )
}
