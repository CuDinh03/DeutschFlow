// Themed text input with label, focus ring, and optional error line. Focus
// state animates the border color only (no layout shift). Password fields get a
// reveal/hide eye toggle (Galerie v2 mockup parity).

import { useState } from 'react'
import { Pressable, TextInput, View, type TextInputProps } from 'react-native'
import { Eye, EyeOff } from 'lucide-react-native'
import { fonts, maxFontScale, radius, space, type, useTheme } from '@/lib/theme'
import { ThemedText } from './ThemedText'
import { Icon } from './Icon'

interface TextFieldProps extends TextInputProps {
  label?: string
  error?: string
}

export function TextField({
  label,
  error,
  style,
  onFocus,
  onBlur,
  secureTextEntry,
  ...rest
}: TextFieldProps) {
  const theme = useTheme()
  const [focused, setFocused] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const isPassword = !!secureTextEntry

  const borderColor = error
    ? theme.colors.danger
    : focused
      ? theme.colors.accent
      : theme.colors.border

  return (
    <View style={{ gap: space[2] }}>
      {label ? (
        <ThemedText variant="label" color="secondary">
          {label}
        </ThemedText>
      ) : null}
      <View style={{ justifyContent: 'center' }}>
        <TextInput
          // Dynamic Type cap (matches bodyLg) so large font settings keep the field usable.
          maxFontSizeMultiplier={maxFontScale.bodyLg}
          secureTextEntry={isPassword && !revealed}
          placeholderTextColor={theme.colors.textFaint}
          selectionColor={theme.colors.accent}
          onFocus={(e) => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          style={[
            {
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor,
              borderRadius: radius.lg,
              paddingLeft: space[4],
              paddingRight: isPassword ? 46 : space[4],
              paddingVertical: space[4],
              color: theme.colors.textPrimary,
              fontFamily: fonts.bodyRegular,
              fontSize: type.bodyLg.fontSize,
            },
            style,
          ]}
          {...rest}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            onPress={() => setRevealed((v) => !v)}
            hitSlop={8}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: 46,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon icon={revealed ? EyeOff : Eye} size={20} color="muted" />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <ThemedText variant="caption" color="danger">
          {error}
        </ThemedText>
      ) : null}
    </View>
  )
}
