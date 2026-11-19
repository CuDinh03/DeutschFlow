// Các mảnh của phòng thi nói telc (mẫu v3.4 `oral1`/`oral2`/`oralroom`, Đợt 5 phần B, 19/11/2026):
// thanh Teil, hàng ba người, thẻ đề có ý đã bàn, dock micro. Logic quyết định nằm ở `lib/oralRoom.ts`.

import { useState } from 'react'
import { Pressable, Switch, View } from 'react-native'
import { ChevronDown, ChevronUp, Square } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Button, GaGlyph, Icon, ThemedText, YellowSquare } from '@/components/ui'
import type { ExamDirective } from '@/lib/examSpeakingApi'
import { stimulusDisplay } from '@/lib/examSpeakingUi'
import { coveredCount, taskPrompts, teilStages, type OralSpeaker } from '@/lib/oralRoom'

/** Ba ô "Teil 1 · Teil 2 · Teil 3": xong đậm, đang làm vàng, chưa tới nhạt. */
export function OralStages({ totalParts, currentPart }: { totalParts: number; currentPart: number }) {
  const c = useTheme().colors
  const stages = teilStages(totalParts, currentPart)
  return (
    <View style={{ flexDirection: 'row', gap: space[2] }} accessible accessibilityLabel={`Đang ở Teil ${currentPart} trên ${stages.length}`}>
      {stages.map((s) => {
        const bg = s.state === 'done' ? c.inkSurface : s.state === 'current' ? c.accent : c.surfaceSunken
        const fg = s.state === 'done' ? c.onInk : s.state === 'current' ? c.onAccent : c.textMuted
        return (
          <View key={s.teilNo} style={{ flex: 1, height: 28, borderRadius: radius.full, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
            <ThemedText variant="label" style={{ color: fg }}>{`Teil ${s.teilNo}`}</ThemedText>
          </View>
        )
      })}
    </View>
  )
}

/** Hàng người trong phòng: Giám khảo · Bạn thi (AI, nếu Teil có) · Bạn. Người đang nói có viền và sóng âm. */
export function OralPeople({ speaker, hasPartner }: { speaker: OralSpeaker; hasPartner: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: space[2] }}>
      <Person mono="P" tone="ink" name="Giám khảo" talking={speaker === 'PRUEFER'} />
      {hasPartner && <Person mono="T" tone="accent" name="Bạn thi · AI" talking={speaker === 'PARTNER'} />}
      <Person mono="B" tone="soft" name="Bạn" talking={speaker === 'ME'} />
    </View>
  )
}

function Person({ mono, tone, name, talking }: { mono: string; tone: 'ink' | 'accent' | 'soft'; name: string; talking: boolean }) {
  const c = useTheme().colors
  const monoBg = tone === 'ink' ? c.inkSurface : tone === 'accent' ? c.accent : c.surfaceSunken
  const monoFg = tone === 'ink' ? c.onInk : tone === 'accent' ? c.onAccent : c.textPrimary
  return (
    <View
      accessible
      accessibilityLabel={talking ? `${name}, đang nói` : name}
      style={{
        flex: 1, alignItems: 'center', gap: 4, paddingVertical: space[2], borderRadius: radius.md,
        borderWidth: talking ? 2 : 1, borderColor: talking ? c.textPrimary : c.border,
        backgroundColor: talking ? c.surface : 'transparent',
      }}
    >
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: monoBg, alignItems: 'center', justifyContent: 'center' }}>
        <ThemedText variant="label" style={{ color: monoFg }}>{mono}</ThemedText>
      </View>
      <ThemedText variant="caption" numberOfLines={1} style={{ fontWeight: '600' }}>{name}</ThemedText>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 10, opacity: talking ? 1 : 0 }}>
        {[5, 9, 6, 10, 4].map((h, i) => (
          <View key={i} style={{ width: 3, height: h, borderRadius: 1.5, backgroundColor: c.textPrimary }} />
        ))}
      </View>
    </View>
  )
}

/**
 * Thẻ đề thu gọn được. Thẻ có danh sách ý (telc Teil 3 Planen) thì đếm "x/y ý đã bàn" và gạch ý
 * đã nói tới (`coveredPoints`); thẻ khác hiện tiêu đề, dòng phụ và gạch đầu dòng như cũ.
 */
export function OralTaskCard({ directive, notesText }: { directive: ExamDirective; notesText: string | null }) {
  const c = useTheme().colors
  const [open, setOpen] = useState(true)
  const prompts = taskPrompts(directive.stimulus)
  const covered = new Set(directive.coveredPoints ?? [])
  const disp = stimulusDisplay(directive.stimulus)
  const promptSet = new Set(prompts)
  const otherBullets = disp.bullets.filter((b) => !promptSet.has(b))
  const summary = prompts.length > 0
    ? `Thẻ đề · ${coveredCount(prompts, directive.coveredPoints)}/${prompts.length} ý đã bàn`
    : disp.headline ? `Thẻ đề · ${disp.headline}` : 'Thẻ đề'

  return (
    <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={summary}
        onPress={() => setOpen((o) => !o)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], paddingHorizontal: space[4], paddingVertical: space[3] }}
      >
        <ThemedText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{summary}</ThemedText>
        <Icon icon={open ? ChevronUp : ChevronDown} size={18} color="secondary" />
      </Pressable>
      {open && (
        <View style={{ paddingHorizontal: space[4], paddingBottom: space[4], gap: space[2] }}>
          {disp.headline && prompts.length > 0 ? <ThemedText variant="title">{disp.headline}</ThemedText> : null}
          {disp.lines.slice(0, 4).map((ln, i) => (
            <ThemedText key={`l${i}`} variant="body" color="secondary">{ln}</ThemedText>
          ))}
          {prompts.map((p, i) => {
            const done = covered.has(i)
            return (
              <View key={`p${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }} accessible accessibilityLabel={done ? `${p}, đã bàn` : p}>
                {done ? (
                  <GaGlyph name="hoanthanh" size={16} ink="primary" />
                ) : (
                  <View style={{ width: 16, alignItems: 'center' }}><YellowSquare size={6} /></View>
                )}
                <ThemedText
                  variant="body"
                  style={done ? { color: c.textMuted, textDecorationLine: 'line-through' } : undefined}
                >
                  {p}
                </ThemedText>
              </View>
            )
          })}
          {otherBullets.slice(0, 8).map((b, i) => (
            <View key={`b${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <View style={{ width: 16, alignItems: 'center' }}><YellowSquare size={5} /></View>
              <ThemedText variant="caption" color="secondary" style={{ flex: 1 }}>{b}</ThemedText>
            </View>
          ))}
          {directive.hintVi ? <ThemedText variant="caption" color="muted">{directive.hintVi}</ThemedText> : null}
          {notesText ? (
            <View style={{ backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: space[3], gap: 2 }}>
              <ThemedText variant="label" color="muted">Ghi chú của bạn</ThemedText>
              <ThemedText variant="caption" color="secondary">{notesText}</ThemedText>
            </View>
          ) : null}
        </View>
      )}
    </View>
  )
}

/** Dock dưới cùng: dòng trạng thái, nút micro tròn, công tắc tự dừng, nút sang Teil / kết thúc. */
export function OralMicDock({
  status,
  recording,
  disabled,
  onMic,
  autoStop,
  onAutoStop,
  actionLabel,
  actionDisabled,
  onAction,
  actionPrimary,
}: {
  status: string
  recording: boolean
  disabled: boolean
  onMic: () => void
  autoStop: boolean
  onAutoStop: (on: boolean) => void
  actionLabel: string
  actionDisabled: boolean
  onAction: () => void
  actionPrimary: boolean
}) {
  const c = useTheme().colors
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface, paddingHorizontal: space[5], paddingTop: space[3], paddingBottom: space[2], alignItems: 'center', gap: space[2] }}>
      <ThemedText variant="label" accessibilityLiveRegion="polite">{status}</ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Dừng và gửi câu trả lời' : 'Bấm để nói'}
        accessibilityState={{ disabled }}
        onPress={onMic}
        disabled={disabled}
        style={{
          width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center',
          backgroundColor: recording ? c.danger : c.accent, opacity: disabled ? 0.45 : 1,
          shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
        }}
      >
        {recording ? <Icon icon={Square} size={26} color="onInk" /> : <GaGlyph name="speaking" size={30} ink="onAccent" gold="ink" />}
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], alignSelf: 'stretch' }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Switch
            value={autoStop}
            onValueChange={onAutoStop}
            accessibilityLabel="Tự dừng khi im"
            trackColor={{ true: c.success, false: c.surfaceSunken }}
          />
          <ThemedText variant="caption" color="secondary">Tự dừng khi im</ThemedText>
        </View>
        <Button
          label={actionLabel}
          size="sm"
          variant={actionPrimary ? 'primary' : 'secondary'}
          disabled={actionDisabled}
          onPress={onAction}
        />
      </View>
    </View>
  )
}
