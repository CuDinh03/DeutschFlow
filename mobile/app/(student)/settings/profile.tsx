import { useState } from 'react'
import { View, Pressable, Alert, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { Check } from 'lucide-react-native'
import { useMutation } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'
import api from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, ThemedText, Icon, AppHeader, TextField } from '@/components/ui'

export default function EditProfileScreen() {
  const theme = useTheme()
  const { user, setUser } = useAuthStore()
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')

  const mutation = useMutation({
    mutationFn: (name: string) => api.patch<{ displayName: string }>('/profile/me', { displayName: name }),
    onSuccess: (res) => {
      if (user) setUser({ ...user, displayName: res.data.displayName })
      Alert.alert('Đã lưu', 'Thông tin của bạn đã được cập nhật.')
      router.back()
    },
    onError: () => {
      Alert.alert('Lỗi', 'Không thể lưu thay đổi. Vui lòng thử lại.')
    },
  })

  const trimmed = displayName.trim()
  const canSave = trimmed.length >= 2 && trimmed !== user?.displayName
  const tooShort = trimmed.length > 0 && trimmed.length < 2
  const initial = (displayName || user?.displayName || '?').charAt(0).toUpperCase()

  return (
    <Screen edges={['top']}>
      <AppHeader
        title="Chỉnh sửa hồ sơ"
        onBack={() => router.back()}
        right={
          <Pressable onPress={() => canSave && mutation.mutate(trimmed)} disabled={!canSave || mutation.isPending} hitSlop={8}>
            {mutation.isPending ? (
              <ActivityIndicator size="small" color={theme.colors.accent} />
            ) : (
              <Icon icon={Check} size={22} color={canSave ? 'accent' : 'faint'} />
            )}
          </Pressable>
        }
      />

      <View style={{ paddingHorizontal: space[5], marginTop: space[4], gap: space[5] }}>
        <View style={{ alignItems: 'center', gap: space[3] }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: radius.full,
              backgroundColor: theme.colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ThemedText variant="displayLg" color="onAccent">
              {initial}
            </ThemedText>
          </View>
          <ThemedText variant="caption" color="muted">
            {user?.email}
          </ThemedText>
        </View>

        <TextField
          label="Tên hiển thị"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Nhập tên của bạn"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => canSave && mutation.mutate(trimmed)}
          error={tooShort ? 'Tên phải có ít nhất 2 ký tự.' : undefined}
        />

        <View style={{ gap: space[2] }}>
          <ThemedText variant="label" color="secondary">
            Email
          </ThemedText>
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: radius.lg,
              paddingHorizontal: space[4],
              paddingVertical: space[4],
              opacity: 0.6,
            }}
          >
            <ThemedText variant="bodyLg" color="muted">
              {user?.email}
            </ThemedText>
          </View>
          <ThemedText variant="caption" color="muted">
            Email không thể thay đổi từ ứng dụng.
          </ThemedText>
        </View>
      </View>
    </Screen>
  )
}
