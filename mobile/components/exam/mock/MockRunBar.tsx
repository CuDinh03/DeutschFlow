// Thanh trên của màn đang thi thử (mẫu v3.4 `mockrun`, Đợt 4b 19/11/2026): nút rời, "Chặng x / y",
// đồng hồ đếm ngược theo giờ server, dải ba chặng, dải chip tiến độ từng Teil. Kèm dòng trạng thái lưu.
// Chỉ hiển thị — mọi quyết định (giờ, chặng, lưu) nằm ở `lib/mockRun.ts` và màn `exam-attempt.tsx`.

import { Pressable, ScrollView, View } from 'react-native'
import { Check, X } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { GaGlyph, Icon, IconButton, ThemedText } from '@/components/ui'
import { clockSpoken, clockTone, formatExamClock, stageName, stageShort, type SaveState } from '@/lib/mockRun'

export interface TeilChip {
  key: string
  label: string
  complete: boolean
}

interface Props {
  title: string
  stage: number
  stages: number[]
  secondsLeft: number | null
  chips: TeilChip[]
  onExit: () => void
  /** Bấm chip để tới Teil đó (Đợt 4e). */
  onChipPress?: (key: string) => void
}

export function MockRunBar({ title, stage, stages, secondsLeft, chips, onExit, onChipPress }: Props) {
  const c = useTheme().colors
  const pos = stages.indexOf(stage)
  const multi = stages.length > 1
  return (
    <View style={{ gap: space[3], paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <IconButton icon={X} accessibilityLabel="Dừng hoặc tạm rời bài thi thử" onPress={onExit} />
        <View style={{ flex: 1, alignItems: 'center' }} accessible accessibilityRole="header">
          <ThemedText variant="label" numberOfLines={1}>
            {multi ? `Chặng ${pos + 1} / ${stages.length}` : title}
          </ThemedText>
          <ThemedText variant="caption" color="muted" numberOfLines={1} accessibilityLanguage="de-DE">
            {multi ? stageName(stage) : 'Thi thử trọn đề'}
          </ThemedText>
        </View>
        {secondsLeft != null ? <ClockPill seconds={secondsLeft} /> : <View style={{ width: 44 }} />}
      </View>

      {multi ? (
        <View style={{ flexDirection: 'row', gap: space[1] + 2 }} accessible accessibilityLabel={`Đang ở chặng ${stageName(stage)}`}>
          {stages.map((s) => {
            const cur = s === stage
            const done = s < stage
            return (
              <View
                key={s}
                style={{
                  flex: 1,
                  minHeight: 30,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: cur ? c.inkSurface : c.border,
                  backgroundColor: cur ? c.inkSurface : done ? c.surfaceSunken : c.surface,
                }}
              >
                <ThemedText variant="caption" numberOfLines={1} style={{ color: cur ? c.onInk : done ? c.textMuted : c.textSecondary, fontWeight: cur ? '600' : '400' }}>
                  {stageShort(s)}
                </ThemedText>
              </View>
            )
          })}
        </View>
      ) : null}

      {chips.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }}>
          {chips.map((ch) => (
            <Pressable
              key={ch.key}
              onPress={onChipPress ? () => onChipPress(ch.key) : undefined}
              disabled={!onChipPress}
              accessibilityRole={onChipPress ? 'button' : undefined}
              accessibilityLabel={`${ch.label}${ch.complete ? ', đã làm xong' : ''}`}
              accessibilityHint={onChipPress ? 'Tới Teil này' : undefined}
              hitSlop={{ top: 7, bottom: 7 }}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: space[3],
                minHeight: 30,
                borderRadius: radius.full,
                borderWidth: 1,
                borderColor: ch.complete ? c.successSoft : c.border,
                backgroundColor: ch.complete ? c.successSoft : c.surface,
              })}
            >
              {ch.complete ? <Icon icon={Check} size={13} color="success" /> : null}
              <ThemedText variant="caption" style={{ color: ch.complete ? c.textPrimary : c.textSecondary, fontVariant: ['tabular-nums'] }}>
                {ch.label}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  )
}

function ClockPill({ seconds }: { seconds: number }) {
  const c = useTheme().colors
  const tone = clockTone(seconds)
  // Chữ luôn màu mực (cam/đỏ trên nền trắng/nhạt < 4,5:1); màu cảnh báo nằm ở viền và nền.
  const fg = c.textPrimary
  const edge = tone === 'danger' ? c.danger : tone === 'warn' ? c.orange : c.border
  const bg = tone === 'danger' ? c.dangerSoft : tone === 'warn' ? c.accentSoft : c.surface
  return (
    <View
      accessible
      accessibilityRole="timer"
      accessibilityLabel={`Thời gian thi ${clockSpoken(seconds)}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 36,
        paddingHorizontal: space[3],
        borderRadius: radius.full,
        borderWidth: tone === 'normal' ? 1 : 2,
        borderColor: edge,
        backgroundColor: bg,
      }}
    >
      <GaGlyph name="thoigian" size={16} />
      <ThemedText variant="mono" style={{ color: fg, fontVariant: ['tabular-nums'] }}>
        {formatExamClock(seconds)}
      </ThemedText>
    </View>
  )
}

const SAVE_TEXT: Record<SaveState, string> = {
  idle: 'Tự lưu khi bạn làm',
  pending: 'Chưa lưu…',
  saving: 'Đang lưu…',
  saved: 'Đã lưu',
  retrying: 'Mất mạng, sẽ lưu lại',
}

/** "✓ Đã lưu" — học viên biết bài đã lên máy chủ; mất mạng thì nói thẳng. */
export function SaveStatus({ state }: { state: SaveState }) {
  const c = useTheme().colors
  // Đỏ trên nền giấy (≈ 4,4:1) và xanh (≈ 3,4:1) chưa đạt 4,5:1: chữ mực khi có trạng thái đáng chú ý, màu ở biểu tượng.
  const color = state === 'retrying' || state === 'saved' ? c.textPrimary : c.textMuted
  return (
    <View
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={SAVE_TEXT[state]}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
    >
      {state === 'saved' ? <Icon icon={Check} size={14} color="success" /> : null}
      {state === 'retrying' ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.danger }} /> : null}
      <ThemedText variant="caption" style={{ color }}>
        {SAVE_TEXT[state]}
      </ThemedText>
    </View>
  )
}
