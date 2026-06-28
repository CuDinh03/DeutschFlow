import { useState } from 'react'
import { View, Pressable, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { router } from 'expo-router'
import { Check, Lock } from 'lucide-react-native'
import { useMutation } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'
import api from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, ThemedText, Icon, AppHeader, TextField, Card, Caption } from '@/components/ui'

export default function EditProfileScreen() {
  const theme = useTheme()
  const c = theme.colors
  const { user, setUser } = useAuthStore()
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')

  const mutation = useMutation({
    mutationFn: (name: string) => api.patch<{ displayName: string }>('/profile/me', { displayName: name }),
    onSuccess: (res, name) => {
      if (user) setUser({ ...user, displayName: res.data?.displayName ?? name })
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <AppHeader
        title="Chỉnh sửa hồ sơ"
        subtitle="Thông tin cá nhân"
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

      <View style={{ paddingHorizontal: space[5], marginTop: space[4], gap: space[6] }}>
        {/* Identity — editorial ink hero, mirroring the Home/Profile idiom */}
        <Card style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: radius.md,
                backgroundColor: c.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ThemedText variant="displayLg" color="onAccent">
                {initial}
              </ThemedText>
            </View>
            <View style={{ flex: 1, gap: space[1] }}>
              <Caption color={c.accent}>Đang chỉnh sửa</Caption>
              <ThemedText variant="titleLg" style={{ color: c.onInk }} numberOfLines={1}>
                {trimmed || user?.displayName || 'Hồ sơ của bạn'}
              </ThemedText>
              <ThemedText variant="caption" style={{ color: c.onInkMuted }} numberOfLines={1}>
                {user?.email}
              </ThemedText>
            </View>
          </View>
        </Card>

        {/* Display name */}
        <View style={{ gap: space[2] }}>
          <Caption>Tên hiển thị</Caption>
          <TextField
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Nhập tên của bạn"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => canSave && mutation.mutate(trimmed)}
            error={tooShort ? 'Tên phải có ít nhất 2 ký tự.' : undefined}
          />
        </View>

        {/* Email — locked field */}
        <View style={{ gap: space[2] }}>
          <Caption>Email</Caption>
          <Card tone="sunken" style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.sm,
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon icon={Lock} size={16} color="muted" />
            </View>
            <ThemedText variant="bodyLg" color="muted" style={{ flex: 1 }} numberOfLines={1}>
              {user?.email}
            </ThemedText>
          </Card>
          <ThemedText variant="caption" color="muted">
            Email không thể thay đổi từ ứng dụng.
          </ThemedText>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}
