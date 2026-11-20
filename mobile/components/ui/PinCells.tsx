// Ô nhập mã 6 số kiểu "sáu ô tách rời" — cùng mẫu owner chọn cho web (#772, 08/11/2026).
//
// Bên dưới là MỘT TextInput thật, trong suốt, phủ kín sáu ô vẽ: dán cả mã, gợi ý mã của iOS
// (textContentType="oneTimeCode") / Android (autoComplete="one-time-code") và VoiceOver/TalkBack đều thấy
// một trường duy nhất có nhãn — không phải sáu ô rời nhảy tiêu điểm bằng script. Ký tự không phải chữ số
// bị lọc ngay khi gõ/dán ("482 913" → 482913). Biểu tượng: không có (điều khiển thuần chữ số).
//
// Kiểu ô theo mẫu v3.4 (`.pin`, 19/11/2026): viền 1,5 màu viền đậm, bo 12; ô đang gõ viền xanh hải quân
// (màu focus của bộ v3.4) + quầng nhạt và con trỏ nhấp nháy (đứng yên khi bật Giảm chuyển động).

import { useState } from 'react'
import { TextInput, View } from 'react-native'
import { MotiView } from 'moti'
import { radius, space, useTheme } from '@/lib/theme'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { ThemedText } from './ThemedText'

const CELL_HEIGHT = 60
const HALO = 3

interface PinCellsProps {
  label: string
  value: string
  onChange: (digits: string) => void
  length?: number
  autoFocus?: boolean
  editable?: boolean
  error?: string
  /** testID của ô nhập thật (để QA/E2E gõ vào). */
  testID?: string
  /** Ẩn nhãn hiển thị khi tiêu đề màn đã nói rõ (nhãn vẫn đọc cho VoiceOver qua ô nhập). */
  hideLabel?: boolean
}

function Caret() {
  const c = useTheme().colors
  const reducedMotion = useReducedMotion()
  const bar = { width: 2, height: 26, borderRadius: 1, backgroundColor: c.textPrimary }
  if (reducedMotion) return <View style={bar} />
  return (
    <MotiView
      from={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ type: 'timing', duration: 520, loop: true }}
      style={bar}
    />
  )
}

export function PinCells({
  label,
  value,
  onChange,
  length = 6,
  autoFocus = false,
  editable = true,
  error,
  testID,
  hideLabel = false,
}: PinCellsProps) {
  const theme = useTheme()
  const [focused, setFocused] = useState(false)
  const active = Math.min(value.length, length - 1)

  return (
    <View style={{ gap: space[2] }}>
      {hideLabel ? null : (
        <ThemedText variant="label" color="secondary">
          {label}
        </ThemedText>
      )}
      <View>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flexDirection: 'row', gap: space[2] }}
        >
          {Array.from({ length }, (_, i) => {
            const ch = value[i]
            const isActive = focused && i === active && value.length < length
            const borderColor = error
              ? theme.colors.danger
              : isActive
                ? theme.colors.info
                : theme.colors.borderStrong
            return (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: CELL_HEIGHT,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.surface,
                  borderWidth: 1.5,
                  borderColor,
                  borderRadius: radius.md,
                  opacity: editable ? 1 : 0.6,
                }}
              >
                {isActive && !error ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: -HALO - 1.5,
                      left: -HALO - 1.5,
                      right: -HALO - 1.5,
                      bottom: -HALO - 1.5,
                      borderRadius: radius.md + HALO,
                      borderWidth: HALO,
                      borderColor: theme.colors.infoSoft,
                    }}
                  />
                ) : null}
                {/* Số dùng chữ serif của bộ v3.4 (vai "monoLg": Newsreader 600), chữ số đều bề ngang. */}
                {ch ? (
                  <ThemedText variant="monoLg" style={{ fontVariant: ['tabular-nums'] }}>
                    {ch}
                  </ThemedText>
                ) : isActive ? (
                  <Caret />
                ) : null}
              </View>
            )
          })}
        </View>
        <TextInput
          testID={testID}
          accessibilityLabel={label}
          accessibilityHint={error}
          value={value}
          onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, length))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          // KHÔNG đặt maxLength: iOS/Android cắt chuỗi DÁN trước khi lọc ⇒ „482 913" (7 ký tự) mất số cuối.
          autoFocus={autoFocus}
          editable={editable}
          caretHidden
          selectionColor="transparent"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            color: 'transparent',
            backgroundColor: 'transparent',
            // Android vẫn vẽ chữ dù trong suốt nếu cỡ chữ lớn — giữ nhỏ, ô vẽ phía trên mới là thứ người dùng thấy.
            fontSize: 1,
          }}
        />
      </View>
      {error ? (
        <ThemedText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : null}
    </View>
  )
}
