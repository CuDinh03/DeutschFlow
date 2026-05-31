// Themed text input with label, focus ring, and optional error line. Focus
// state animates the border color only (no layout shift).

import { useState } from 'react'
import { TextInput, View, type TextInputProps } from 'react-native'
import { fonts, radius, space, type, useTheme } from '@/lib/theme'
import { ThemedText } from './ThemedText'

interface TextFieldProps extends TextInputProps {
  label?: string
  error?: string
}

export function TextField({ label, error, style, onFocus, onBlur, ...rest }: TextFieldProps) {
  const theme = useTheme()
  const [focused, setFocused] = useState(false)

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
      <TextInput
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
            paddingHorizontal: space[4],
            paddingVertical: space[4],
            color: theme.colors.textPrimary,
            fontFamily: fonts.bodyRegular,
            fontSize: type.bodyLg.fontSize,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <ThemedText variant="caption" color="danger">
          {error}
        </ThemedText>
      ) : null}
    </View>
  )
}
