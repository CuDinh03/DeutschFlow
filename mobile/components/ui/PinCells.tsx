// Ô nhập mã 6 số kiểu "sáu ô tách rời" — cùng mẫu owner chọn cho web (#772, 08/11/2026).
//
// Bên dưới là MỘT TextInput thật, trong suốt, phủ kín sáu ô vẽ: dán cả mã, gợi ý mã của iOS
// (textContentType="oneTimeCode") / Android (autoComplete="one-time-code") và VoiceOver/TalkBack đều thấy
// một trường duy nhất có nhãn — không phải sáu ô rời nhảy tiêu điểm bằng script. Ký tự không phải chữ số
// bị lọc ngay khi gõ/dán ("482 913" → 482913). Biểu tượng: không có (điều khiển thuần chữ số).

import { useState } from 'react'
import { TextInput, View } from 'react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { ThemedText } from './ThemedText'

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
}: PinCellsProps) {
  const theme = useTheme()
  const [focused, setFocused] = useState(false)
  const active = Math.min(value.length, length - 1)

  return (
    <View style={{ gap: space[2] }}>
      <ThemedText variant="label" color="secondary">
        {label}
      </ThemedText>
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
                ? theme.colors.textPrimary
                : theme.colors.border
            return (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 60,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.surface,
                  borderWidth: isActive ? 1.5 : 1,
                  borderColor,
                  borderRadius: radius.lg,
                  opacity: editable ? 1 : 0.6,
                }}
              >
                {/* Số dùng chữ serif của bộ Galerie v2 (vai "title"), chữ số đều bề ngang. */}
                <ThemedText variant="titleLg" style={{ fontVariant: ['tabular-nums'] }}>
                  {ch ?? ''}
                </ThemedText>
              </View>
            )
          })}
        </View>
        <TextInput
          testID={testID}
          accessibilityLabel={label}
          value={value}
          onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, length))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={length}
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
